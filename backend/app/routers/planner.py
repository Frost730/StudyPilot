from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import uuid
from datetime import datetime
from typing import List, Optional

from app.database import get_db
from app.models import StudyPlan
from app.routers.auth import get_current_user
from app.services.gemini_service import generate_structured_json

router = APIRouter(prefix="/planner", tags=["planner"])

class GeneratePlanRequest(BaseModel):
    title: Optional[str] = None
    examDate: str
    topics: List[str]
    dailyStudyHours: int

@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_study_plan(
    body: GeneratePlanRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        exam_dt = datetime.strptime(body.examDate, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid examDate format. Use YYYY-MM-DD.")

    prompt = f"Generate a structured study plan for an exam on {body.examDate}. Topics: {', '.join(body.topics)}. Daily commitment: {body.dailyStudyHours} hours."

    system_instruction = """You are a professional study coordinator. Generate a JSON object representing a study plan.
    You must divide the time between now and the exam date into weekly goals and a daily calendar schedule.
    
    Structure the response exactly as:
    {
      "weeklyGoals": [
        {
          "weekNumber": 1,
          "goal": "Master core concepts of scheduling and processes."
        }
      ],
      "schedule": [
        {
          "day": "Day 1 (Monday)",
          "topic": "Process scheduling algorithms",
          "tasks": ["Read Chapter 4", "Attempt scheduling exercises", "Summarize scheduler benefits"]
        }
      ],
      "revisionPlan": "A brief summary of how the last 3 days before the exam should be spent on mock testing and final revision."
    }"""

    try:
        gemini_result = generate_structured_json(prompt, system_instruction)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"AI study planner failed: {error}")

    # Process and append unique block IDs
    raw_schedule = gemini_result.get("schedule", [])
    schedule_blocks = []
    for block in raw_schedule:
        schedule_blocks.append({
            "_id": str(uuid.uuid4()),
            "day": block.get("day", ""),
            "topic": block.get("topic", ""),
            "tasks": block.get("tasks", []),
            "completed": False
        })

    # Save to SQLite
    title = body.title if body.title else f"Study Plan for {body.topics[0]} Exam"
    
    new_plan = StudyPlan(
        user_id=current_user["id"],
        title=title,
        exam_date=exam_dt,
        topics=json.dumps(body.topics),
        daily_study_hours=body.dailyStudyHours,
        weekly_goals=json.dumps(gemini_result.get("weeklyGoals", [])),
        schedule=json.dumps(schedule_blocks),
        revision_plan=gemini_result.get("revisionPlan", "")
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    return {
        "message": "Study plan generated successfully",
        "plan": {
            "_id": new_plan.id,
            "title": new_plan.title,
            "examDate": new_plan.exam_date.isoformat(),
            "dailyStudyHours": new_plan.daily_study_hours,
            "weeklyGoals": gemini_result.get("weeklyGoals", []),
            "schedule": schedule_blocks,
            "revisionPlan": new_plan.revision_plan,
            "completed": new_plan.completed,
            "createdAt": new_plan.created_at.isoformat()
        }
    }

@router.get("")
def get_study_plans(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plans = db.query(StudyPlan).filter(StudyPlan.user_id == current_user["id"]).order_by(StudyPlan.created_at.desc()).all()
    
    formatted = []
    for plan in plans:
        try:
            goals = json.loads(plan.weekly_goals)
            sched = json.loads(plan.schedule)
            topics_list = json.loads(plan.topics)
        except:
            goals = []
            sched = []
            topics_list = []
            
        formatted.append({
            "_id": plan.id,
            "title": plan.title,
            "examDate": plan.exam_date.isoformat(),
            "dailyStudyHours": plan.daily_study_hours,
            "topics": topics_list,
            "weeklyGoals": goals,
            "schedule": sched,
            "revisionPlan": plan.revision_plan,
            "completed": plan.completed,
            "createdAt": plan.created_at.isoformat()
        })
        
    return {"plans": formatted}

@router.get("/{id}")
def get_study_plan_by_id(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == id, StudyPlan.user_id == current_user["id"]).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    try:
        goals = json.loads(plan.weekly_goals)
        sched = json.loads(plan.schedule)
    except:
        goals = []
        sched = []

    return {
        "plan": {
            "_id": plan.id,
            "title": plan.title,
            "examDate": plan.exam_date.isoformat(),
            "dailyStudyHours": plan.daily_study_hours,
            "weeklyGoals": goals,
            "schedule": sched,
            "revisionPlan": plan.revision_plan,
            "completed": plan.completed
        }
    }

@router.patch("/{plan_id}/task/{block_id}")
def toggle_schedule_task(
    plan_id: int,
    block_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id, StudyPlan.user_id == current_user["id"]).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found or unauthorized.")

    try:
        schedule = json.loads(plan.schedule)
    except:
        raise HTTPException(status_code=500, detail="Corrupted schedule block.")

    # Find the target block
    found = False
    for block in schedule:
        if block.get("_id") == block_id:
            block["completed"] = not block.get("completed", False)
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Schedule block not found.")

    plan.schedule = json.dumps(schedule)
    db.commit()
    db.refresh(plan)

    try:
        goals = json.loads(plan.weekly_goals)
    except:
        goals = []

    return {
        "plan": {
            "_id": plan.id,
            "title": plan.title,
            "examDate": plan.exam_date.isoformat(),
            "dailyStudyHours": plan.daily_study_hours,
            "weeklyGoals": goals,
            "schedule": schedule,
            "revisionPlan": plan.revision_plan,
            "completed": plan.completed
        }
    }


@router.post("/{id}/finish")
def finish_study_plan(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == id, StudyPlan.user_id == current_user["id"]).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    plan.completed = not plan.completed
    db.commit()
    db.refresh(plan)

    try:
        goals = json.loads(plan.weekly_goals) if plan.weekly_goals else []
        sched = json.loads(plan.schedule) if plan.schedule else []
    except:
        goals = []
        sched = []

    return {
        "message": "Study plan completion status updated successfully",
        "plan": {
            "_id": plan.id,
            "title": plan.title,
            "examDate": plan.exam_date.isoformat(),
            "dailyStudyHours": plan.daily_study_hours,
            "weeklyGoals": goals,
            "schedule": sched,
            "revisionPlan": plan.revision_plan,
            "completed": plan.completed
        }
    }


@router.delete("/{id}")
def delete_study_plan(
    id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == id, StudyPlan.user_id == current_user["id"]).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    db.delete(plan)
    db.commit()
    return {"message": "Study plan deleted successfully."}
