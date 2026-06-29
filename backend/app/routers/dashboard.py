import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
import io
import pandas as pd
from typing import Dict, Any, List

router = APIRouter(tags=["Dashboard & Analytics"])

@router.get("/dashboard")
def get_dashboard_summary(db: Session = Depends(get_db)):
    # 1. Total events and upcoming events
    total_events = db.query(models.Event).count()
    upcoming_events = db.query(models.Event).filter(models.Event.status == "Upcoming").count()
    
    # 2. RSVPs
    total_rsvps = db.query(models.Guest).count()
    confirmed_rsvps = db.query(models.Guest).filter(models.Guest.rsvp == "Confirmed").count()
    
    # 3. Attendance Rate
    live_event = db.query(models.Event).filter(models.Event.status == "Live").first()
    attendance_rate = 0
    attendance_sub = "Based on live events"
    
    if live_event:
        total_expected = db.query(models.Guest).filter(
            models.Guest.event_id == live_event.id,
            models.Guest.rsvp == "Confirmed"
        ).count()
        checked_in = db.query(models.Guest).filter(
            models.Guest.event_id == live_event.id,
            models.Guest.checked_in == True
        ).count()
        attendance_rate = int((checked_in / total_expected * 100)) if total_expected > 0 else 0
        attendance_sub = f"Live: \"{live_event.name}\""
    else:
        completed_events = db.query(models.Event).filter(models.Event.status == "Completed").all()
        if completed_events:
            rates_sum = 0
            for evt in completed_events:
                expected = db.query(models.Guest).filter(
                    models.Guest.event_id == evt.id,
                    models.Guest.rsvp == "Confirmed"
                ).count()
                checks = db.query(models.Guest).filter(
                    models.Guest.event_id == evt.id,
                    models.Guest.checked_in == True
                ).count()
                rates_sum += (checks / expected * 100) if expected > 0 else 0
            attendance_rate = int(rates_sum / len(completed_events))
            attendance_sub = "Historical store events avg"
            
    # 4. Generate alerts via real-time logic
    alerts = []
    today = datetime.date.today()
    mock_reference_date = datetime.date(2026, 6, 12)
    reference_date = today if today > mock_reference_date else mock_reference_date
    
    # Fetch rule thresholds from DB
    vip_warning_percent_rule = db.query(models.Rule).filter(models.Rule.key == "vipWarningPercent").first()
    min_advance_days_rule = db.query(models.Rule).filter(models.Rule.key == "minAdvanceDays").first()
    max_elite_rsvps_rule = db.query(models.Rule).filter(models.Rule.key == "maxEliteRsvps").first()
    
    vip_warn_pct = vip_warning_percent_rule.value if vip_warning_percent_rule else 90
    min_adv_days = min_advance_days_rule.value if min_advance_days_rule else 3
    max_elite_rsvps = max_elite_rsvps_rule.value if max_elite_rsvps_rule else 25
    
    events = db.query(models.Event).all()
    for evt in events:
        confirms = db.query(models.Guest).filter(
            models.Guest.event_id == evt.id,
            models.Guest.rsvp == "Confirmed"
        ).count()
        checkins = db.query(models.Guest).filter(
            models.Guest.event_id == evt.id,
            models.Guest.checked_in == True
        ).count()
        
        # RSVP Overcapacity
        if confirms > evt.capacity:
            alerts.append({
                "id": f"alt-cap-{evt.id}",
                "type": "danger",
                "message": f"Overcapacity Risk: \"{evt.name}\" has {confirms} confirmed RSVPs, exceeding the physical showroom limit of {evt.capacity}.",
                "time": "Generated just now"
            })
            
        # Live Check-in threshold
        alert_threshold = (evt.capacity * vip_warn_pct) / 100
        if evt.status == "Live" and checkins >= alert_threshold:
            alerts.append({
                "id": f"alt-live-{evt.id}",
                "type": "warning",
                "message": f"Boutique Salon Limit Alert: \"{evt.name}\" check-ins ({checkins}/{evt.capacity}) have crossed the {vip_warn_pct}% capacity threshold.",
                "time": "Real-time trigger"
            })
            
        # Elite Guest Load
        elite_confirms = db.query(models.Guest).filter(
            models.Guest.event_id == evt.id,
            models.Guest.rsvp == "Confirmed",
            (models.Guest.vip == "Elite") | (models.Guest.vip == "Gold")
        ).count()
        if (evt.type == "Designer Event" or evt.type == "Trunk Show") and elite_confirms > max_elite_rsvps:
            alerts.append({
                "id": f"alt-elite-{evt.id}",
                "type": "warning",
                "message": f"VIP Load Warning: \"{evt.name}\" has {elite_confirms} Elite/Gold confirmed RSVPs. Max target threshold is set to {max_elite_rsvps}.",
                "time": "Policy checklist trigger"
            })
            
        # Deadline warning
        diff_days = (evt.date - reference_date).days
        if evt.status != "Completed" and diff_days >= 0 and diff_days <= min_adv_days:
            alerts.append({
                "id": f"alt-date-{evt.id}",
                "type": "info",
                "message": f"Upcoming Deadline: \"{evt.name}\" is scheduled in {diff_days} day(s) on {evt.date}. Coordinate final fittings today.",
                "time": "Scheduler trigger"
            })

    return {
        "metrics": {
            "totalEvents": total_events,
            "upcomingEvents": upcoming_events,
            "totalRSVPs": total_rsvps,
            "confirmedRSVPs": confirmed_rsvps,
            "attendanceRate": attendance_rate,
            "attendanceSub": attendance_sub,
            "alertCount": len(alerts)
        },
        "alerts": alerts
    }

@router.get("/analytics")
def get_analytics_trends(db: Session = Depends(get_db)):
    # Return aggregated data for charts
    events = db.query(models.Event).order_by(models.Event.date.asc()).all()
    
    # 1. Conversion Line Chart data
    event_labels = [evt.name for evt in events]
    confirmed_data = []
    checked_in_data = []
    
    for evt in events:
        confirms = db.query(models.Guest).filter(
            models.Guest.event_id == evt.id,
            models.Guest.rsvp == "Confirmed"
        ).count()
        checkins = db.query(models.Guest).filter(
            models.Guest.event_id == evt.id,
            models.Guest.checked_in == True
        ).count()
        confirmed_data.append(confirms)
        checked_in_data.append(checkins)
        
    # 2. Designer Interest Bar Chart
    designers = db.query(models.Event.designer).distinct().all()
    designer_list = [d[0] for d in designers]
    registered_counts = []
    
    for des in designer_list:
        evts = db.query(models.Event).filter(models.Event.designer == des).all()
        evt_ids = [e.id for e in evts]
        guest_count = db.query(models.Guest).filter(models.Guest.event_id.in_(evt_ids)).count()
        registered_counts.append(guest_count)
        
    # 3. Pie distribution counts
    trunk_shows = db.query(models.Event).filter(models.Event.type == "Trunk Show").count()
    private_shops = db.query(models.Event).filter(models.Event.type == "Private Shopping").count()
    designer_events = db.query(models.Event).filter(models.Event.type == "Designer Event").count()

    return {
        "lineChart": {
            "labels": event_labels,
            "confirmed": confirmed_data,
            "checkedIn": checked_in_data
        },
        "barChart": {
            "designers": designer_list,
            "counts": registered_counts
        },
        "pieChart": {
            "trunkShows": trunk_shows,
            "privateShopping": private_shops,
            "designerEvents": designer_events
        }
    }

@router.get("/reports/export")
def export_csv_report(source: str = Query("all"), db: Session = Depends(get_db)):
    output = io.StringIO()
    
    if source == "events":
        events = db.query(models.Event).all()
        data = []
        for evt in events:
            data.append({
                "Event ID": evt.id,
                "Event Name": evt.name,
                "Type": evt.type,
                "Date": str(evt.date),
                "Time": str(evt.time),
                "Capacity Limit": evt.capacity,
                "Designer Label": evt.designer,
                "Status": evt.status
            })
        df = pd.DataFrame(data)
        df.to_csv(output, index=False)
        filename = "boutique_events_registry.csv"
        
    elif source == "guests":
        guests = db.query(models.Guest).all()
        data = []
        for g in guests:
            evt = db.query(models.Event).filter(models.Event.id == g.event_id).first()
            evt_name = evt.name if evt else "Unassigned"
            data.append({
                "Guest ID": g.id,
                "Event Name": evt_name,
                "Guest Name": g.name,
                "Email": g.email,
                "Phone": g.phone,
                "VIP Tier": g.vip,
                "RSVP Status": g.rsvp,
                "Checked In": "Yes" if g.checked_in else "No",
                "Checkin Time": g.checkin_time or "",
                "Styling Preferences": g.notes or ""
            })
        df = pd.DataFrame(data)
        df.to_csv(output, index=False)
        filename = "boutique_guest_rsvps.csv"
        
    else:
        # Full Database Dump
        output.write("=== SYSTEM EVENTS REGISTRY ===\n")
        events = db.query(models.Event).all()
        evt_data = []
        for evt in events:
            evt_data.append({
                "Event ID": evt.id,
                "Event Name": evt.name,
                "Type": evt.type,
                "Date": str(evt.date),
                "Time": str(evt.time),
                "Capacity": evt.capacity,
                "Designer": evt.designer,
                "Status": evt.status
            })
        pd.DataFrame(evt_data).to_csv(output, index=False)
        
        output.write("\n=== CLIENT RSVP REGISTRY ===\n")
        guests = db.query(models.Guest).all()
        gst_data = []
        for g in guests:
            gst_data.append({
                "Guest ID": g.id,
                "Event ID": g.event_id,
                "Guest Name": g.name,
                "Email": g.email,
                "Phone": g.phone,
                "VIP Tier": g.vip,
                "RSVP Status": g.rsvp,
                "Checked In": "Yes" if g.checked_in else "No",
                "Notes": g.notes or ""
            })
        pd.DataFrame(gst_data).to_csv(output, index=False)
        filename = "tanvi_boutique_database_dump.csv"

    # Reset buffer position
    output.seek(0)
    
    response = StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")), 
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response


@router.get("/dashboard/predictive")
def get_predictive_analytics(db: Session = Depends(get_db)):
    events = db.query(models.Event).all()
    guests = db.query(models.Guest).all()
    
    # 1. Turnout predictor calculations
    # Weight confirmations by VIP tier: Elite=95%, Gold=80%, Regular=65%
    total_predicted_turnout = 0
    predictions_per_event = []
    
    for evt in events:
        evt_guests = db.query(models.Guest).filter(models.Guest.event_id == evt.id, models.Guest.rsvp == "Confirmed").all()
        predicted_count = 0.0
        
        for gst in evt_guests:
            if gst.vip == "Elite":
                predicted_count += 0.95
            elif gst.vip == "Gold":
                predicted_count += 0.80
            else:
                predicted_count += 0.65
                
        predicted_count = round(predicted_count, 1)
        overload_risk = "Low"
        if evt.capacity > 0:
            pct = (predicted_count / evt.capacity) * 100
            if pct > 90:
                overload_risk = "Critical"
            elif pct > 75:
                overload_risk = "Medium"
                
        predictions_per_event.append({
            "event_id": evt.id,
            "event_name": evt.name,
            "confirmed_rsvps": len(evt_guests),
            "predicted_attendance": predicted_count,
            "overload_risk": overload_risk,
            "capacity": evt.capacity
        })
        
    # 2. Demand Velocity & Sales forecast based on historical bookings
    designer_growth_rates = {}
    for evt in events:
        g_count = db.query(models.Guest).filter(models.Guest.event_id == evt.id).count()
        designer_growth_rates[evt.designer] = designer_growth_rates.get(evt.designer, 0) + g_count
        
    # Sort designers by demand
    sorted_designers = sorted(designer_growth_rates.items(), key=lambda x: x[1], reverse=True)
    top_predicted_designer = sorted_designers[0][0] if sorted_designers else "None"
    
    # 3. Peak traffic forecasting (predicted busiest times based on start times)
    time_slots = {}
    for evt in events:
        t_hour = evt.time.hour
        time_slots[t_hour] = time_slots.get(t_hour, 0) + 1
        
    peak_hour = max(time_slots, key=time_slots.get) if time_slots else 11
    formatted_peak_time = f"{peak_hour}:00" + (" PM" if peak_hour >= 12 else " AM")
    
    return {
        "turnoutForecast": predictions_per_event,
        "peakTrafficHour": formatted_peak_time,
        "topTrendingDesigner": top_predicted_designer,
        "historicalConfidenceScore": 88 # Mock ML model confidence rating
    }

