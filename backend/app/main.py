import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine, Base, SessionLocal
from app.models import models
from app.routers import auth, events, guests, rules, audit_logs, products, orders, reviews, notifications, dashboard, recommendations, backup

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Tanvi Boutique Management Suite",
    description="Python FastAPI backend handling database records, rules engine, and CSV reports.",
    version="1.0.0"
)

# Enable CORS for gateway communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(guests.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(audit_logs.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(backup.router, prefix="/api")

@app.on_event("startup")
def startup_populate():
    db = SessionLocal()
    try:
        # Seed rules
        default_rules = {
            "vipWarningPercent": 90,
            "minAdvanceDays": 3,
            "maxEliteRsvps": 25
        }
        for key, val in default_rules.items():
            rule = db.query(models.Rule).filter(models.Rule.key == key).first()
            if not rule:
                rule = models.Rule(key=key, value=val)
                db.add(rule)
        
        # Seed admin user
        admin = db.query(models.User).filter(models.User.email == "admin@tanviboutique.com").first()
        if not admin:
            admin = models.User(
                id="usr-admin",
                name="Boutique Admin",
                email="admin@tanviboutique.com",
                phone="+91 99999 88888",
                password="$2b$10$fg3kAws1ZyJfsSpWLSDyNebj7GpKaSJTv3FCzgH4X5kR5UORFIISS", # bcrypt hash of 'AdminPass123!'
                role="Admin",
                profile_image=""
            )
            db.add(admin)

        # Seed staff user
        staff = db.query(models.User).filter(models.User.email == "staff@tanviboutique.com").first()
        if not staff:
            staff = models.User(
                id="usr-staff",
                name="Boutique Staff",
                email="staff@tanviboutique.com",
                phone="+91 99999 77777",
                password="$2b$10$PZtOSZGz6MrhLMa43b0H0OVPhE1Xp5Y.qoHOjZx85/ZzK4k8b9ZgK", # bcrypt hash of 'StaffPass123!'
                role="Staff",
                profile_image=""
            )
            db.add(staff)
            
        # Seed default events if database is empty to match mock experience
        events_count = db.query(models.Event).count()
        if events_count == 0:
            db_events = [
                models.Event(
                    id="evt-01",
                    name="Sabyasachi Heritage Trunk Show",
                    type="Trunk Show",
                    date=datetime.date(2026, 6, 15),
                    time=datetime.time(14, 0),
                    capacity=30,
                    designer="Sabyasachi Mukherjee",
                    notes="Exquisite heritage zardozi, handwoven Banarasi sarees, and gold bridal lehengas. Premium high-security jewelry trunk on-site.",
                    status="Upcoming",
                    branch="Mumbai Colaba"
                ),
                models.Event(
                    id="evt-02",
                    name="Private Silk Styling Consultation",
                    type="Private Shopping",
                    date=datetime.date(2026, 6, 20),
                    time=datetime.time(11, 0),
                    capacity=8,
                    designer="Raw Mango & Ekaya Banaras",
                    notes="One-on-one draping styling consultations for selected Gold & Elite members. Focusing on lightweight summer silks.",
                    status="Upcoming",
                    branch="Mumbai Colaba"
                ),
                models.Event(
                    id="evt-03",
                    name="Ritu Kumar Fusion Launch Party",
                    type="Designer Event",
                    date=datetime.date(2026, 6, 12),
                    time=datetime.time(10, 0),
                    capacity=25,
                    designer="Ritu Kumar",
                    notes="Cocktails and designer preview showcase for modern fusion silhouettes, print collections, and light occasion wear.",
                    status="Live",
                    branch="Delhi Mehrauli"
                ),
                models.Event(
                    id="evt-04",
                    name="Manish Malhotra Occasion Showcase",
                    type="Designer Event",
                    date=datetime.date(2026, 6, 2),
                    time=datetime.time(16, 0),
                    capacity=40,
                    designer="Manish Malhotra",
                    notes="Velvet sherwanis, sequence sarees, and bespoke bridesmaid styling day. Concluded with high sales rate.",
                    status="Completed",
                    branch="Hyderabad Banjara"
                )
            ]
            db.add_all(db_events)
            
            # Seed default products
            db_products = [
                models.Product(
                    id=1,
                    title="Sabyasachi Heritage Banarasi Saree",
                    price=250000.0,
                    category="Saree",
                    stock=2,
                    image="https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500",
                    description="Exquisite handwoven Banarasi silk saree with authentic zardozi embroidery.",
                    status="Available",
                    branch="Mumbai Colaba"
                ),
                models.Product(
                    id=2,
                    title="Raw Mango Lightweight Organza Saree",
                    price=45000.0,
                    category="Saree",
                    stock=5,
                    image="https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=500",
                    description="Sheer organza saree with delicate floral motifs, perfect for summer styling.",
                    status="Available",
                    branch="Mumbai Colaba"
                ),
                models.Product(
                    id=3,
                    title="Ritu Kumar Printed Fusion Gown",
                    price=35000.0,
                    category="Gown",
                    stock=8,
                    image="https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500",
                    description="Modern print fusion gown combining traditional embroidery with contemporary cuts.",
                    status="Available",
                    branch="Delhi Mehrauli"
                ),
                models.Product(
                    id=4,
                    title="Manish Malhotra Velvet Sherwani",
                    price=180000.0,
                    category="Sherwani",
                    stock=1,
                    image="https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500",
                    description="Deep maroon velvet groom's sherwani with intricate gold thread workmanship.",
                    status="Available",
                    branch="Hyderabad Banjara"
                )
            ]
            db.add_all(db_products)

            # Seed default guests
            db_guests = [
                models.Guest(id="gst-01", event_id="evt-01", name="Radhika Merchant", email="radhika@ambani.in", phone="+91 99999 11111", vip="Elite", rsvp="Confirmed", checked_in=False, checkin_time=None, notes="Requested emerald green drape match. High-priority fitting salon booking."),
                models.Guest(id="gst-02", event_id="evt-01", name="Isha Ambani", email="isha@reliance.com", phone="+91 99999 22222", vip="Elite", rsvp="Confirmed", checked_in=False, checkin_time=None, notes="Requires direct assistance from lead showroom drape stylist."),
                models.Guest(id="gst-03", event_id="evt-01", name="Shloka Mehta", email="shloka@rozi.in", phone="+91 99999 33333", vip="Elite", rsvp="Pending", checked_in=False, checkin_time=None, notes="Checking Banarasi collection previews."),
                models.Guest(id="gst-04", event_id="evt-01", name="Kareena Kapoor", email="kareena.k@bollywood.com", phone="+91 98200 44444", vip="Gold", rsvp="Confirmed", checked_in=False, checkin_time=None, notes="Prefers deep neck blouses, pastel shades."),
                models.Guest(id="gst-05", event_id="evt-02", name="Nita Ambani", email="nita@reliance.com", phone="+91 99999 00000", vip="Elite", rsvp="Confirmed", checked_in=False, checkin_time=None, notes="Elite slot. Inquiring about traditional hand-drawn kalamkari fabrics."),
                models.Guest(id="gst-06", event_id="evt-02", name="Mira Rajput", email="mira.r@kapoor.co", phone="+91 98199 55555", vip="Gold", rsvp="Confirmed", checked_in=False, checkin_time=None, notes="Interested in contemporary pastel fusion sarees."),
                models.Guest(id="gst-07", event_id="evt-03", name="Alia Bhatt", email="alia@kapoor.com", phone="+91 98111 66666", vip="Elite", rsvp="Confirmed", checked_in=True, checkin_time="10:15", notes="Prefers organic cotton prints and light flowy fusion silhouettes."),
                models.Guest(id="gst-08", event_id="evt-03", name="Kiara Advani", email="kiara@advani.com", phone="+91 98222 77777", vip="Elite", rsvp="Confirmed", checked_in=True, checkin_time="10:22", notes="Assigned designer suite #2. Interested in zardozi overlays."),
                models.Guest(id="gst-09", event_id="evt-03", name="Deepika Padukone", email="deepika@padukone.co.in", phone="+91 98333 88888", vip="Elite", rsvp="Confirmed", checked_in=True, checkin_time="10:05", notes="Pregnant collection draping assistance. Prefers comfortable silk fabrics."),
                models.Guest(id="gst-10", event_id="evt-03", name="Sonam Kapoor", email="sonam@ahuja.com", phone="+91 98444 99999", vip="Gold", rsvp="Confirmed", checked_in=False, checkin_time=None, notes="Running late. High-fashion custom fittings request."),
                models.Guest(id="gst-11", event_id="evt-03", name="Ananya Panday", email="ananya@panday.co", phone="+91 98555 00000", vip="Regular", rsvp="Confirmed", checked_in=True, checkin_time="10:45", notes="Social media buzz photo opt scheduled."),
                models.Guest(id="gst-12", event_id="evt-03", name="Janhvi Kapoor", email="janhvi@kapoor.co", phone="+91 98666 11111", vip="Regular", rsvp="Confirmed", checked_in=False, checkin_time=None, notes="Attending launch photoshoot."),
                models.Guest(id="gst-13", event_id="evt-04", name="Kriti Sanon", email="kriti@sanon.in", phone="+91 98777 22222", vip="Gold", rsvp="Confirmed", checked_in=True, checkin_time="16:15", notes="Purchased heavy velvet bridal gown. Outstanding client feedback."),
                models.Guest(id="gst-14", event_id="evt-04", name="Katrina Kaif", email="katrina@vicky.com", phone="+91 98888 33333", vip="Elite", rsvp="Confirmed", checked_in=True, checkin_time="16:05", notes="Purchased customized pastel saree collection.")
            ]
            db.add_all(db_guests)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Tanvi Boutique Event & Trunk Show API Server!"}
