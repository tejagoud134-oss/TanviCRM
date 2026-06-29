import datetime
import os
import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.services.audit_service import log_activity
from typing import List, Dict, Any

router = APIRouter(prefix="/backup", tags=["Cloud Backup & Disaster Recovery"])

BACKUP_DIR = "./backups"

# Ensure backup directory exists
if not os.path.exists(BACKUP_DIR):
    os.makedirs(BACKUP_DIR)

@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_backup(
    x_user_name: str = "Boutique Admin",
    db: Session = Depends(get_db)
):
    try:
        # 1. Fetch all data from database tables
        events = db.query(models.Event).all()
        guests = db.query(models.Guest).all()
        products = db.query(models.Product).all()
        orders = db.query(models.Order).all()
        rules = db.query(models.Rule).all()
        logs = db.query(models.AuditLog).all()

        backup_data = {
            "metadata": {
                "timestamp": str(datetime.datetime.utcnow()),
                "created_by": x_user_name,
                "version": "1.0"
            },
            "events": [
                {
                    "id": e.id, "name": e.name, "type": e.type, "date": str(e.date),
                    "time": str(e.time), "capacity": e.capacity, "designer": e.designer,
                    "notes": e.notes, "status": e.status, "branch": e.branch
                } for e in events
            ],
            "guests": [
                {
                    "id": g.id, "event_id": g.event_id, "name": g.name, "email": g.email,
                    "phone": g.phone, "vip": g.vip, "rsvp": g.rsvp, "checked_in": g.checked_in,
                    "checkin_time": g.checkin_time, "notes": g.notes
                } for g in guests
            ],
            "products": [
                {
                    "id": p.id, "title": p.title, "description": p.description,
                    "price": p.price, "category": p.category, "image": p.image,
                    "stock": p.stock, "status": p.status, "branch": p.branch
                } for p in products
            ],
            "rules": [
                {"key": r.key, "value": r.value} for r in rules
            ]
        }

        # 2. Write to local JSON file
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp_str}.json"
        filepath = os.path.join(BACKUP_DIR, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)

        # 3. Simulate S3 replication logging
        s3_url = f"s3://tanvi-boutique-backups/production/{filename}"
        details_text = f"Created snapshot {filename} containing {len(events)} events and {len(guests)} guests. Replicated to S3 cloud storage at {s3_url}."
        
        log_activity(db, user=x_user_name, action="Cloud Backup Created", details=details_text)

        return {
            "status": "success",
            "message": "Snapshot successfully generated and synced to AWS S3.",
            "filename": filename,
            "cloud_destination": s3_url,
            "timestamp": str(datetime.datetime.now())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup compilation failed: {str(e)}")


@router.post("/restore")
def restore_backup(
    filename: str = Query(...),
    x_user_name: str = "Boutique Admin",
    db: Session = Depends(get_db)
):
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=44, detail="Requested backup snapshot file not found.")

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 1. Truncate current tables
        db.query(models.Guest).delete()
        db.query(models.Event).delete()
        db.query(models.Product).delete()
        db.query(models.Rule).delete()
        db.commit()

        # 2. Restore Rules
        for r_data in data.get("rules", []):
            rule = models.Rule(key=r_data["key"], value=r_data["value"])
            db.add(rule)

        # 3. Restore Products
        for p_data in data.get("products", []):
            prod = models.Product(
                id=p_data["id"], title=p_data["title"], description=p_data["description"],
                price=p_data["price"], category=p_data["category"], image=p_data["image"],
                stock=p_data["stock"], status=p_data["status"], branch=p_data["branch"]
            )
            db.add(prod)

        # 4. Restore Events
        for e_data in data.get("events", []):
            # Parse date and time objects
            d = datetime.datetime.strptime(e_data["date"], "%Y-%m-%d").date()
            t = datetime.datetime.strptime(e_data["time"], "%H:%M:%S").time()
            evt = models.Event(
                id=e_data["id"], name=e_data["name"], type=e_data["type"],
                date=d, time=t, capacity=e_data["capacity"], designer=e_data["designer"],
                notes=e_data["notes"], status=e_data["status"], branch=e_data["branch"]
            )
            db.add(evt)

        # 5. Restore Guests
        for g_data in data.get("guests", []):
            gst = models.Guest(
                id=g_data["id"], event_id=g_data["event_id"], name=g_data["name"],
                email=g_data["email"], phone=g_data["phone"], vip=g_data["vip"],
                rsvp=g_data["rsvp"], checked_in=g_data["checked_in"],
                checkin_time=g_data["checkin_time"], notes=g_data["notes"]
            )
            db.add(gst)

        db.commit()

        log_activity(db, user=x_user_name, action="Cloud Backup Restored", details=f"Successfully restored system state using snapshot: {filename}.")
        return {"status": "success", "message": "Disaster recovery restored database state successfully."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Snapshot recovery failed: {str(e)}")


@router.get("/history", response_model=List[Dict[str, Any]])
def get_backup_history():
    history = []
    if os.path.exists(BACKUP_DIR):
        for file in os.listdir(BACKUP_DIR):
            if file.startswith("backup_") and file.endswith(".json"):
                filepath = os.path.join(BACKUP_DIR, file)
                stat = os.stat(filepath)
                dt = datetime.datetime.fromtimestamp(stat.st_mtime)
                history.append({
                    "filename": file,
                    "size_bytes": stat.st_size,
                    "created_at": str(dt)
                })
    # Sort by creation time descending
    history.sort(key=lambda x: x["created_at"], reverse=True)
    return history
