from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import bcrypt
import asyncio
import google.generativeai as genai

# ============= CONFIG =============
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB setup
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Gemini setup
GEMINI_KEY = os.environ.get("GOOGLE_API_KEY")
if GEMINI_KEY:
    try:
        genai.configure(api_key=GEMINI_KEY)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
    except Exception as e:
        logging.error(f"Error initializing Gemini model: {e}")
        _gemini_model = None
else:
    _gemini_model = None
    logging.warning("⚠️ GOOGLE_API_KEY not set — chatbot will use fallback responses.")

# FastAPI app
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

class ChatRequest(BaseModel):
    message: str
    session_id: str

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
    await db.users.insert_one(user.model_dump())
    return {"message": "User registered successfully", "user_id": user.id}

# ============= DEMO DATA INIT ENDPOINT =============

@api_router.post("/init")
async def initialize_demo_data():
    existing = await db.users.find_one({"username": "admin"})
    if existing:
        return {"message": "Demo data already exists"}

    admin = User(username="admin", password_hash=hash_password("admin123"), role="admin")
    await db.users.insert_one(admin.model_dump())

    demo_user = User(username="demo_user_123", password_hash=hash_password("ElecDemo@2023"))
    await db.users.insert_one(demo_user.model_dump())

    appliances = [
        Appliance(user_id=demo_user.id, name="Refrigerator", power_rating=200, location="Kitchen"),
        Appliance(user_id=demo_user.id, name="Air Conditioner", power_rating=1500, location="Bedroom"),
        Appliance(user_id=demo_user.id, name="Washing Machine", power_rating=500, location="Laundry Room"),
    ]
    for appliance in appliances:
        await db.appliances.insert_one(appliance.model_dump())

    return {"message": "Demo data initialized successfully"}

# ============= CHATBOT ENDPOINT =============
# ============= DASHBOARD DATA ENDPOINT =============

@api_router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str, period: str = "today"):
    """
    Returns demo electricity consumption stats for the dashboard.
    Replace this logic later with actual database aggregation.
    """

    # Example simulated data (you can replace later with real)
    hourly_data = {
        "2025-11-04T00:00:00": 0.5,
        "2025-11-04T01:00:00": 0.7,
        "2025-11-04T02:00:00": 0.8,
        "2025-11-04T03:00:00": 1.0,
        "2025-11-04T04:00:00": 1.2,
        "2025-11-04T05:00:00": 1.4,
    }

    appliance_breakdown = {
        "Refrigerator": 30.5,
        "Air Conditioner": 45.0,
        "Washing Machine": 24.5,
    }

    # Demo calculations
    total_consumption = sum(hourly_data.values())  # in kWh
    avg_daily_usage = total_consumption / 1  # assuming 1 day for demo
    total_cost = total_consumption * 7.5  # ₹7.5 per kWh (example)

    return {
        "total_consumption": round(total_consumption, 2),
        "avg_daily_usage": round(avg_daily_usage, 2),
        "total_cost": round(total_cost, 2),
        "hourly_data": hourly_data,
        "appliance_breakdown": appliance_breakdown,
        "live_usage": 1.6  # demo live value (kW)
    }
# ============= BILL CALCULATOR ENDPOINT =============

@api_router.get("/bill/{user_id}")
async def calculate_bill(user_id: str):
    """
    Simple bill calculator using total consumption and fixed tariff.
    """
    # Fetch user’s usage logs (like dashboard)
    usage_cursor = db.usage_logs.find({"user_id": user_id})
    usage_logs = await usage_cursor.to_list(length=None)

    if not usage_logs:
        return {"message": "No usage data found", "total_units": 0, "bill_amount": 0}

    total_units = sum(log["power_consumed"] for log in usage_logs)
    rate_per_unit = 7.5
    fixed_charge = 50

    bill_amount = (total_units * rate_per_unit) + fixed_charge

    return {
        "total_units": round(total_units, 2),
        "rate_per_unit": rate_per_unit,
        "fixed_charge": fixed_charge,
        "bill_amount": round(bill_amount, 2)
    }


@api_router.post("/chatbot")
async def chatbot(request: ChatRequest):
    """
    E-WIZZ AI Assistant — Gemini-backed with fallback.
    """
    if not _gemini_model:
        return {
            "response": "AI assistant not fully enabled. Add GOOGLE_API_KEY in backend env to activate."
        }

    system_prompt = (
        "You are an electricity monitoring assistant for E-WIZZ. "
        "Help users analyze electricity usage, estimate bills, and give practical energy-saving tips. "
        "When giving numbers, keep them realistic and explain the steps briefly."
    )

    try:
        # Gemini SDK call inside thread for async compatibility
        def _generate():
            return _gemini_model.generate_content([system_prompt, f"User: {request.message}"])

        result = await asyncio.to_thread(_generate)
        text = getattr(result, "text", None) or "I couldn't generate a response right now."
        return {"response": text.strip()}

    except Exception as e:
        logging.error(f"Chatbot error: {e}")
        return {
            "response": "I'm having trouble reaching the AI right now. Please try again in a bit."
        }
# ============= COST PREDICTOR ENDPOINT =============

@api_router.get("/predict/{user_id}")
async def predict_future_cost(user_id: str):
    """
    Predict next month's electricity cost based on past data.
    """
    usage_cursor = db.usage_logs.find({"user_id": user_id})
    usage_logs = await usage_cursor.to_list(length=None)

    if not usage_logs:
        return {"message": "No usage data to predict", "predicted_cost": 0}

    # Average monthly usage
    total_units = sum(log["power_consumed"] for log in usage_logs)
    days_recorded = len(set(log["timestamp"].date() for log in usage_logs))
    avg_daily_usage = total_units / max(days_recorded, 1)

    # Predict next 30 days
    predicted_units = avg_daily_usage * 30
    predicted_cost = predicted_units * 7.5 + 50  # ₹7.5/unit + ₹50 fixed

    return {
        "predicted_units": round(predicted_units, 2),
        "predicted_cost": round(predicted_cost, 2),
        "avg_daily_usage": round(avg_daily_usage, 2)
    }

# ============= ROOT ENDPOINT =============

@api_router.get("/")
async def root():
    return {"message": "E-WIZZ API is running"}

# Attach router
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
