from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from typing import List, Dict, Any

router = APIRouter(prefix="/recommendations", tags=["AI Recommendations"])

@router.get("/products", response_model=List[Dict[str, Any]])
def get_product_recommendations(
    guest_id: str = Query(...),
    db: Session = Depends(get_db)
):
    # 1. Fetch guest profile
    guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not guest:
        return []

    # 2. Get guest preferences from notes
    notes = (guest.notes or "").lower()
    
    # 3. Retrieve all products
    products = db.query(models.Product).all()
    recommendations = []

    # 4. Filter products matching keywords or default to top products
    for prod in products:
        title = prod.title.lower()
        desc = (prod.description or "").lower()
        cat = (prod.category or "").lower()
        
        match_score = 0
        reasons = []

        # Check keyword matches
        if "banarasi" in notes and ("banarasi" in title or "banarasi" in desc or "silk" in title):
            match_score += 3
            reasons.append("Matches your preference for traditional Banarasi silk drapes.")
        if "silk" in notes and ("silk" in title or "silk" in desc):
            match_score += 2
            reasons.append("Matches your request for lightweight, premium silk fabrics.")
        if "emerald" in notes and ("emerald" in title or "emerald" in desc or "green" in title):
            match_score += 3
            reasons.append("Selected to complement your requested emerald green color scheme.")
        if "pastel" in notes and ("pastel" in title or "pastel" in desc or "light" in title):
            match_score += 2
            reasons.append("Aligns with your styling preferences for pastel and soft shades.")
        if "velvet" in notes and ("velvet" in title or "velvet" in desc or "heavy" in title):
            match_score += 3
            reasons.append("Selected based on your preference for heavy velvet occasion wear.")
        if "drape" in notes and ("saree" in title or "dupatta" in title):
            match_score += 1
            reasons.append("Perfect options for custom boutique draping sessions.")

        # Default recommendation if no matches but VIP status is elite/gold
        if match_score == 0:
            if guest.vip == "Elite" and prod.price > 100000:
                match_score += 1
                reasons.append("Elite Collection: Curated high-value bridal outfit recommendation.")
            elif guest.vip == "Gold" and 50000 <= prod.price <= 100000:
                match_score += 1
                reasons.append("Gold Collection: Elegant occasion-wear selection matching your VIP status.")
            elif prod.stock > 0:
                match_score += 0.5
                reasons.append("Popular choice: Highly sought-after designer outfit from current runway season.")

        if match_score > 0:
            recommendations.append({
                "product": {
                    "id": prod.id,
                    "title": prod.title,
                    "price": prod.price,
                    "category": prod.category,
                    "image": prod.image,
                    "stock": prod.stock,
                    "status": prod.status
                },
                "score": match_score,
                "reason": reasons[0] if reasons else "Selected for your styling profile."
            })

    # Sort recommendations by match score descending
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    return recommendations[:3] # Return top 3 recommendations
