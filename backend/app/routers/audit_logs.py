from fastapi import APIRouter, Depends, status, Header
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from typing import List

router = APIRouter(prefix="/audit-logs", tags=["Audit Trails"])

@router.get("", response_model=List[schemas.AuditLogResponse])
def get_logs(db: Session = Depends(get_db)):
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(100).all()

@router.delete("")
def clear_logs(db: Session = Depends(get_db)):
    db.query(models.AuditLog).delete()
    db.commit()
    return {"message": "Audit logs database truncated successfully."}
