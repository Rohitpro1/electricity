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
from datetime import datetime, timezone, timedelta
import bcrypt
import asyncio
import google.generativeai as genai
from random import randint, uniform


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
from fastapi import Body

@api_router.put("/appliances/{appliance_id}/control")
async def control_appliance(appliance_id: str, data: dict = Body(...)):
    """
    Turn appliance ON/OFF
    """
    new_status = data.get("status")
    if new_status not in ["ON", "OFF"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    result = await db.appliances.update_one(
        {"id": appliance_id},
        {"$set": {"status": new_status}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Appliance not found")

    return {"message": f"Appliance turned {new_status}"}
# ================= APPLIANCE ENDPOINTS ==================

from fastapi import Body

@api_router.get("/appliances/{user_id}")
async def get_appliances(user_id: str):
    appliances = await db.appliances.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    return {"appliances": appliances}

@api_router.post("/appliances/{user_id}")
async def add_appliance(user_id: str, data: dict = Body(...)):
    """
    Add new appliance for a given user
    """
    name = data.get("name")
    power_rating = data.get("power_rating")
    location = data.get("location")

    if not name or not power_rating:
        raise HTTPException(status_code=400, detail="Missing required fields")

    appliance = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": name,
        "power_rating": float(power_rating),
        "location": location or "Unknown",
        "status": "OFF",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.appliances.insert_one(appliance)
    return {"message": "Appliance added successfully", "appliance": appliance}
    from random import randint, uniform

from datetime import datetime, timezone, timedelta
from random import randint, uniform

@api_router.post("/generate-usage/{user_id}")
async def generate_usage(user_id: str):
    """
    Adds random demo usage logs for testing bill calculation.
    """
    logs = []
    now = datetime.now(timezone.utc)

    for i in range(15):  # 15 sample usage logs for past days
        log = {
            "user_id": user_id,
            "appliance_id": f"appliance-{i}",
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "duration_minutes": randint(30, 120),
            "power_consumed": round(uniform(0.5, 3.0), 2)  # in kWh
        }
        # ✅ insert into the same collection used by /bill
        await db.usage_logs.insert_one(log)
        logs.append(log)

    return {"message": "Demo usage logs added", "count": len(logs)}

@api_router.get("/bill/{user_id}")
async def get_bill(user_id: str):
    """
    Calculates electricity bill using BESCOM LT2A domestic tariff.
    Compatible with frontend values.
    """

    # Fetch all usage logs from the correct collection
    usage_logs = await db.usage_logs.find({"user_id": user_id}).to_list(length=None)

    # If no usage data found
    if not usage_logs or len(usage_logs) == 0:
        return {
            "message": "No usage data found",
            "fixed_charge": 80,
            "per_unit_charge": 6,
            "total_units": 0,
            "variable_charge": 0,
            "total_bill": 0
        }

    # Total energy consumed in kWh
    total_units = sum(log.get("power_consumed", 0) for log in usage_logs)

    # Apply BESCOM tariff
    remaining = total_units
    variable_charge = 0.0
    fixed_charge = 0
    per_unit_charge = 0.0

    if remaining <= 50:
        variable_charge = remaining * 4.15
        fixed_charge = 60
        per_unit_charge = 4.15
    elif remaining <= 100:
        variable_charge = (50 * 4.15) + ((remaining - 50) * 5.60)
        fixed_charge = 80
        per_unit_charge = 5.60
    elif remaining <= 200:
        variable_charge = (50 * 4.15) + (50 * 5.60) + ((remaining - 100) * 7.15)
        fixed_charge = 100
        per_unit_charge = 7.15
    else:
        variable_charge = (
            (50 * 4.15)
            + (50 * 5.60)
            + (100 * 7.15)
            + ((remaining - 200) * 8.20)
        )
        fixed_charge = 120
        per_unit_charge = 8.20

    # Calculate total bill
    total_bill = fixed_charge + variable_charge

    # Return data formatted for frontend
    return {
        "message": "Bill calculated successfully",
        "fixed_charge": round(fixed_charge, 2),
        "per_unit_charge": round(per_unit_charge, 2),
        "total_units": round(total_units, 2),
        "variable_charge": round(variable_charge, 2),
        "total_bill": round(total_bill, 2)
    }
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

# ============= BILL CALCULATOR ENDPOINT (with BESCOM tariff) =============

@api_router.get("/bill/{user_id}")
async def calculate_bill(user_id: str):
    """
    Calculates bill based on BESCOM LT2A slab rates.
    """
    # Fetch user's usage logs
    usage_cursor = db.usage_logs.find({"user_id": user_id})
    usage_logs = await usage_cursor.to_list(length=None)

    if not usage_logs:
        return {"message": "No usage data found", "total_units": 0, "bill_amount": 0}

    # Total units consumed
    total_units = sum(log["power_consumed"] for log in usage_logs)

    # Apply BESCOM tariff
    remaining = total_units
    bill_amount = 0.0

    if remaining <= 50:
        bill_amount = remaining * 4.15
        fixed_charge = 60
    elif remaining <= 100:
        bill_amount = (50 * 4.15) + ((remaining - 50) * 5.60)
        fixed_charge = 80
    elif remaining <= 200:
        bill_amount = (50 * 4.15) + (50 * 5.60) + ((remaining - 100) * 7.15)
        fixed_charge = 100
    else:
        bill_amount = (50 * 4.15) + (50 * 5.60) + (100 * 7.15) + ((remaining - 200) * 8.20)
        fixed_charge = 120

    total_bill = bill_amount + fixed_charge

    return {
        "total_units": round(total_units, 2),
        "bill_amount": round(bill_amount, 2),
        "fixed_charge": fixed_charge,
        "total_payable": round(total_bill, 2),
        "tariff_type": "BESCOM LT2A Domestic"
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
    Predicts next month's electricity cost using BESCOM LT2A domestic tariff.
    Compatible with existing frontend field names.
    """

    usage_logs = await db.usage_logs.find({"user_id": user_id}).to_list(length=None)

    if not usage_logs or len(usage_logs) == 0:
        return {
            "message": "No usage data to predict",
            "predicted_monthly_cost": 0,
            "predicted_units": 0,
            "average_daily_units": 0,
            "tariff_type": "BESCOM LT2A Domestic"
        }

    # --- Step 1: Calculate total units and daily average ---
    total_units = sum(log.get("power_consumed", 0) for log in usage_logs)

    unique_days = len({
        datetime.fromisoformat(log["timestamp"]).date()
        for log in usage_logs if "timestamp" in log
    })
    avg_daily_usage = total_units / max(unique_days, 1)

    # --- Step 2: Predict next month's consumption ---
    predicted_units = avg_daily_usage * 30

    # --- Step 3: Apply BESCOM Tariff ---
    def calculate_bescom_bill(units: float) -> float:
        if units <= 50:
            return units * 4.15 + 60
        elif units <= 100:
            return (50 * 4.15) + ((units - 50) * 5.60) + 80
        elif units <= 200:
            return (50 * 4.15) + (50 * 5.60) + ((units - 100) * 7.15) + 100
        else:
            return (50 * 4.15) + (50 * 5.60) + (100 * 7.15) + ((units - 200) * 8.20) + 120

    predicted_cost = calculate_bescom_bill(predicted_units)

    # --- Step 4: Return frontend-matching keys ---
    return {
        "message": "Prediction calculated successfully",
        "predicted_monthly_cost": round(predicted_cost, 2),
        "predicted_units": round(predicted_units, 2),
        "average_daily_units": round(avg_daily_usage, 2),
        "tariff_type": "BESCOM LT2A Domestic"
    }

# ============= ROOT ENDPOINT =============

@api_router.get("/")
async def root():
    return {"message": "E-WIZZ API is running"}

# Attach router
app.include_router(api_router)

# ============= MIDDLEWARE =============

from starlette.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://electricity-omega.vercel.app",  # ✅ your frontend domain
        "http://localhost:3000",                 # ✅ for local testing
        "https://electricity-lill.onrender.com"  # ✅ backend itself (optional)
    ],
    allow_credentials=True,
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
