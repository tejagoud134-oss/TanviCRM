from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from typing import List

from pydantic import BaseModel
from app.services.audit_service import log_activity

class NotificationDispatch(BaseModel):
    guest_id: str
    channel: str # whatsapp, sms, email
    message: str

router = APIRouter(prefix="/notifications", tags=["System Notifications"])

@router.get("", response_model=List[schemas.NotificationResponse])
def get_notifications(
    x_user_id: str = Header("usr-customer"), 
    db: Session = Depends(get_db)
):
    # Retrieve user specific or general broadcast notifications
    return db.query(models.Notification).filter(
        (models.Notification.user_id == x_user_id) | (models.Notification.user_id == None)
    ).order_by(models.Notification.created_at.desc()).all()

@router.put("/read")
def mark_notifications_read(
    x_user_id: str = Header("usr-customer"), 
    db: Session = Depends(get_db)
):
    unread = db.query(models.Notification).filter(
        models.Notification.user_id == x_user_id,
        models.Notification.is_read == False
    ).all()
    
    for notif in unread:
        notif.is_read = True
        
    db.commit()
    return {"message": "All notifications marked as read."}


@router.post("/send")
def send_notification(
    payload: NotificationDispatch,
    x_user_name: str = Header("Boutique Staff"),
    db: Session = Depends(get_db)
):
    guest = db.query(models.Guest).filter(models.Guest.id == payload.guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest profile not found")

    channel_name = payload.channel.upper()
    destination = guest.email if payload.channel == "email" else guest.phone

    # Create in-app notification record
    notif = models.Notification(
        user_id="usr-staff", # Alert the staff portal of activities
        title=f"Dispatched {channel_name} Alert",
        message=f"Sent to {guest.name} ({destination}): {payload.message[:60]}...",
        is_read=False
    )
    db.add(notif)
    
    # Audit log
    details_text = f"Triggered automated {channel_name} dispatch to {guest.name} at {destination}. Content: \"{payload.message}\""
    log_activity(db, user=x_user_name, action=f"Sent {channel_name}", details=details_text)
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully simulated sending {channel_name} notification.",
        "channel": payload.channel,
        "recipient": guest.name,
        "destination": destination,
        "dispatched_at": str(datetime.datetime.now())
    }

