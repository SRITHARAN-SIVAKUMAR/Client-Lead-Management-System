from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------------------------------------------------------------------------
# Config & DB
# ---------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Lead CRM API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
LeadStatus = Literal["new", "contacted", "converted"]
LEAD_SOURCES = ["Website Contact Form", "Referral", "Social Media", "Email Campaign", "Other"]


class LeadCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = None
    source: str = "Website Contact Form"
    message: Optional[str] = None


class LeadUpdate(BaseModel):
    status: Optional[LeadStatus] = None
    follow_up_at: Optional[str] = None  # ISO date string
    name: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None


class NoteCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class LoginPayload(BaseModel):
    email: str
    password: str


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=12 * 3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=7 * 86400, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(payload: LoginPayload, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access = create_access_token(user["id"], user["email"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": user["email"], "name": user.get("name", "Admin"), "role": user.get("role", "admin")}


@api_router.post("/auth/logout")
async def logout(response: Response, _user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Lead endpoints
# ---------------------------------------------------------------------------
@api_router.get("/sources")
async def get_sources():
    return {"sources": LEAD_SOURCES}


@api_router.post("/leads/public")
async def create_public_lead(payload: LeadCreate):
    """Public-facing contact form endpoint (no auth)."""
    lead = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "phone": (payload.phone or "").strip(),
        "source": payload.source or "Website Contact Form",
        "message": (payload.message or "").strip(),
        "status": "new",
        "follow_up_at": None,
        "notes": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.leads.insert_one(lead)
    lead.pop("_id", None)
    return {"ok": True, "lead": lead}


@api_router.get("/leads")
async def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    _user=Depends(get_current_user),
):
    query: dict = {}
    if status and status != "all":
        query["status"] = status
    if source and source != "all":
        query["source"] = source
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return leads


@api_router.get("/leads/stats")
async def lead_stats(_user=Depends(get_current_user)):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    rows = await db.leads.aggregate(pipeline).to_list(10)
    counts = {"new": 0, "contacted": 0, "converted": 0}
    for r in rows:
        if r["_id"] in counts:
            counts[r["_id"]] = r["count"]
    total = sum(counts.values())

    # upcoming follow ups in next 7 days
    today = datetime.now(timezone.utc).date().isoformat()
    week_end = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    upcoming = await db.leads.count_documents(
        {"follow_up_at": {"$gte": today, "$lte": week_end}}
    )

    # by source
    src_pipeline = [{"$group": {"_id": "$source", "count": {"$sum": 1}}}]
    src_rows = await db.leads.aggregate(src_pipeline).to_list(50)
    by_source = [{"source": r["_id"] or "Unknown", "count": r["count"]} for r in src_rows]

    return {"total": total, "counts": counts, "upcoming_follow_ups": upcoming, "by_source": by_source}


@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, _user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@api_router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, payload: LeadUpdate, _user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.leads.update_one({"id": lead_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, _user=Depends(get_current_user)):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


@api_router.post("/leads/{lead_id}/notes")
async def add_note(lead_id: str, payload: NoteCreate, user=Depends(get_current_user)):
    note = {
        "id": str(uuid.uuid4()),
        "text": payload.text.strip(),
        "author": user.get("email", "admin"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.leads.update_one(
        {"id": lead_id},
        {"$push": {"notes": note}, "$set": {"updated_at": note["created_at"]}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return note


@api_router.delete("/leads/{lead_id}/notes/{note_id}")
async def delete_note(lead_id: str, note_id: str, _user=Depends(get_current_user)):
    result = await db.leads.update_one(
        {"id": lead_id},
        {"$pull": {"notes": {"id": note_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Startup: seed admin and indexes
# ---------------------------------------------------------------------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@crm.local").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        logger.info(f"Updated admin password for: {admin_email}")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.leads.create_index("id", unique=True)
    await db.leads.create_index("status")
    await db.leads.create_index("source")
    await db.leads.create_index("created_at")
    await seed_admin()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------------------------------------------------------------------------
# CORS + router
# ---------------------------------------------------------------------------
allowed_origins = [FRONTEND_URL]
if FRONTEND_URL != "http://localhost:3000":
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
