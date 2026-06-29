import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config.config import settings

db_url = settings.DATABASE_URL
engine = None
postgresql_available = False

try:
    import psycopg2
    postgresql_available = True
except ImportError:
    postgresql_available = False

if postgresql_available and ("localhost" in db_url or "127.0.0.1" in db_url):
    try:
        engine = create_engine(db_url, connect_args={"connect_timeout": 2})
        conn = engine.connect()
        conn.close()
        print("[SUCCESS] Connected to local PostgreSQL database.")
    except Exception as e:
        print("[WARNING] PostgreSQL check failed. Falling back to SQLite.")
        db_url = "sqlite:///./tanvi_boutique.db"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    if not postgresql_available and "postgresql" in db_url:
        print("[WARNING] psycopg2 not found. Falling back to SQLite.")
        db_url = "sqlite:///./tanvi_boutique.db"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        if "sqlite" in db_url:
            engine = create_engine(db_url, connect_args={"check_same_thread": False})
        else:
            engine = create_engine(db_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
