from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from typing import List

router = APIRouter(prefix="/reviews", tags=["Product Reviews"])

@router.get("/{product_id}", response_model=List[schemas.ReviewResponse])
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    return db.query(models.Review).filter(models.Review.product_id == product_id).all()

@router.post("", response_model=schemas.ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: schemas.ReviewCreate,
    x_user_id: str = Header("usr-customer"),
    db: Session = Depends(get_db)
):
    # Verify product exists
    prod = db.query(models.Product).filter(models.Product.id == payload.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    rev = models.Review(
        user_id=x_user_id,
        product_id=payload.product_id,
        rating=payload.rating,
        review=payload.review
    )
    db.add(rev)
    db.commit()
    db.refresh(rev)
    return rev

@router.delete("/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db)):
    rev = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(rev)
    db.commit()
    return {"message": "Review deleted successfully"}
