from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import StreamingResponse
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


UserRole = Literal["admin", "agent"]


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=6, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    role: UserRole = "agent"


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    role: Optional[UserRole] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=120)


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


async def require_admin(user=Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Audit log helper
# ---------------------------------------------------------------------------
async def log_audit(
    action: str,
    *,
    actor_email: str = "system",
    actor_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    target_id: Optional[str] = None,
    summary: str = "",
    meta: Optional[dict] = None,
) -> None:
    entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "actor_email": actor_email,
        "actor_id": actor_id,
        "lead_id": lead_id,
        "target_id": target_id,
        "summary": summary,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.audit_logs.insert_one(entry)


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
    await log_audit(
        "lead.created",
        actor_email="public",
        lead_id=lead["id"],
        summary=f"New lead from {lead['source']}: {lead['name']} <{lead['email']}>",
    )
    # Email notification stub (enabled when SENDGRID_API_KEY is set)
    if os.environ.get("SENDGRID_API_KEY"):
        logger.info(f"[stub] would send SendGrid notification for new lead {lead['id']}")
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


@api_router.get("/leads/export.csv")
async def export_leads_csv(
    status: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    user=Depends(get_current_user),
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
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "name", "email", "phone", "source", "status", "follow_up_at",
                     "notes_count", "created_at", "updated_at", "message"])
    for lead in leads:
        writer.writerow([
            lead.get("id", ""),
            lead.get("name", ""),
            lead.get("email", ""),
            lead.get("phone", ""),
            lead.get("source", ""),
            lead.get("status", ""),
            lead.get("follow_up_at") or "",
            len(lead.get("notes", []) or []),
            lead.get("created_at", ""),
            lead.get("updated_at", ""),
            (lead.get("message") or "").replace("\n", " "),
        ])

    await log_audit(
        "leads.exported",
        actor_email=user.get("email", "admin"),
        actor_id=user.get("id"),
        summary=f"Exported {len(leads)} lead(s) to CSV",
        meta={"filters": {"status": status, "source": source, "q": q}, "count": len(leads)},
    )

    buffer.seek(0)
    filename = f"leads-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, _user=Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@api_router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, payload: LeadUpdate, user=Depends(get_current_user)):
    existing = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.leads.update_one({"id": lead_id}, {"$set": updates})

    actor = user.get("email", "admin")
    if "status" in updates and updates["status"] != existing.get("status"):
        await log_audit(
            "lead.status_changed",
            actor_email=actor,
            actor_id=user.get("id"),
            lead_id=lead_id,
            summary=f"Status changed from {existing.get('status')} to {updates['status']}",
            meta={"from": existing.get("status"), "to": updates["status"]},
        )
    if "follow_up_at" in updates and updates["follow_up_at"] != existing.get("follow_up_at"):
        new_value = updates["follow_up_at"] or None
        await log_audit(
            "lead.followup_set" if new_value else "lead.followup_cleared",
            actor_email=actor,
            actor_id=user.get("id"),
            lead_id=lead_id,
            summary=(f"Follow-up scheduled for {new_value}" if new_value else "Follow-up cleared"),
            meta={"from": existing.get("follow_up_at"), "to": new_value},
        )

    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(require_admin)):
    existing = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.leads.delete_one({"id": lead_id})
    await log_audit(
        "lead.deleted",
        actor_email=user.get("email", "admin"),
        actor_id=user.get("id"),
        lead_id=lead_id,
        summary=f"Lead deleted: {existing.get('name')} <{existing.get('email')}>",
        meta={"snapshot": {k: existing.get(k) for k in ("name", "email", "phone", "source", "status")}},
    )
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
    await log_audit(
        "lead.note_added",
        actor_email=user.get("email", "admin"),
        actor_id=user.get("id"),
        lead_id=lead_id,
        target_id=note["id"],
        summary=f"Note added: {note['text'][:80]}",
    )
    return note


@api_router.delete("/leads/{lead_id}/notes/{note_id}")
async def delete_note(lead_id: str, note_id: str, user=Depends(get_current_user)):
    result = await db.leads.update_one(
        {"id": lead_id},
        {"$pull": {"notes": {"id": note_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    await log_audit(
        "lead.note_deleted",
        actor_email=user.get("email", "admin"),
        actor_id=user.get("id"),
        lead_id=lead_id,
        target_id=note_id,
        summary="Note deleted",
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Audit log endpoints
# ---------------------------------------------------------------------------
@api_router.get("/audit")
async def list_audit(limit: int = 100, _user=Depends(require_admin)):
    limit = max(1, min(500, limit))
    rows = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rows


@api_router.get("/leads/{lead_id}/audit")
async def lead_audit(lead_id: str, _user=Depends(get_current_user)):
    rows = await db.audit_logs.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------
@api_router.get("/users")
async def list_users(_admin=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)
    return users


@api_router.post("/users")
async def create_user(payload: UserCreate, admin=Depends(require_admin)):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="A user with that email already exists")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name.strip(),
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    await log_audit(
        "user.created",
        actor_email=admin.get("email", "admin"),
        actor_id=admin.get("id"),
        target_id=user_doc["id"],
        summary=f"User created: {email} ({payload.role})",
    )
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return user_doc


@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin=Depends(require_admin)):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.role is not None:
        # Prevent demoting the last remaining admin
        if existing.get("role") == "admin" and payload.role != "admin":
            other_admins = await db.users.count_documents({"role": "admin", "id": {"$ne": user_id}})
            if other_admins == 0:
                raise HTTPException(status_code=400, detail="Cannot demote the last admin")
        updates["role"] = payload.role
    if payload.password is not None:
        updates["password_hash"] = hash_password(payload.password)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    await db.users.update_one({"id": user_id}, {"$set": updates})
    await log_audit(
        "user.updated",
        actor_email=admin.get("email", "admin"),
        actor_id=admin.get("id"),
        target_id=user_id,
        summary=f"User updated: {existing['email']} ({', '.join(updates.keys())})",
    )
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    if user_id == admin.get("id"):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    if existing.get("role") == "admin":
        other_admins = await db.users.count_documents({"role": "admin", "id": {"$ne": user_id}})
        if other_admins == 0:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    await db.users.delete_one({"id": user_id})
    await log_audit(
        "user.deleted",
        actor_email=admin.get("email", "admin"),
        actor_id=admin.get("id"),
        target_id=user_id,
        summary=f"User deleted: {existing['email']}",
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# CSV export (must come BEFORE /leads/{lead_id} to avoid route capture)
# ---------------------------------------------------------------------------


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
    await db.audit_logs.create_index("created_at")
    await db.audit_logs.create_index("lead_id")
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
