from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt
import datetime
import random
import string
import urllib.request
import json
from typing import Optional

from app.database import get_db
from app.models import User
from app.config import JWT_SECRET, GOOGLE_CLIENT_ID

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Token Helpers
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: int, email: str) -> str:
    payload = {
        "id": user_id,
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# Dependency to secure routes
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return {"id": payload.get("id"), "email": payload.get("email")}
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

# Pydantic Schemas
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    newPassword: str

class ProfileUpdate(BaseModel):
    name: str
    avatar: Optional[str] = ""
    tutorPersonality: Optional[str] = "academic"


# Endpoints
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
        
    hashed_pwd = hash_password(user_data.password)
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user.id, new_user.email)
    return {
        "token": token,
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "subscriptionStatus": new_user.subscription_status,
            "avatar": new_user.avatar,
            "tutorPersonality": new_user.tutor_personality
        }
    }

@router.post("/login")
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password"
        )

    token = create_access_token(user.id, user.email)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "subscriptionStatus": user.subscription_status,
            "avatar": user.avatar,
            "tutorPersonality": user.tutor_personality
        }
    }

@router.post("/google")
def google_login(req_data: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        # Verify Token via Google API using standard urllib
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={req_data.credential}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            payload = json.loads(response.read().decode())

        # Verify Audience
        if GOOGLE_CLIENT_ID and payload.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Client ID audience mismatch"
            )

        if not payload.get("email_verified") in [True, "true"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google email is not verified"
            )

        email = payload.get("email")
        name = payload.get("name", "Google User")
        picture = payload.get("picture", "")

        user = db.query(User).filter(User.email == email).first()

        if not user:
            # Create user with a random secure password
            random_pwd = ''.join(random.choices(string.ascii_letters + string.digits, k=15))
            user = User(
                name=name,
                email=email,
                password=hash_password(random_pwd),
                avatar=picture
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif picture and user.avatar != picture:
            user.avatar = picture
            db.commit()

        token = create_access_token(user.id, user.email)
        return {
            "token": token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "subscriptionStatus": user.subscription_status,
                "avatar": user.avatar,
                "tutorPersonality": user.tutor_personality
            }
        }
    except Exception as error:
        print(f"Google authentication error: {error}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication failed"
        )

@router.post("/guest")
def guest_login(db: Session = Depends(get_db)):
    try:
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        guest_email = f"guest_{random_suffix}@studypilot.guest"
        guest_pwd = ''.join(random.choices(string.ascii_letters + string.digits, k=12))

        guest_user = User(
            name=f"Guest_{random_suffix}",
            email=guest_email,
            password=hash_password(guest_pwd),
            subscription_status="free"
        )
        db.add(guest_user)
        db.commit()
        db.refresh(guest_user)

        token = create_access_token(guest_user.id, guest_user.email)
        return {
            "token": token,
            "user": {
                "id": guest_user.id,
                "name": guest_user.name,
                "email": guest_user.email,
                "subscriptionStatus": guest_user.subscription_status,
                "avatar": guest_user.avatar,
                "tutorPersonality": guest_user.tutor_personality
            }
        }
    except Exception as error:
        print(f"Guest login error: {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Guest account creation failed"
        )

@router.post("/forgot-password")
def forgot_password(req_data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email does not exist"
        )
        
    user.password = hash_password(req_data.newPassword)
    db.commit()
    return {"message": "Password reset successful"}

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "subscriptionStatus": user.subscription_status,
            "avatar": user.avatar,
            "tutorPersonality": user.tutor_personality
        }
    }

@router.put("/update-profile")
def update_profile(
    profile_data: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not profile_data.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name cannot be empty"
        )
        
    user.name = profile_data.name.strip()
    if profile_data.avatar is not None:
        user.avatar = profile_data.avatar.strip()
    if profile_data.tutorPersonality is not None:
        user.tutor_personality = profile_data.tutorPersonality.strip()
        
    db.commit()
    db.refresh(user)
    
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "subscriptionStatus": user.subscription_status,
            "avatar": user.avatar,
            "tutorPersonality": user.tutor_personality
        }
    }

@router.post("/upgrade")
def upgrade_subscription(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    user.subscription_status = "premium"
    db.commit()
    db.refresh(user)
    return {"message": "Upgraded to premium successfully"}
