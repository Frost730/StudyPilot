import os
from dotenv import load_dotenv

# Load env variables from the backend folder root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

PORT = int(os.getenv("PORT", "5000"))
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_study_assistant_jwt_key_2026")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
NODE_ENV = os.getenv("NODE_ENV", "development")

# Ollama local LLM settings
USE_OLLAMA = os.getenv("USE_OLLAMA", "false").lower() == "true"
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
