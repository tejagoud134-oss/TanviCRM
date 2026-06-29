from fastapi.testclient import TestClient
from app.main import app
import pytest

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Tanvi Boutique Event & Trunk Show API Server!"}

def test_auth_profile_missing():
    # Attempting to fetch non-existent user profile
    response = client.get("/api/auth/profile/nonexistent")
    assert response.status_code == 404

def test_events_list():
    response = client.get("/api/events")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_guests_list():
    response = client.get("/api/guests")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_rules_list():
    response = client.get("/api/rules")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) > 0
