from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============= MODELS =============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    role: str = "user"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    username: str
    password: str

class Appliance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    power_rating: float
    location: str
    status: str = "OFF"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApplianceCreate(BaseModel):
    name: str
    power_rating: float
    location: str

class ApplianceControl(BaseModel):
    status: str

class UsageLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    appliance_id: str
    timestamp: datetime
    duration_minutes: float
    power_consumed: float

class Tariff(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    fixed_charge: float
    per_unit_charge: float
    effective_from: datetime

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    message: str
    session_id: str

class EcoModeRequest(BaseModel):
    tier: str

# ============= HELPERS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ============= AUTH ENDPOINTS =============

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user_id": user['id'], "username": user['username'], "role": user['role']}

@api_router.post("/auth/register")
async def register(credentials: UserLogin):
    existing = await db.users.find_one({"username": credentials.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(username=credentials.username, password_hash=hash_password(credentials.password))
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    return {"message": "User registered successfully", "user_id": user.id}

# ============= DEMO DATA INIT ENDPOINT =============

@api_router.post("/init")
async def initialize_demo_data():
    # ✅ Check if already initialized
    existing = await db.users.find_one({"username": "admin"})
    if existing:
        return {"message": "Demo data already exists"}

    # Create admin user
    admin = User(
        username="admin",
        password_hash=hash_password("admin123"),
        role="admin"
    )
    await db.users.insert_one(admin.model_dump())

    # Create demo user
    demo_user = User(
        username="demo_user_123",
        password_hash=hash_password("ElecDemo@2023"),
        role="user"
    )
    await db.users.insert_one(demo_user.model_dump())

    # Create demo appliances
    appliances = [
        Appliance(user_id=demo_user.id, name="Refrigerator", power_rating=200, location="Kitchen"),
        Appliance(user_id=demo_user.id, name="Air Conditioner", power_rating=1500, location="Bedroom"),
        Appliance(user_id=demo_user.id, name="Washing Machine", power_rating=500, location="Laundry Room"),
    ]
    for appliance in appliances:
        await db.appliances.insert_one(appliance.model_dump())

    return {"message": "Demo data initialized successfully"}

# ============= CHATBOT (safe fallback) =============

# ============= CHATBOT (OpenAI-based Integration) =============
# ============= CHATBOT (Gemini free-tier) =============
# ============= CHATBOT (Gemini Free-tier Fixed) =============
# ============= CHATBOT (Gemini-Pro, fully compatible) =============
import google.generativeai as genai

GEMINI_KEY = os.environ.get("GOOGLE_API_KEY")
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    _gemini_model = genai.GenerativeModel("gemini-pro")   # ✅ universally available model
else:
    _gemini_model = None
    logging.warning("⚠️ GOOGLE_API_KEY not set — chatbot will use fallback responses.")

@api_router.post("/chatbot")
async def chatbot(request: ChatRequest):
    """E-WIZZ AI Assistant — Gemini-Pro-backed with safe fallback."""
    if not _gemini_model:
        return {"response": "AI assistant disabled. Add GOOGLE_API_KEY to enable."}

    system_prompt = (
        "You are an electricity monitoring assistant for E-WIZZ. "
        "Help users analyze electricity usage, estimate bills, and give practical energy-saving tips."
    )

    try:
        response = _gemini_model.generate_content(
            [system_prompt, f"User: {request.message}"]
        )
        text = getattr(response, "text", None)
        return {"response": text.strip() if text else "I'm sorry, I couldn't generate a reply."}
    except Exception as e:
        logging.error(f"Chatbot error: {e}")
        return {"response": "I'm having trouble reaching the AI right now. Please try again later."}


# ============= ROOT ENDPOINT & ROUTER ATTACH =============

@api_router.get("/")
async def root():
    return {"message": "E-WIZZ API is running"}

# Attach router to FastAPI app
app.include_router(api_router)

# ============= MIDDLEWARE =============

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
