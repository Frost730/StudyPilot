from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
  __tablename__ = "users"

  id = Column(Integer, primary_key=True, index=True)
  name = Column(String, nullable=False)
  email = Column(String, unique=True, index=True, nullable=False)
  password = Column(String, nullable=False)
  avatar = Column(String, default="")
  subscription_status = Column(String, default="free") # free, premium
  tutor_personality = Column(String, default="academic") # academic, socratic, eli5, coach
  created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
  __tablename__ = "documents"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  name = Column(String, nullable=False)
  size = Column(Integer, nullable=False) # in bytes
  status = Column(String, default="processing") # processing, ready, failed
  error_message = Column(String, default="")
  created_at = Column(DateTime, default=datetime.utcnow)

class Chunk(Base):
  __tablename__ = "chunks"

  id = Column(Integer, primary_key=True, index=True)
  document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
  user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  content = Column(Text, nullable=False)
  page_number = Column(Integer, nullable=False)
  embedding = Column(Text, nullable=False) # Store float[] serialized as JSON text

class Chat(Base):
  __tablename__ = "chats"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  title = Column(String, nullable=False)
  created_at = Column(DateTime, default=datetime.utcnow)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Message(Base):
  __tablename__ = "messages"

  id = Column(Integer, primary_key=True, index=True)
  chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
  role = Column(String, nullable=False) # user, assistant
  content = Column(Text, nullable=False)
  citations = Column(Text, default="[]") # Store Citation[] serialized as JSON text
  created_at = Column(DateTime, default=datetime.utcnow)

class Flashcard(Base):
  __tablename__ = "flashcards"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
  front = Column(String, nullable=False)
  back = Column(String, nullable=False)
  status = Column(String, default="review") # review, learned
  created_at = Column(DateTime, default=datetime.utcnow)

class Quiz(Base):
  __tablename__ = "quizzes"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
  title = Column(String, nullable=False)
  duration = Column(Integer, default=10) # in minutes
  score = Column(Integer, default=0) # percentage
  completed = Column(Boolean, default=False)
  questions = Column(Text, nullable=False) # Store QuizQuestion[] serialized as JSON text
  user_answers = Column(Text, default="[]") # Store UserAnswer[] serialized as JSON text
  created_at = Column(DateTime, default=datetime.utcnow)
  completed_at = Column(DateTime, nullable=True)

class StudyPlan(Base):
  __tablename__ = "study_plans"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  title = Column(String, nullable=False)
  exam_date = Column(DateTime, nullable=False)
  topics = Column(Text, nullable=False) # Serialized JSON string array
  daily_study_hours = Column(Integer, nullable=False)
  weekly_goals = Column(Text, default="[]") # Serialized JSON weekly goals
  schedule = Column(Text, default="[]") # Serialized JSON schedule blocks
  revision_plan = Column(Text, default="")
  completed = Column(Boolean, default=False)
  created_at = Column(DateTime, default=datetime.utcnow)

class Note(Base):
  __tablename__ = "notes"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
  title = Column(String, nullable=False)
  content = Column(Text, nullable=False) # Markdown text
  created_at = Column(DateTime, default=datetime.utcnow)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
