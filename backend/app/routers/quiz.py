from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import uuid
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models import Quiz, Document, Chunk
from app.routers.auth import get_current_user
from app.services.gemini_service import generate_structured_json

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

class GenerateQuizRequest(BaseModel):
    documentId: int
    count: Optional[int] = 5
    duration: Optional[int] = 10

class UserAnswerItem(BaseModel):
    questionId: str
    selectedAnswer: str

class SubmitQuizRequest(BaseModel):
    answers: List[UserAnswerItem]

@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_document_quiz(
    body: GenerateQuizRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = body.documentId
    
    # Verify document ownership
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user["id"]).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).limit(10).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="Document has no readable text chunks.")

    doc_context = "\n\n".join(c.content for c in chunks)
    prompt = f"Generate exactly {body.count} quiz questions based on this study text:\n\n{doc_context}"

    system_instruction = """You are a professional examiner. Generate a JSON object representing a study quiz.
    The quiz must consist of a combination of MCQs, True/False, and Short Answer questions.
    Each MCQ must have 4 options. True/False questions must have options: ["True", "False"].
    Short Answer questions should have no options, but must provide a model correctAnswer (the expected definition/answer).
    
    Structure the response exactly as:
    {
      "title": "Quiz Title (e.g. Memory Management Practice Quiz)",
      "questions": [
        {
          "questionText": "Question text here...",
          "type": "mcq", // must be 'mcq', 'true-false', or 'short-answer'
          "options": ["Option A", "Option B", "Option C", "Option D"], // empty for short-answer
          "correctAnswer": "Option B", // For MCQ/TF, must match one of the options. For short-answer, the ideal answer.
          "explanation": "Explanation for why this is the correct answer."
        }
      ]
    }"""

    try:
        gemini_result = generate_structured_json(prompt, system_instruction)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"AI quiz generation failed: {error}")

    questions = gemini_result.get("questions", [])
    if not questions:
        raise HTTPException(status_code=500, detail="Google Gemini generated no questions.")

    # Generate custom UUID string IDs for questions
    quiz_questions = []
    for q in questions:
        quiz_questions.append({
            "_id": str(uuid.uuid4()),
            "questionText": q.get("questionText", ""),
            "type": q.get("type", "mcq"),
            "options": q.get("options", []),
            "correctAnswer": q.get("correctAnswer", ""),
            "explanation": q.get("explanation", "")
        })

    # Save to SQLite (serialize questions list)
    new_quiz = Quiz(
        user_id=current_user["id"],
        document_id=doc_id,
        title=gemini_result.get("title", f"Quiz on {doc.name}"),
        duration=body.duration,
        questions=json.dumps(quiz_questions),
        completed=False
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)

    return {
        "message": "Quiz generated successfully",
        "quiz": {
            "_id": new_quiz.id,
            "title": new_quiz.title,
            "duration": new_quiz.duration,
            "completed": new_quiz.completed,
            "questions": quiz_questions
        }
    }

@router.get("")
def get_quizzes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quizzes = db.query(Quiz).filter(Quiz.user_id == current_user["id"]).order_by(Quiz.created_at.desc()).all()
    
    formatted = []
    for q in quizzes:
        try:
            q_list = json.loads(q.questions) if q.questions else []
        except:
            q_list = []
            
        try:
            user_answers = json.loads(q.user_answers) if q.user_answers else []
        except:
            user_answers = []
            
        formatted.append({
            "_id": q.id,
            "title": q.title,
            "questions": q_list,
            "duration": q.duration,
            "completed": q.completed,
            "score": q.score,
            "userAnswers": user_answers,
            "createdAt": q.created_at.isoformat()
        })
        
    return {"quizzes": formatted}

@router.get("/{id}")
def get_quiz_by_id(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.id == id, Quiz.user_id == current_user["id"]).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    try:
        questions = json.loads(quiz.questions) if quiz.questions else []
    except:
        questions = []

    try:
        user_answers = json.loads(quiz.user_answers) if quiz.user_answers else []
    except:
        user_answers = []

    return {
        "quiz": {
            "_id": quiz.id,
            "title": quiz.title,
            "questions": questions,
            "duration": quiz.duration,
            "completed": quiz.completed,
            "score": quiz.score,
            "userAnswers": user_answers,
            "createdAt": quiz.created_at.isoformat()
        }
    }

@router.post("/{id}/submit")
def submit_quiz_answers(
    id: int,
    body: SubmitQuizRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.id == id, Quiz.user_id == current_user["id"]).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or unauthorized.")
        
    if quiz.completed:
        raise HTTPException(status_code=400, detail="This quiz has already been completed.")

    try:
        questions = json.loads(quiz.questions)
    except Exception as error:
        raise HTTPException(status_code=500, detail="Corrupted quiz schema.")

    correct_count = 0
    graded_answers = []

    for question in questions:
        q_id = question["_id"]
        q_type = question["type"]
        correct_ans = question["correctAnswer"].strip().lower()

        # Find user answer
        user_ans_item = next((a for a in body.answers if a.questionId == q_id), None)
        selected = user_ans_item.selectedAnswer.strip() if user_ans_item else ""

        is_correct = False
        if q_type in ["mcq", "true-false"]:
            is_correct = selected.lower() == correct_ans
        else:
            # Short answer loose validation
            is_correct = len(selected) > 5

        if is_correct:
            correct_count += 1

        graded_answers.append({
            "questionId": q_id,
            "selectedAnswer": selected,
            "isCorrect": is_correct
        })

    score = round((correct_count / len(questions)) * 100) if questions else 0

    quiz.score = score
    quiz.user_answers = json.dumps(graded_answers)
    quiz.completed = True
    quiz.completed_at = datetime.utcnow()
    db.commit()

    return {
        "message": "Quiz graded successfully",
        "quiz": {
            "_id": quiz.id,
            "title": quiz.title,
            "questions": questions,
            "duration": quiz.duration,
            "completed": quiz.completed,
            "score": quiz.score,
            "userAnswers": graded_answers,
            "createdAt": quiz.created_at.isoformat()
        }
    }


@router.post("/{id}/retake")
def retake_quiz(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.id == id, Quiz.user_id == current_user["id"]).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or unauthorized.")

    try:
        questions = json.loads(quiz.questions) if quiz.questions else []
    except:
        questions = []

    quiz.completed = False
    quiz.score = 0
    quiz.user_answers = "[]"
    quiz.completed_at = None
    db.commit()
    db.refresh(quiz)

    return {
        "message": "Quiz reset for retake successfully",
        "quiz": {
            "_id": quiz.id,
            "title": quiz.title,
            "questions": questions,
            "duration": quiz.duration,
            "completed": quiz.completed,
            "score": quiz.score,
            "userAnswers": [],
            "createdAt": quiz.created_at.isoformat()
        }
    }


@router.delete("/{id}")
def delete_quiz(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.id == id, Quiz.user_id == current_user["id"]).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or unauthorized.")

    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted successfully."}
