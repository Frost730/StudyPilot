from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models import Document, Chat, Message, Note, Flashcard, Quiz, StudyPlan
from app.routers.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("")
def get_user_analytics(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["id"]

    # 1. Count documents
    doc_count = db.query(Document).filter(Document.user_id == user_id).count()

    # 2. Count questions asked (messages with role "user" belonging to user's chats)
    user_chats = db.query(Chat).filter(Chat.user_id == user_id).all()
    chat_ids = [c.id for c in user_chats]
    
    question_count = 0
    if chat_ids:
        question_count = db.query(Message).filter(
            Message.chat_id.in_(chat_ids),
            Message.role == "user"
        ).count()

    # 3. Count notes
    notes_count = db.query(Note).filter(Note.user_id == user_id).count()

    # 4. Flashcards stats
    total_cards = db.query(Flashcard).filter(Flashcard.user_id == user_id).count()
    learned_cards = db.query(Flashcard).filter(
        Flashcard.user_id == user_id,
        Flashcard.status == "learned"
    ).count()

    # 5. Quiz stats
    completed_quizzes = db.query(Quiz).filter(
        Quiz.user_id == user_id,
        Quiz.completed == True
    ).all()
    
    quiz_count = len(completed_quizzes)
    avg_score = 0
    if quiz_count > 0:
        total_score = sum(q.score for q in completed_quizzes)
        avg_score = round(total_score / quiz_count)

    # Sort recent attempts
    recent_attempts = []
    completed_quizzes.sort(key=lambda x: x.completed_at or x.created_at, reverse=True)
    for q in completed_quizzes[:5]:
        recent_attempts.append({
            "id": q.id,
            "title": q.title,
            "score": q.score,
            "completedAt": q.completed_at.isoformat() if q.completed_at else q.created_at.isoformat()
        })

    # 6. Study plan stats
    study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).all()
    total_plans = len(study_plans)
    completed_plans = sum(1 for p in study_plans if p.completed)
    
    total_tasks = 0
    completed_tasks = 0
    unique_topics = set()
    total_daily_hours = 0
    
    for p in study_plans:
        try:
            sched = json.loads(p.schedule) if p.schedule else []
            topics_list = json.loads(p.topics) if p.topics else []
        except:
            sched = []
            topics_list = []
        
        unique_topics.update(topics_list)
        if not p.completed:
            total_daily_hours += p.daily_study_hours

        for block in sched:
            total_tasks += 1
            if block.get("completed", False):
                completed_tasks += 1

    return {
        "analytics": {
            "documentsUploaded": doc_count,
            "questionsAsked": question_count,
            "notesGenerated": notes_count,
            "flashcards": {
                "total": total_cards,
                "learned": learned_cards,
                "reviewPending": total_cards - learned_cards
            },
            "quizzes": {
                "totalTaken": quiz_count,
                "averageScore": avg_score,
                "recentAttempts": recent_attempts
            },
            "planner": {
                "totalPlans": total_plans,
                "completedPlans": completed_plans,
                "totalTasks": total_tasks,
                "completedTasks": completed_tasks,
                "dailyHoursCommitment": total_daily_hours,
                "uniqueTopicsCount": len(unique_topics),
                "topicsList": list(unique_topics)
            }
        }
    }
