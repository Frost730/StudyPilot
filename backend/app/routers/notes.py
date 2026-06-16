from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.database import get_db
from app.models import Note, Document, Chunk
from app.routers.auth import get_current_user
from app.services.gemini_service import generate_structured_json

router = APIRouter(prefix="/notes", tags=["notes"])

class GenerateNotesRequest(BaseModel):
    documentId: int

class UpdateNotesRequest(BaseModel):
    title: str
    content: str

@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_document_notes(
    body: GenerateNotesRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = body.documentId
    
    # Check document ownership
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user["id"]).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    all_chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).order_by(Chunk.page_number.asc()).all()
    if not all_chunks:
        raise HTTPException(status_code=400, detail="Document has no readable text chunks.")

    # Distribute chunks evenly (grab up to 8 chunks)
    step = max(1, len(all_chunks) // 8)
    sampled_chunks = []
    for i in range(0, len(all_chunks), step):
        sampled_chunks.append(all_chunks[i].content)
        if len(sampled_chunks) >= 8:
            break

    doc_context = "\n\n".join(sampled_chunks)
    prompt = f'Generate comprehensive study notes for the document titled "{doc.name}" based on this reference text:\n\n{doc_context}'
    
    system_instruction = """You are an expert tutor. Your task is to write detailed study notes based on the provided text.
    You must structure the notes under these EXACT markdown sections:
    # Title: [A descriptive title]
    
    ## Chapter Summary
    [Provide a concise 2-3 paragraph summary of the core topics discussed in the text]
    
    ## Key Concepts
    [List 3-5 key concepts with bullet points and detailed explanations]
    
    ## Important Definitions
    [List any critical definitions, formulas, or acronyms introduced, in bold]
    
    ## Exam Tips
    [Provide 3 practical exam tips, highlighting likely questions, tricky points, or study hints]
    
    You must return a JSON object with two fields:
    {
      "title": "A short descriptive title for the notes (e.g. Chapter 4: Operating System Scheduling)",
      "notesMarkdown": "[The full generated notes structured in markdown as instructed above]"
    }"""

    try:
        gemini_result = generate_structured_json(prompt, system_instruction)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"AI notes generation failed: {error}")

    new_notes = Note(
        user_id=current_user["id"],
        document_id=doc_id,
        title=gemini_result.get("title", f"Notes for {doc.name}"),
        content=gemini_result.get("notesMarkdown", "")
    )
    db.add(new_notes)
    db.commit()
    db.refresh(new_notes)

    # Return key matches frontend expectation (_id mapping)
    return {
        "message": "Notes generated successfully",
        "notes": {
            "_id": new_notes.id,
            "title": new_notes.title,
            "content": new_notes.content,
            "updatedAt": new_notes.updated_at.isoformat()
        }
    }

@router.get("")
def get_notes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notes = db.query(Note).filter(Note.user_id == current_user["id"]).order_by(Note.updated_at.desc()).all()
    return {
        "notes": [
            {
                "_id": n.id,
                "title": n.title,
                "content": n.content,
                "updatedAt": n.updated_at.isoformat()
            }
            for n in notes
        ]
    }

@router.get("/{id}")
def get_note_by_id(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == id, Note.user_id == current_user["id"]).first()
    if not note:
        raise HTTPException(status_code=404, detail="Notes file not found.")
        
    return {
        "note": {
            "_id": note.id,
            "title": note.title,
            "content": note.content,
            "updatedAt": note.updated_at.isoformat()
        }
    }

@router.put("/{id}")
def update_notes(
    id: int,
    body: UpdateNotesRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == id, Note.user_id == current_user["id"]).first()
    if not note:
        raise HTTPException(status_code=404, detail="Notes file not found or unauthorized.")

    note.title = body.title.strip()
    note.content = body.content
    db.commit()
    db.refresh(note)

    return {
        "note": {
            "_id": note.id,
            "title": note.title,
            "content": note.content,
            "updatedAt": note.updated_at.isoformat()
        }
    }

@router.delete("/{id}")
def delete_notes(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == id, Note.user_id == current_user["id"]).first()
    if not note:
        raise HTTPException(status_code=404, detail="Notes file not found or unauthorized.")

    db.delete(note)
    db.commit()
    return {"message": "Notes deleted successfully."}
