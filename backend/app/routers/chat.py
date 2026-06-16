from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
from typing import Optional, List

from app.database import get_db
from app.models import Chat, Message, Document, User
from app.routers.auth import get_current_user
from app.services.gemini_service import get_embedding, stream_chat_response
from app.services.vector_service import search_similar_chunks
import re
from app import config

router = APIRouter(prefix="/chat", tags=["chat"])

STOP_WORDS = {
    "what", "is", "are", "the", "a", "an", "of", "in", "on", "at", "for", "to", "with", "about", 
    "against", "between", "into", "through", "during", "before", "after", "above", "below", "from", 
    "up", "down", "out", "off", "over", "under", "again", "further", "then", "once", "here", "there", 
    "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", 
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", 
    "will", "just", "should", "now", "i", "me", "my", "myself", "we", "our", "ours", "ourselves", 
    "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", 
    "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves"
}

def extract_keywords(text: str) -> List[str]:
    # Extract lowercase words filtering out common stop words
    words = re.findall(r'[a-zA-Z0-9]+', text.lower())
    return [w for w in words if w not in STOP_WORDS and len(w) > 1]


class ChatRequest(BaseModel):
    prompt: str
    chatId: Optional[int] = None
    documentId: Optional[int] = None

@router.post("")
def ask_question(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt_text = body.prompt.strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="Prompt is required.")
        
    user = db.query(User).filter(User.id == current_user["id"]).first()
    tutor_personality = user.tutor_personality if (user and user.tutor_personality) else "academic"

    # 0. Retrieve past messages in this chat session to provide history context to the model and search
    history_list = []
    chat_id = body.chatId
    if chat_id:
        past_msgs = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.desc()).limit(4).all()
        past_msgs.reverse()
        for m in past_msgs:
            history_list.append({
                "role": m.role,
                "content": m.content
            })

    # 1. Contextualize search query for vector search if prompt is short or refers to previous topic
    search_prompt = prompt_text
    if history_list and len(prompt_text.split()) < 8:
        # Find the last user message in the session history to grab context terms
        last_user_msg = next((m["content"] for m in reversed(history_list) if m["role"] == "user"), None)
        if last_user_msg:
            keywords = extract_keywords(last_user_msg)
            if keywords:
                search_prompt = f"{prompt_text} {' '.join(keywords)}"

    # 2. Generate query embedding vector
    try:
        query_vector = get_embedding(search_prompt)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to generate search vector: {error}")

    # 3. Search SQLite for similar chunks and filter by a relevance score threshold
    all_chunks = search_similar_chunks(db, current_user["id"], query_vector, 5, body.documentId)
    
    # If in mock fallback mode (both keys and Ollama disabled), similarity scores are near 0.
    # Set threshold to -1.0 in mock mode to allow best matching mock chunks to render for UI testing.
    is_mock_mode = (not config.GEMINI_API_KEY) and (not config.USE_OLLAMA)
    threshold = -1.0 if is_mock_mode else 0.20
    
    similar_chunks = [c for c in all_chunks if c["score"] >= threshold]

    # 4. Formulate RAG prompt context and citation arrays
    citations = []
    context_blocks = []
    
    for idx, chunk in enumerate(similar_chunks):
        context_blocks.append(
            f"[Source #{idx + 1}] File: {chunk['document_name']}, Page: {chunk['page_number']}\nContent: {chunk['content']}"
        )
        citations.append({
            "documentId": chunk["document_id"],
            "documentName": chunk["document_name"],
            "pageNumber": chunk["page_number"],
            "content": chunk["content"]
        })

    if context_blocks:
        context_text = "\n\n".join(context_blocks)
    else:
        context_text = "No relevant document passages found. Inform user you are answering generally."

    # 5. SSE Generator function
    def sse_event_stream():
        full_assistant_text = ""
        try:
            # Call Gemini/Ollama stream with history context and tutor personality
            for token in stream_chat_response(prompt_text, context_text, history_list, tutor_personality=tutor_personality):
                full_assistant_text += token
                yield f"data: {json.dumps({'text': token})}\n\n"
        except Exception as error:
            yield f"data: {json.dumps({'error': str(error)})}\n\n"
            return

        # 5. Save discussion in SQLite database
        chat_id = body.chatId
        chat = None
        if chat_id:
            chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user["id"]).first()

        if not chat:
            # Start new chat
            title = prompt_text[:37] + "..." if len(prompt_text) > 40 else prompt_text
            chat = Chat(user_id=current_user["id"], title=title)
            db.add(chat)
            db.commit()
            db.refresh(chat)
            chat_id = chat.id

        # Save User prompt message
        user_msg = Message(chat_id=chat_id, role="user", content=prompt_text, citations="[]")
        db.add(user_msg)

        # Save Assistant cited response message (serialize citations to JSON text)
        assistant_msg = Message(
            chat_id=chat_id,
            role="assistant",
            content=full_assistant_text,
            citations=json.dumps(citations)
        )
        db.add(assistant_msg)
        db.commit()

        # Emit completion packet
        yield f"data: {json.dumps({'done': True, 'chatId': chat_id, 'citations': citations, 'fullText': full_assistant_text})}\n\n"

    return StreamingResponse(sse_event_stream(), media_type="text/event-stream")

@router.get("/history")
def get_chat_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chats = db.query(Chat).filter(Chat.user_id == current_user["id"]).order_by(Chat.updated_at.desc()).all()
    return {
        "chats": [
            {
                "_id": c.id,
                "title": c.title,
                "createdAt": c.created_at.isoformat(),
                "updatedAt": c.updated_at.isoformat()
            }
            for c in chats
        ]
    }

@router.get("/session/{id}")
def get_chat_session(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chat = db.query(Chat).filter(Chat.id == id, Chat.user_id == current_user["id"]).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Conversation session not found.")

    messages = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.created_at.asc()).all()
    
    formatted_messages = []
    for msg in messages:
        try:
            cit_list = json.loads(msg.citations)
        except:
            cit_list = []
            
        formatted_messages.append({
            "role": msg.role,
            "content": msg.content,
            "citations": cit_list
        })

    return {
        "chat": {
            "_id": chat.id,
            "title": chat.title,
            "messages": formatted_messages
        }
    }

@router.delete("/session/{id}")
def delete_chat_session(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chat = db.query(Chat).filter(Chat.id == id, Chat.user_id == current_user["id"]).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Conversation session not found.")

    db.delete(chat)
    db.commit()
    return {"message": "Conversation session deleted successfully."}
