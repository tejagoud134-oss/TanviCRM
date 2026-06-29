import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres_tanvi_pwd@localhost:5432/tanvi_boutique"
    JWT_SECRET: str = "super_secret_jwt_key_for_tanvi_boutique_event_suite_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    SEED_ADMIN_NAME: str = "Boutique Admin"
    SEED_ADMIN_EMAIL: str = "admin@tanviboutique.com"
    SEED_ADMIN_PASSWORD: str = "AdminPass123!"

    SEED_STAFF_NAME: str = "Boutique Staff"
    SEED_STAFF_EMAIL: str = "staff@tanviboutique.com"
    SEED_STAFF_PASSWORD: str = "StaffPass123!"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
