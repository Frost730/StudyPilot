from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.models import Flashcard, Document, Chunk
from app.routers.auth import get_current_user
from app.services.gemini_service import generate_structured_json

router = APIRouter(prefix="/flashcards", tags=["flashcards"])

class GenerateCardsRequest(BaseModel):
    documentId: int
    count: Optional[int] = 10

class UpdateStatusRequest(BaseModel):
    status: str

@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_document_flashcards(
    body: GenerateCardsRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = body.documentId
    
    # Check document ownership
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user["id"]).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).limit(10).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="Document has no readable text chunks.")

    doc_context = "\n\n".join(c.content for c in chunks)
    prompt = f"Generate exactly {body.count} educational flashcards based on this context text:\n\n{doc_context}"

    system_instruction = """You are a study assistant. Your goal is to extract core definitions, key concepts, questions, and answers from the context and format them as flashcards.
    Return a JSON object containing an array of flashcards. Each flashcard MUST have a "front" (question or concept name) and a "back" (detailed definition, answer, or explanation).
    
    JSON Schema format:
    {
      "flashcards": [
        {
          "front": "What is the primary role of a CPU Scheduler?",
          "back": "To select which process in the ready queue should be allocated CPU execution time next."
        }
      ]
    }"""

    try:
        gemini_result = generate_structured_json(prompt, system_instruction)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"AI flashcards generation failed: {error}")

    card_list = gemini_result.get("flashcards", [])
    if not card_list:
        raise HTTPException(status_code=500, detail="Google Gemini generated no cards.")

    saved_cards = []
    for card in card_list:
        fc = Flashcard(
            user_id=current_user["id"],
            document_id=doc_id,
            front=card.get("front", ""),
            back=card.get("back", ""),
            status="review"
        )
        db.add(fc)
        saved_cards.append(fc)

    db.commit()
    for card in saved_cards:
        db.refresh(card)

    return {
        "message": f"Generated {len(saved_cards)} flashcards successfully",
        "flashcards": [
            {
                "_id": card.id,
                "front": card.front,
                "back": card.back,
                "status": card.status
            }
            for card in saved_cards
        ]
    }

@router.get("")
def get_flashcards(
    status: Optional[str] = None,
    documentId: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Flashcard).filter(Flashcard.user_id == current_user["id"])
    
    if status:
        query = query.filter(Flashcard.status == status)
    if documentId:
        query = query.filter(Flashcard.document_id == documentId)

    cards = query.order_by(Flashcard.created_at.desc()).all()
    return {
        "flashcards": [
            {
                "_id": c.id,
                "front": c.front,
                "back": c.back,
                "status": c.status
            }
            for c in cards
        ]
    }

@router.patch("/{id}")
def update_card_status(
    id: int,
    body: UpdateStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    next_status = body.status
    if next_status not in ["learned", "review"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'learned' or 'review'.")

    card = db.query(Flashcard).filter(Flashcard.id == id, Flashcard.user_id == current_user["id"]).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found or unauthorized.")

    card.status = next_status
    db.commit()
    db.refresh(card)

    return {
        "flashcard": {
            "_id": card.id,
            "front": card.front,
            "back": card.back,
            "status": card.status
        }
    }


@router.delete("")
def delete_all_flashcards(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Flashcard).filter(Flashcard.user_id == current_user["id"]).delete()
    db.commit()
    return {"message": "All flashcards deleted successfully."}


@router.delete("/{id}")
def delete_card(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    card = db.query(Flashcard).filter(Flashcard.id == id, Flashcard.user_id == current_user["id"]).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found or unauthorized.")

    db.delete(card)
    db.commit()
    return {"message": "Flashcard deleted successfully."}
