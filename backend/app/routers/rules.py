from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from app.services.audit_service import log_activity
from typing import List

router = APIRouter(prefix="/rules", tags=["Boutique Rules Settings"])

@router.post("/seed")
def seed_rules(db: Session = Depends(get_db)):
    default_rules = {
        "vipWarningPercent": 90,
        "minAdvanceDays": 3,
        "maxEliteRsvps": 25
    }
    for key, val in default_rules.items():
        rule = db.query(models.Rule).filter(models.Rule.key == key).first()
        if not rule:
            rule = models.Rule(key=key, value=val)
            db.add(rule)
    db.commit()
    return {"message": "Rules initialized successfully!"}

@router.get("", response_model=List[schemas.RuleResponse])
def get_rules(db: Session = Depends(get_db)):
    return db.query(models.Rule).all()

@router.put("/{key}", response_model=schemas.RuleResponse)
def update_rule(
    key: str, 
    payload: schemas.RuleUpdate, 
    x_user_name: str = Header("Boutique Admin"), 
    db: Session = Depends(get_db)
):
    rule = db.query(models.Rule).filter(models.Rule.key == key).first()
    if not rule:
        # Create it if it doesn't exist
        rule = models.Rule(key=key, value=payload.value)
        db.add(rule)
    else:
        rule.value = payload.value
        
    db.commit()
    db.refresh(rule)
    
    log_activity(
        db, 
        user=x_user_name, 
        action="Modified Rules Settings", 
        details=f"Updated rule key '{key}' to value {payload.value}."
    )
    return rule
