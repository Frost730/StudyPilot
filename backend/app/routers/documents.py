from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models import Document, Chunk
from app.routers.auth import get_current_user
from app.services.pdf_parser import parse_pdf_pages
from app.utils.text_splitter import split_pages_into_chunks
from app.services.gemini_service import get_embeddings_batch

router = APIRouter(prefix="/documents", tags=["documents"])

# Background Task Worker
def process_document_background(document_id: int, user_id: int, file_bytes: bytes, db_session_factory):
    # Retrieve a separate db connection session for the background thread
    db = db_session_factory()
    try:
        # 1. Parse text from pages
        pages = parse_pdf_pages(file_bytes)
        if not pages:
            raise ValueError("No readable text content extracted from PDF.")

        # 2. Segment text
        chunks = split_pages_into_chunks(pages, chunk_size=1500, chunk_overlap=100)
        if not chunks:
            raise ValueError("Failed to split text content into paragraphs.")

        # 3. Generate embeddings
        chunk_texts = [c["content"] for c in chunks]
        embeddings = get_embeddings_batch(chunk_texts)

        # 4. Save chunks with vectors
        chunk_objects = []
        for index, chunk in enumerate(chunks):
            # Serialize the float[] list into a JSON string
            vector_json = json.dumps(embeddings[index])
            
            chunk_obj = Chunk(
                document_id=document_id,
                user_id=user_id,
                content=chunk["content"],
                page_number=chunk["page_number"],
                embedding=vector_json
            )
            chunk_objects.append(chunk_obj)

        db.bulk_save_objects(chunk_objects)
        
        # 5. Set status ready
        db.query(Document).filter(Document.id == document_id).update({"status": "ready"})
        db.commit()
        print(f"Document ID {document_id} processed successfully. Created {len(chunks)} chunks.")
    except Exception as error:
        print(f"Failed background processing for Document {document_id}: {error}")
        db.query(Document).filter(Document.id == document_id).update({
            "status": "failed",
            "error_message": str(error)
        })
        db.commit()
    finally:
        db.close()

# Endpoints
@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are allowed."
        )

    try:
        # Read files into memory
        file_bytes = await file.read()
        
        # Save placeholder Document
        new_doc = Document(
            user_id=current_user["id"],
            name=file.filename,
            size=len(file_bytes),
            status="processing"
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)

        # Add job to thread pool executor
        from app.database import SessionLocal
        background_tasks.add_task(
            process_document_background,
            new_doc.id,
            current_user["id"],
            file_bytes,
            SessionLocal
        )

        return {
            "message": "Document accepted for indexing",
            "document": {
                "id": new_doc.id,
                "name": new_doc.name,
                "size": new_doc.size,
                "status": new_doc.status,
                "createdAt": new_doc.created_at.isoformat()
            }
        }
    except Exception as error:
        print(f"Document upload failure: {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error uploading document."
        )

@router.get("/")
def get_documents(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.user_id == current_user["id"]).order_by(Document.created_at.desc()).all()
    
    # Format matches front-end expectations (maps Mongoose _id mapping to id)
    return {
        "documents": [
            {
                "_id": d.id,
                "name": d.name,
                "size": d.size,
                "status": d.status,
                "errorMessage": d.error_message,
                "createdAt": d.created_at.isoformat()
            }
            for d in docs
        ]
    }

@router.patch("/{id}")
def rename_document(
    id: int,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    name = body.get("name")
    if not name or name.strip() == "":
        raise HTTPException(status_code=400, detail="Document name is required.")
        
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user["id"]).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")

    doc.name = name.strip()
    db.commit()
    db.refresh(doc)
    
    return {
        "document": {
            "_id": doc.id,
            "name": doc.name,
            "size": doc.size,
            "status": doc.status,
            "createdAt": doc.created_at.isoformat()
        }
    }

@router.delete("/{id}")
def delete_document(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user["id"]).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")

    db.delete(doc)
    db.commit()
    return {"message": "Document and associated vector chunks deleted successfully."}
