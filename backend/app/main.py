from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.database import engine
from app import models
from app.routers import auth, documents, chat, notes, flashcards, quiz, planner, analytics, settings

# Run SQLite migrations dynamically if needed
def run_migrations():
    import sqlite3
    import os
    db_path = "../study_pilot.db"
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(study_plans);")
            columns = [info[1] for info in cursor.fetchall()]
            if columns and "completed" not in columns:
                print("[Migration] Adding 'completed' column to 'study_plans' table...")
                cursor.execute("ALTER TABLE study_plans ADD COLUMN completed BOOLEAN DEFAULT 0;")
                conn.commit()
                
            cursor.execute("PRAGMA table_info(users);")
            user_columns = [info[1] for info in cursor.fetchall()]
            if user_columns and "tutor_personality" not in user_columns:
                print("[Migration] Adding 'tutor_personality' column to 'users' table...")
                cursor.execute("ALTER TABLE users ADD COLUMN tutor_personality TEXT DEFAULT 'academic';")
                conn.commit()
        except Exception as e:
            print(f"[Migration] Error executing dynamic migrations: {e}")
        finally:
            conn.close()

run_migrations()

# Automatically generate SQLite database tables on server startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="StudyPilot API",
    description="Python/FastAPI Backend for AI Study Assistant RAG Platform",
    version="1.0.0"
)

# Configure CORS Middleware to authorize Vite requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, lock down to the React frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bind Router endpoints (matching frontend API URL mapping)
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(flashcards.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(planner.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(settings.router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "healthy", "message": "StudyPilot FastAPI Backend is running"}
