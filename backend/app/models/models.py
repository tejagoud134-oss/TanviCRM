import datetime
from sqlalchemy import Column, String, Integer, Boolean, Float, ForeignKey, DateTime, Date, Time, Text
from sqlalchemy.orm import relationship
from app.database.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="Customer") # Admin, Staff, Customer
    profile_image = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    orders = relationship("Order", back_populates="user")
    reviews = relationship("Review", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    category = Column(String(100), nullable=True)
    image = Column(String(255), nullable=True)
    stock = Column(Integer, default=0)
    status = Column(String(50), default="Available") # Available, Out of Stock
    branch = Column(String(100), default="Mumbai Colaba")

    # Relationships
    order_items = relationship("OrderItem", back_populates="product")
    reviews = relationship("Review", back_populates="product")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), ForeignKey("users.id"))
    status = Column(String(50), default="Pending") # Pending, Confirmed, Shipped, Delivered, Cancelled
    payment_status = Column(String(50), default="Pending") # Pending, Paid, Failed
    total = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)

    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"))
    payment_method = Column(String(100), nullable=False)
    transaction_id = Column(String(255), nullable=True)
    status = Column(String(50), default="Pending")

    # Relationships
    order = relationship("Order", back_populates="payments")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    rating = Column(Integer, nullable=False)
    review = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="reviews")
    product = relationship("Product", back_populates="reviews")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), ForeignKey("users.id"), nullable=True) # Nullable for broadcast alerts
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")


# --- BOUTIQUE EVENT SYSTEMS MODELS ---

class Event(Base):
    __tablename__ = "events"

    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    time = Column(Time, nullable=False)
    capacity = Column(Integer, nullable=False)
    designer = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="Upcoming") # Upcoming, Live, Completed, Cancelled
    branch = Column(String(100), default="Mumbai Colaba")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    guests = relationship("Guest", back_populates="event", cascade="all, delete-orphan")


class Guest(Base):
    __tablename__ = "guests"

    id = Column(String(100), primary_key=True)
    event_id = Column(String(100), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    vip = Column(String(50), default="Regular") # Elite, Gold, Regular
    rsvp = Column(String(50), default="Pending") # Confirmed, Pending, Declined
    checked_in = Column(Boolean, default=False)
    checkin_time = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    event = relationship("Event", back_populates="guests")


class Rule(Base):
    __tablename__ = "rules"

    key = Column(String(100), primary_key=True)
    value = Column(Integer, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
