from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from typing import List
import bcrypt
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication & Profiles"])

class CredentialVerify(BaseModel):
    email: str
    password: str

class UserCreateInternal(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: str
    profile_image: str
    password: str

@router.post("/seed", status_code=status.HTTP_201_CREATED)
def seed_users(db: Session = Depends(get_db)):
    # Check if admin and staff users exist
    admin = db.query(models.User).filter(models.User.email == "admin@tanviboutique.com").first()
    if not admin:
        admin = models.User(
            id="usr-admin",
            name="Boutique Admin",
            email="admin@tanviboutique.com",
            phone="+91 99999 88888",
            password="$2b$10$y58o5q44E4v3jMizWwG33Onwz6g9aRk5k/s.YnJ4vV6zU/t2sK/4q", # bcrypt hash of 'AdminPass123!'
            role="Admin",
            profile_image=""
        )
        db.add(admin)

    staff = db.query(models.User).filter(models.User.email == "staff@tanviboutique.com").first()
    if not staff:
        staff = models.User(
            id="usr-staff",
            name="Boutique Staff",
            email="staff@tanviboutique.com",
            phone="+91 99999 77777",
            password="$2b$10$7yM.V.3v6C911oXo8s8tdu0mC9UjD9qK/k83h24zWv3p5n0zZ2iTq", # bcrypt hash of 'StaffPass123!'
            role="Staff",
            profile_image=""
        )
        db.add(staff)

    db.commit()
    return {"message": "Database default accounts seeded successfully!"}

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_internal(payload: UserCreateInternal, db: Session = Depends(get_db)):
    user = models.User(
        id=payload.id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        profile_image=payload.profile_image,
        password=payload.password # already hashed by gateway
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/verify-credentials")
def verify_credentials(payload: CredentialVerify, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password hash
    try:
        if not bcrypt.checkpw(payload.password.encode('utf-8'), user.password.encode('utf-8')):
            raise HTTPException(status_code=401, detail="Invalid email or password")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "profile_image": user.profile_image
    }

@router.get("/profile/{user_id}", response_model=schemas.UserResponse)
def get_profile(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    return user

@router.put("/profile/{user_id}", response_model=schemas.UserResponse)
def update_profile(user_id: str, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(user, key, val)
        
    db.commit()
    db.refresh(user)
    return user

@router.get("/users", response_model=List[schemas.UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()
