from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import urllib.request
from typing import Optional
import app.config as config

router = APIRouter(prefix="/settings", tags=["settings"])


class ModelSelection(BaseModel):
    chat_model: Optional[str] = None
    embed_model: Optional[str] = None


@router.get("/models")
def list_available_models():
    """
    Queries the Ollama API for all locally installed models.
    Returns both the available model list and the currently active selections.
    """
    models = []
    chat_models = []
    embed_models = []

    if config.USE_OLLAMA:
        try:
            url = f"{config.OLLAMA_HOST}/api/tags"
            req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())
                raw_models = data.get("models", [])

                for m in raw_models:
                    name = m.get("name", "")
                    size_bytes = m.get("size", 0)
                    size_gb = round(size_bytes / (1024 ** 3), 1)
                    size_mb = round(size_bytes / (1024 ** 2), 0)
                    details = m.get("details", {})
                    family = details.get("family", "unknown")
                    param_size = details.get("parameter_size", "")
                    quant = details.get("quantization_level", "")

                    model_info = {
                        "name": name,
                        "size_gb": size_gb,
                        "size_mb": int(size_mb),
                        "family": family,
                        "parameter_size": param_size,
                        "quantization": quant,
                        "modified_at": m.get("modified_at", ""),
                    }
                    models.append(model_info)

                    # Classify: embedding models vs chat models
                    name_lower = name.lower()
                    is_embed = any(kw in name_lower for kw in [
                        "embed", "nomic", "bge", "e5", "minilm",
                        "all-minilm", "mxbai-embed", "snowflake"
                    ])
                    if is_embed:
                        embed_models.append(model_info)
                    else:
                        chat_models.append(model_info)

        except Exception as error:
            print(f"Failed to fetch Ollama models: {error}")

    return {
        "ollama_enabled": config.USE_OLLAMA,
        "ollama_host": config.OLLAMA_HOST,
        "current_chat_model": config.OLLAMA_MODEL,
        "current_embed_model": config.OLLAMA_EMBED_MODEL,
        "all_models": models,
        "chat_models": chat_models,
        "embed_models": embed_models,
    }


@router.post("/models")
def set_active_model(selection: ModelSelection):
    """
    Dynamically switches the active Ollama chat or embed model at runtime.
    Updates the in-memory config so no server restart is needed.
    """
    if not config.USE_OLLAMA:
        raise HTTPException(status_code=400, detail="Ollama is not enabled.")

    changed = []

    if selection.chat_model:
        # Verify model exists locally
        if not _model_exists(selection.chat_model):
            raise HTTPException(
                status_code=404,
                detail=f"Model '{selection.chat_model}' is not installed. Run: ollama pull {selection.chat_model}"
            )
        config.OLLAMA_MODEL = selection.chat_model
        changed.append(f"Chat model → {selection.chat_model}")

    if selection.embed_model:
        if not _model_exists(selection.embed_model):
            raise HTTPException(
                status_code=404,
                detail=f"Model '{selection.embed_model}' is not installed. Run: ollama pull {selection.embed_model}"
            )
        config.OLLAMA_EMBED_MODEL = selection.embed_model
        changed.append(f"Embed model → {selection.embed_model}")

    if not changed:
        raise HTTPException(status_code=400, detail="No model selection provided.")

    return {
        "message": "Model updated successfully",
        "changes": changed,
        "current_chat_model": config.OLLAMA_MODEL,
        "current_embed_model": config.OLLAMA_EMBED_MODEL,
    }


@router.get("/status")
def get_system_status():
    """
    Returns the current AI backend status and configuration.
    """
    ollama_online = False
    if config.USE_OLLAMA:
        try:
            url = f"{config.OLLAMA_HOST}/api/tags"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    ollama_online = True
        except Exception:
            pass

    return {
        "ai_provider": "ollama" if config.USE_OLLAMA else ("gemini" if config.GEMINI_API_KEY else "offline"),
        "ollama_enabled": config.USE_OLLAMA,
        "ollama_online": ollama_online,
        "ollama_host": config.OLLAMA_HOST,
        "chat_model": config.OLLAMA_MODEL,
        "embed_model": config.OLLAMA_EMBED_MODEL,
        "gemini_configured": bool(config.GEMINI_API_KEY),
    }


def _model_exists(model_name: str) -> bool:
    """Check if a model is installed in Ollama."""
    try:
        url = f"{config.OLLAMA_HOST}/api/tags"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            installed = [m.get("name", "") for m in data.get("models", [])]
            return model_name in installed
    except Exception:
        return False
