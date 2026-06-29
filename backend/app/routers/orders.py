from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import models
from app.schemas import schemas
from typing import List

router = APIRouter(prefix="/orders", tags=["E-Commerce Orders"])

@router.get("", response_model=List[schemas.OrderResponse])
def get_orders(db: Session = Depends(get_db)):
    return db.query(models.Order).all()

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.post("", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: schemas.OrderCreate, 
    x_user_id: str = Header("usr-customer"), 
    db: Session = Depends(get_db)
):
    total = 0.0
    order_items = []
    
    # Verify inventory and calculate total price
    for item in payload.items:
        prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")
        if prod.stock < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for product '{prod.title}'. Available: {prod.stock}"
            )
        # Deduct stock
        prod.stock -= item.quantity
        
        # Trigger Low Stock notification if below threshold (e.g. 3)
        if prod.stock < 3:
            notif = models.Notification(
                user_id="usr-staff",
                title="Low Inventory Warning",
                message=f"Boutique inventory alert: Product '{prod.title}' (ID {prod.id}) has run low. Current stock: {prod.stock}.",
                is_read=False
            )
            db.add(notif)

        item_total = prod.price * item.quantity
        total += item_total
        
        order_items.append(
            models.OrderItem(
                product_id=item.product_id,
                quantity=item.quantity,
                price=prod.price
            )
        )
        
    new_order = models.Order(
        user_id=x_user_id,
        status="Pending",
        payment_status="Pending",
        total=total,
        items=order_items
    )
    
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@router.put("/{order_id}", response_model=schemas.OrderResponse)
def update_order(order_id: int, payload: schemas.OrderUpdate, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(order, key, val)
        
    db.commit()
    db.refresh(order)
    return order

@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return {"message": "Order deleted successfully"}


from pydantic import BaseModel

class CheckoutPayload(BaseModel):
    payment_method: str
    card_last4: str
from app.services.audit_service import log_activity
import uuid

@router.post("/{order_id}/checkout")
def checkout_order(
    order_id: int,
    payload: CheckoutPayload,
    x_user_name: str = Header("Boutique Staff"),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.payment_status == "Paid":
        return {"message": "Order has already been paid.", "order": order}

    # Generate mock Stripe transaction details
    tx_id = f"ch_{uuid.uuid4().hex[:16]}"
    
    # Create payment record
    pay_record = models.Payment(
        order_id=order.id,
        payment_method=payload.payment_method,
        transaction_id=tx_id,
        status="Success"
    )
    db.add(pay_record)
    
    # Update order statuses
    order.payment_status = "Paid"
    order.status = "Confirmed"
    
    # Audit log
    details_text = f"Captured online payment of INR {order.total} via {payload.payment_method} (Card ending in *{payload.card_last4}) for Order ID {order.id}. Tx ID: {tx_id}."
    log_activity(db, user=x_user_name, action="Order Payment Captured", details=details_text)
    
    db.commit()
    db.refresh(order)
    
    return {
        "status": "success",
        "message": "Payment processed successfully via online gateway integration.",
        "transaction_id": tx_id,
        "amount": order.total,
        "order": order
    }

