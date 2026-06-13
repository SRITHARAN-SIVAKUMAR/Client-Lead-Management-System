"""Backend API tests for Lead CRM"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lead-manager-134.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@crm.local"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="session")
def public_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


# ----- Health & sources -----
class TestBasic:
    def test_health(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_sources(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/sources")
        assert r.status_code == 200
        srcs = r.json()["sources"]
        assert isinstance(srcs, list) and "Website Contact Form" in srcs


# ----- Auth -----
class TestAuth:
    def test_login_success(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_login_invalid(self, public_session):
        r = public_session.post(f"{BASE_URL}/api/auth/login",
                                json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_authenticated(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_leads_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/leads")
        assert r.status_code == 401


# ----- Public Leads -----
class TestPublicLeads:
    def test_create_public_lead(self, public_session):
        payload = {
            "name": "TEST_Public User",
            "email": f"test_pub_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+1 555 0100",
            "source": "Website Contact Form",
            "message": "Hello there",
        }
        r = public_session.post(f"{BASE_URL}/api/leads/public", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        lead = data["lead"]
        assert lead["status"] == "new"
        assert lead["email"] == payload["email"]
        assert "_id" not in lead
        assert "id" in lead


# ----- Admin Lead CRUD -----
class TestLeadCrud:
    @pytest.fixture
    def lead_id(self, admin_session, public_session):
        payload = {
            "name": "TEST_Crud Lead",
            "email": f"test_crud_{uuid.uuid4().hex[:6]}@example.com",
            "source": "Referral",
            "message": "Sample inbound",
        }
        r = public_session.post(f"{BASE_URL}/api/leads/public", json=payload)
        assert r.status_code == 200
        return r.json()["lead"]["id"]

    def test_list_leads(self, admin_session, lead_id):
        r = admin_session.get(f"{BASE_URL}/api/leads")
        assert r.status_code == 200
        leads = r.json()
        assert any(l["id"] == lead_id for l in leads)

    def test_list_with_filters(self, admin_session, lead_id):
        r = admin_session.get(f"{BASE_URL}/api/leads", params={"status": "new", "source": "Referral"})
        assert r.status_code == 200
        leads = r.json()
        assert all(l["status"] == "new" and l["source"] == "Referral" for l in leads)

    def test_search_query(self, admin_session, lead_id):
        r = admin_session.get(f"{BASE_URL}/api/leads", params={"q": "TEST_Crud"})
        assert r.status_code == 200
        assert any(l["id"] == lead_id for l in r.json())

    def test_get_lead(self, admin_session, lead_id):
        r = admin_session.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert r.status_code == 200
        assert r.json()["id"] == lead_id

    def test_update_status(self, admin_session, lead_id):
        r = admin_session.patch(f"{BASE_URL}/api/leads/{lead_id}", json={"status": "contacted"})
        assert r.status_code == 200
        assert r.json()["status"] == "contacted"
        # Verify persistence
        g = admin_session.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert g.json()["status"] == "contacted"

    def test_set_followup(self, admin_session, lead_id):
        r = admin_session.patch(f"{BASE_URL}/api/leads/{lead_id}", json={"follow_up_at": "2026-12-25"})
        assert r.status_code == 200
        assert r.json()["follow_up_at"] == "2026-12-25"

    def test_clear_followup(self, admin_session, lead_id):
        # Set then clear by empty string
        admin_session.patch(f"{BASE_URL}/api/leads/{lead_id}", json={"follow_up_at": "2026-12-25"})
        r = admin_session.patch(f"{BASE_URL}/api/leads/{lead_id}", json={"follow_up_at": ""})
        assert r.status_code == 200
        # Empty string is falsy in frontend; backend stores ""
        assert r.json()["follow_up_at"] in ("", None)

    def test_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/leads/stats")
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "counts" in d and "by_source" in d
        assert set(["new", "contacted", "converted"]).issubset(d["counts"].keys())

    def test_get_404(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/leads/{uuid.uuid4()}")
        assert r.status_code == 404


# ----- Notes -----
class TestNotes:
    @pytest.fixture
    def lead_id(self, admin_session, public_session):
        payload = {"name": "TEST_Note Lead", "email": f"test_note_{uuid.uuid4().hex[:6]}@example.com"}
        r = public_session.post(f"{BASE_URL}/api/leads/public", json=payload)
        return r.json()["lead"]["id"]

    def test_add_note(self, admin_session, lead_id):
        r = admin_session.post(f"{BASE_URL}/api/leads/{lead_id}/notes", json={"text": "First note"})
        assert r.status_code == 200
        n = r.json()
        assert n["text"] == "First note"
        assert n["author"] == ADMIN_EMAIL
        # Verify it shows up
        g = admin_session.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert any(x["id"] == n["id"] for x in g.json()["notes"])

    def test_delete_note(self, admin_session, lead_id):
        r = admin_session.post(f"{BASE_URL}/api/leads/{lead_id}/notes", json={"text": "Delete me"})
        nid = r.json()["id"]
        d = admin_session.delete(f"{BASE_URL}/api/leads/{lead_id}/notes/{nid}")
        assert d.status_code == 200
        g = admin_session.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert all(x["id"] != nid for x in g.json()["notes"])


# ----- Delete Lead -----
class TestDeleteLead:
    def test_delete_lead(self, admin_session, public_session):
        r = public_session.post(f"{BASE_URL}/api/leads/public",
                                json={"name": "TEST_Delete", "email": f"test_del_{uuid.uuid4().hex[:6]}@x.com"})
        lid = r.json()["lead"]["id"]
        d = admin_session.delete(f"{BASE_URL}/api/leads/{lid}")
        assert d.status_code == 200
        g = admin_session.get(f"{BASE_URL}/api/leads/{lid}")
        assert g.status_code == 404


# ----- Logout -----
class TestLogout:
    def test_logout(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        lo = s.post(f"{BASE_URL}/api/auth/logout")
        assert lo.status_code == 200
