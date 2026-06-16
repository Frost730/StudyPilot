from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite database URL
DATABASE_URL = "sqlite:///../study_pilot.db"

# Create engine (check_same_thread=False is required for SQLite in multi-threaded environments)
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to yield database sessions to route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
