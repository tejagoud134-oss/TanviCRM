import datetime
from sqlalchemy.orm import Session
from app.models import models

def log_activity(db: Session, user: str, action: str, details: str):
    log = models.AuditLog(
        timestamp=datetime.datetime.utcnow(),
        user=user,
        action=action,
        details=details
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
