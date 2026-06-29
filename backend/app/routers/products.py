from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from typing import List

router = APIRouter(prefix="/products", tags=["E-Commerce Products"])

@router.get("", response_model=List[schemas.ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@router.get("/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod

@router.post("", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    prod = models.Product(
        title=payload.title,
        description=payload.description,
        price=payload.price,
        category=payload.category,
        image=payload.image,
        stock=payload.stock,
        status=payload.status
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod

@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db)):
    prod = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(prod, key, val)
        
    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(prod)
    db.commit()
    return {"message": "Product deleted successfully"}
