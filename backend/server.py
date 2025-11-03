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
from emergentintegrations.llm.chat import LlmChat, UserMessage
import bcrypt

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
    role: str = "user"  # user or admin
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    username: str
    password: str

class Appliance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    power_rating: float  # in watts
    location: str
    status: str = "OFF"  # ON or OFF
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApplianceCreate(BaseModel):
    name: str
    power_rating: float
    location: str

class ApplianceControl(BaseModel):
    status: str  # ON or OFF

class UsageLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    appliance_id: str
    timestamp: datetime
    duration_minutes: float
    power_consumed: float  # in kWh

class Tariff(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    fixed_charge: float  # monthly fixed charge
    per_unit_charge: float  # per kWh
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
    tier: str  # Standard, Super, Ultra

# ============= HELPER FUNCTIONS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ============= AUTHENTICATION ENDPOINTS =============

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "user_id": user['id'],
        "username": user['username'],
        "role": user['role']
    }

@api_router.post("/auth/register")
async def register(credentials: UserLogin):
    existing = await db.users.find_one({"username": credentials.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=credentials.username,
        password_hash=hash_password(credentials.password)
    )
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    return {"message": "User registered successfully", "user_id": user.id}

# ============= APPLIANCE ENDPOINTS =============

@api_router.get("/appliances/{user_id}", response_model=List[Appliance])
async def get_appliances(user_id: str):
    appliances = await db.appliances.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    for a in appliances:
        if isinstance(a['created_at'], str):
            a['created_at'] = datetime.fromisoformat(a['created_at'])
    return appliances

@api_router.post("/appliances/{user_id}", response_model=Appliance)
async def create_appliance(user_id: str, appliance: ApplianceCreate):
    app_obj = Appliance(
        user_id=user_id,
        name=appliance.name,
        power_rating=appliance.power_rating,
        location=appliance.location
    )
    doc = app_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.appliances.insert_one(doc)
    return app_obj

@api_router.put("/appliances/{appliance_id}/control")
async def control_appliance(appliance_id: str, control: ApplianceControl):
    result = await db.appliances.update_one(
        {"id": appliance_id},
        {"$set": {"status": control.status}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Appliance not found")
    
    # Log usage when turning OFF
    if control.status == "OFF":
        appliance = await db.appliances.find_one({"id": appliance_id}, {"_id": 0})
        # Simulate 1-2 hours of usage
        duration = 90  # minutes
        power_consumed = (appliance['power_rating'] / 1000) * (duration / 60)
        
        usage = UsageLog(
            user_id=appliance['user_id'],
            appliance_id=appliance_id,
            timestamp=datetime.now(timezone.utc),
            duration_minutes=duration,
            power_consumed=power_consumed
        )
        usage_doc = usage.model_dump()
        usage_doc['timestamp'] = usage_doc['timestamp'].isoformat()
        await db.usage_logs.insert_one(usage_doc)
    
    return {"message": "Appliance status updated", "status": control.status}

@api_router.delete("/appliances/{appliance_id}")
async def delete_appliance(appliance_id: str):
    result = await db.appliances.delete_one({"id": appliance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appliance not found")
    return {"message": "Appliance deleted"}

# ============= DASHBOARD ENDPOINTS =============

@api_router.get("/dashboard/{user_id}")
async def get_dashboard_data(user_id: str, period: str = "today"):
    now = datetime.now(timezone.utc)
    
    # Define time ranges
    if period == "yesterday":
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0)
        end = (now - timedelta(days=1)).replace(hour=23, minute=59, second=59)
    elif period == "today":
        start = now.replace(hour=0, minute=0, second=0)
        end = now
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
    elif period == "month":
        start = now - timedelta(days=30)
        end = now
    elif period == "year":
        start = now - timedelta(days=365)
        end = now
    else:
        start = now.replace(hour=0, minute=0, second=0)
        end = now
    
    # Get usage logs
    logs = await db.usage_logs.find({
        "user_id": user_id,
        "timestamp": {"$gte": start.isoformat(), "$lte": end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Calculate totals
    total_consumption = sum(log['power_consumed'] for log in logs)
    
    # Get appliance breakdown
    appliances = await db.appliances.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    appliance_map = {a['id']: a['name'] for a in appliances}
    
    appliance_usage = {}
    for log in logs:
        app_name = appliance_map.get(log['appliance_id'], 'Unknown')
        appliance_usage[app_name] = appliance_usage.get(app_name, 0) + log['power_consumed']
    
    # Hourly data for charts
    hourly_data = {}
    for log in logs:
        ts = datetime.fromisoformat(log['timestamp'])
        hour_key = ts.strftime("%Y-%m-%d %H:00")
        hourly_data[hour_key] = hourly_data.get(hour_key, 0) + log['power_consumed']
    
    return {
        "total_consumption": round(total_consumption, 2),
        "appliance_breakdown": appliance_usage,
        "hourly_data": hourly_data,
        "period": period
    }

# ============= BILL CALCULATION =============

@api_router.get("/bill/{user_id}")
async def calculate_bill(user_id: str):
    # Get current tariff
    tariff = await db.tariffs.find_one({}, {"_id": 0})
    if not tariff:
        # Create default tariff if none exists
        default_tariff = Tariff(
            name="Standard Tariff",
            fixed_charge=50.0,
            per_unit_charge=8.5,
            effective_from=datetime.now(timezone.utc)
        )
        tariff_doc = default_tariff.model_dump()
        tariff_doc['effective_from'] = tariff_doc['effective_from'].isoformat()
        await db.tariffs.insert_one(tariff_doc)
        tariff = tariff_doc
    
    # Get monthly consumption
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0)
    
    logs = await db.usage_logs.find({
        "user_id": user_id,
        "timestamp": {"$gte": start_of_month.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    total_units = sum(log['power_consumed'] for log in logs)
    variable_charge = total_units * tariff['per_unit_charge']
    total_bill = tariff['fixed_charge'] + variable_charge
    
    return {
        "fixed_charge": tariff['fixed_charge'],
        "per_unit_charge": tariff['per_unit_charge'],
        "total_units": round(total_units, 2),
        "variable_charge": round(variable_charge, 2),
        "total_bill": round(total_bill, 2),
        "month": now.strftime("%B %Y")
    }

# ============= COST PREDICTION =============

@api_router.get("/predict/{user_id}")
async def predict_cost(user_id: str):
    # Get last 30 days data
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=30)
    
    logs = await db.usage_logs.find({
        "user_id": user_id,
        "timestamp": {"$gte": start.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    if not logs:
        return {"predicted_monthly_cost": 0, "predicted_units": 0}
    
    # Calculate average daily consumption
    total_consumption = sum(log['power_consumed'] for log in logs)
    days = 30
    avg_daily = total_consumption / days
    predicted_monthly_units = avg_daily * 30
    
    # Get tariff
    tariff = await db.tariffs.find_one({}, {"_id": 0})
    if not tariff:
        tariff = {'fixed_charge': 50.0, 'per_unit_charge': 8.5}
    
    predicted_cost = tariff['fixed_charge'] + (predicted_monthly_units * tariff['per_unit_charge'])
    
    return {
        "predicted_monthly_cost": round(predicted_cost, 2),
        "predicted_units": round(predicted_monthly_units, 2),
        "average_daily_units": round(avg_daily, 2)
    }

# ============= ECO MODE =============

@api_router.post("/eco-mode/{user_id}")
async def get_eco_recommendations(user_id: str, request: EcoModeRequest):
    appliances = await db.appliances.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    
    recommendations = []
    
    if request.tier == "Standard":
        recommendations = [
            "Turn off lights when not in use",
            "Use natural light during daytime",
            "Unplug chargers when not charging"
        ]
    elif request.tier == "Super":
        high_power = [a for a in appliances if a['power_rating'] > 1000]
        recommendations = [
            f"Reduce usage of {a['name']} (High power: {a['power_rating']}W)" for a in high_power[:3]
        ]
        recommendations.append("Use energy-efficient LED bulbs")
        recommendations.append("Set AC temperature to 24°C or higher")
    elif request.tier == "Ultra":
        recommendations = [
            "Schedule high-power appliances during off-peak hours",
            "Install solar panels for renewable energy",
            "Use smart power strips to eliminate phantom loads",
            "Upgrade to ENERGY STAR rated appliances",
            "Implement smart home automation for optimal energy use"
        ]
    
    return {"tier": request.tier, "recommendations": recommendations}

# ============= AI CHATBOT =============

@api_router.post("/chatbot")
async def chatbot(request: ChatRequest):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=request.session_id,
            system_message="You are an electricity monitoring assistant for E-WIZZ. Help users with queries about electricity consumption, bill calculations, energy saving tips, and appliance management."
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)
        
        return {"response": response}
    except Exception as e:
        logging.error(f"Chatbot error: {str(e)}")
        return {"response": "I'm having trouble connecting right now. Please try again later."}

# ============= ADMIN ENDPOINTS =============

@api_router.get("/admin/users")
async def get_all_users():
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@api_router.post("/admin/tariff")
async def update_tariff(tariff: Tariff):
    tariff_doc = tariff.model_dump()
    tariff_doc['effective_from'] = tariff_doc['effective_from'].isoformat()
    await db.tariffs.delete_many({})  # Remove old tariffs
    await db.tariffs.insert_one(tariff_doc)
    return {"message": "Tariff updated"}

# ============= INITIALIZATION =============

@api_router.post("/init")
async def initialize_demo_data():
    # Check if demo user exists
    demo_user = await db.users.find_one({"username": "demo_user_123"})
    if not demo_user:
        # Create demo user
        demo = User(
            username="demo_user_123",
            password_hash=hash_password("ElecDemo@2023"),
            role="user"
        )
        demo_doc = demo.model_dump()
        demo_doc['created_at'] = demo_doc['created_at'].isoformat()
        await db.users.insert_one(demo_doc)
        
        # Create demo appliances
        demo_appliances = [
            {"name": "Living Room AC", "power_rating": 1500, "location": "Living Room"},
            {"name": "Refrigerator", "power_rating": 200, "location": "Kitchen"},
            {"name": "LED TV", "power_rating": 120, "location": "Living Room"},
            {"name": "Water Heater", "power_rating": 2000, "location": "Bathroom"},
            {"name": "Washing Machine", "power_rating": 500, "location": "Utility"}
        ]
        
        for app_data in demo_appliances:
            app = Appliance(
                user_id=demo.id,
                name=app_data['name'],
                power_rating=app_data['power_rating'],
                location=app_data['location']
            )
            app_doc = app.model_dump()
            app_doc['created_at'] = app_doc['created_at'].isoformat()
            await db.appliances.insert_one(app_doc)
            
            # Create sample usage logs
            for i in range(10):
                usage = UsageLog(
                    user_id=demo.id,
                    appliance_id=app.id,
                    timestamp=datetime.now(timezone.utc) - timedelta(hours=i*5),
                    duration_minutes=60 + (i * 10),
                    power_consumed=(app_data['power_rating'] / 1000) * ((60 + (i * 10)) / 60)
                )
                usage_doc = usage.model_dump()
                usage_doc['timestamp'] = usage_doc['timestamp'].isoformat()
                await db.usage_logs.insert_one(usage_doc)
    
    # Create admin user
    admin_user = await db.users.find_one({"username": "admin"})
    if not admin_user:
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        admin_doc = admin.model_dump()
        admin_doc['created_at'] = admin_doc['created_at'].isoformat()
        await db.users.insert_one(admin_doc)
    
    return {"message": "Demo data initialized"}

# ============= ROOT ENDPOINT =============

@api_router.get("/")
async def root():
    return {"message": "E-WIZZ API is running"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()