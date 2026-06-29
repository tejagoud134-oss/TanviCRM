from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from app.services.audit_service import log_activity
from typing import List, Optional

router = APIRouter(prefix="/guests", tags=["Guest & RSVPs"])

@router.get("", response_model=List[schemas.GuestResponse])
def get_guests(db: Session = Depends(get_db)):
    return db.query(models.Guest).order_by(models.Guest.created_at.desc()).all()

@router.get("/{guest_id}", response_model=schemas.GuestResponse)
def get_guest(guest_id: str, db: Session = Depends(get_db)):
    guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    return guest

@router.post("", response_model=schemas.GuestResponse, status_code=status.HTTP_201_CREATED)
def create_guest(
    payload: schemas.GuestCreate, 
    override: bool = Query(False),
    x_user_name: str = Header("Boutique Staff"),
    db: Session = Depends(get_db)
):
    # Verify event exists
    event = db.query(models.Event).filter(models.Event.id == payload.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Assigned event not found")

    # Check capacity limit if RSVP is Confirmed
    if payload.rsvp == "Confirmed":
        confirmed_count = db.query(models.Guest).filter(
            models.Guest.event_id == payload.event_id,
            models.Guest.rsvp == "Confirmed"
        ).count()

        if confirmed_count >= event.capacity and not override:
            raise HTTPException(
                status_code=409,
                detail=f"Capacity Alert: Event '{event.name}' has reached its maximum capacity of {event.capacity}."
            )

    new_guest = models.Guest(
        id=payload.id,
        event_id=payload.event_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        vip=payload.vip,
        rsvp=payload.rsvp,
        checked_in=payload.checked_in,
        checkin_time=payload.checkin_time,
        notes=payload.notes
    )

    db.add(new_guest)
    db.commit()
    db.refresh(new_guest)

    log_activity(
        db, 
        user=x_user_name, 
        action="Added Guest", 
        details=f"Registered client '{payload.name}' to event. RSVP: {payload.rsvp}. VIP: {payload.vip}."
    )
    return new_guest

@router.put("/{guest_id}", response_model=schemas.GuestResponse)
def update_guest(
    guest_id: str,
    payload: schemas.GuestUpdate,
    x_user_name: str = Header("Boutique Staff"),
    db: Session = Depends(get_db)
):
    guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    update_data = payload.model_dump(exclude_unset=True)
    
    # Handle check-in logging audits
    if "checked_in" in update_data and update_data["checked_in"] != guest.checked_in:
        action_name = "Guest Checked In" if update_data["checked_in"] else "Check-in Cancelled"
        details_text = f"VIP '{guest.name}' arrived at store showroom." if update_data["checked_in"] else f"Removed check-in registration for '{guest.name}'."
        log_activity(db, user=x_user_name, action=action_name, details=details_text)

    for key, val in update_data.items():
        setattr(guest, key, val)

    db.commit()
    db.refresh(guest)
    return guest

@router.delete("/{guest_id}")
def delete_guest(guest_id: str, x_user_name: str = Header("Boutique Staff"), db: Session = Depends(get_db)):
    guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    name = guest.name
    db.delete(guest)
    db.commit()

    log_activity(db, user=x_user_name, action="Removed Guest", details=f"Removed guest profile '{name}'.")
    return {"message": "Guest profile removed successfully."}
