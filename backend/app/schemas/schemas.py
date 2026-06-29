from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, time, datetime

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Optional[str] = "Customer"
    profile_image: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    profile_image: Optional[str] = None

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# JWT Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


# Product Schemas
class ProductBase(BaseModel):
    title: str
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    category: Optional[str] = None
    image: Optional[str] = None
    stock: int = Field(default=0, ge=0)
    status: Optional[str] = "Available"
    branch: Optional[str] = "Mumbai Colaba"

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image: Optional[str] = None
    stock: Optional[int] = None
    status: Optional[str] = None

class ProductResponse(ProductBase):
    id: int

    class Config:
        from_attributes = True


# Order & OrderItem Schemas
class OrderItemBase(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    price: float

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemResponse(OrderItemBase):
    id: int
    order_id: int

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    total: float
    status: Optional[str] = "Pending"
    payment_status: Optional[str] = "Pending"

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None

class OrderResponse(OrderBase):
    id: int
    user_id: str
    created_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True


# Payment Schemas
class PaymentCreate(BaseModel):
    order_id: int
    payment_method: str
    transaction_id: Optional[str] = None
    status: Optional[str] = "Pending"

class PaymentResponse(PaymentCreate):
    id: int

    class Config:
        from_attributes = True


# Review Schemas
class ReviewCreate(BaseModel):
    product_id: int
    rating: int = Field(..., ge=1, le=5)
    review: Optional[str] = None

class ReviewResponse(ReviewCreate):
    id: int
    user_id: str

    class Config:
        from_attributes = True


# Notification Schemas
class NotificationCreate(BaseModel):
    user_id: Optional[str] = None
    title: str
    message: str

class NotificationResponse(BaseModel):
    id: int
    user_id: Optional[str] = None
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- BOUTIQUE EVENT REGISTRY SCHEMAS ---

class EventBase(BaseModel):
    id: str
    name: str
    type: str
    date: date
    time: time
    capacity: int = Field(..., ge=5, le=100)
    designer: str
    notes: Optional[str] = None
    status: Optional[str] = "Upcoming"
    branch: Optional[str] = "Mumbai Colaba"

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    date: Optional[date] = None
    time: Optional[time] = None
    capacity: Optional[int] = None
    designer: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class EventResponse(EventBase):
    created_at: datetime

    class Config:
        from_attributes = True


class GuestBase(BaseModel):
    id: str
    event_id: str
    name: str
    email: EmailStr
    phone: str
    vip: Optional[str] = "Regular"
    rsvp: Optional[str] = "Pending"
    checked_in: Optional[bool] = False
    checkin_time: Optional[str] = None
    notes: Optional[str] = None

class GuestCreate(GuestBase):
    pass

class GuestUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    vip: Optional[str] = None
    rsvp: Optional[str] = None
    checked_in: Optional[bool] = None
    checkin_time: Optional[str] = None
    notes: Optional[str] = None

class GuestResponse(GuestBase):
    created_at: datetime

    class Config:
        from_attributes = True


class RuleResponse(BaseModel):
    key: str
    value: int

    class Config:
        from_attributes = True

class RuleUpdate(BaseModel):
    value: int = Field(..., ge=0)


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    user: str
    action: str
    details: Optional[str] = None

    class Config:
        from_attributes = True
