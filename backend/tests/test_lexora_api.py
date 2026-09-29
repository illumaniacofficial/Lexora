"""Lexora backend API integration tests.

Tests core endpoints via public preview URL through the FastAPI proxy -> Node/Express.
Auth is session-cookie based (connect.sid).
"""
import os
import time
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://eca3d45b-282d-4164-a0e2-536e87461cd8.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "lexora2026"


@pytest.fixture(scope="session")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("ok") is True and data.get("username") == "admin"
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_login_bad_password(self, anon_client):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": "wrong"}, timeout=30)
        assert r.status_code in (400, 401, 403)

    def test_protected_requires_auth(self, anon_client):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/dashboard", timeout=30)
        assert r.status_code == 401


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_stats(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/dashboard", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "stats" in data
        s = data["stats"]
        assert isinstance(s.get("totalProjects"), int)
        assert s["totalProjects"] >= 5  # seeded
        assert isinstance(s.get("totalWords"), int)
        assert "recentProjects" in data


# ---------- Projects ----------
class TestProjects:
    def test_list_projects(self, admin_client):
        # /api/projects excludes status=='complete'; seed has 3 in-progress
        r = admin_client.get(f"{BASE_URL}/api/projects", timeout=30)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 3

    def test_get_project_detail(self, admin_client):
        arr = admin_client.get(f"{BASE_URL}/api/projects", timeout=30).json()
        pid = arr[0]["id"]
        r = admin_client.get(f"{BASE_URL}/api/projects/{pid}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        # project detail should include project fields and (typically) chapters/outline
        assert data.get("id") == pid or data.get("project", {}).get("id") == pid


# ---------- Analytics / Autopilot / Trends list ----------
class TestReadOnly:
    def test_analytics(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/analytics", timeout=30)
        assert r.status_code == 200

    def test_autopilot(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/autopilot", timeout=30)
        assert r.status_code == 200

    def test_trends_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/trends", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_library(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/library", timeout=30)
        assert r.status_code == 200
        data = r.json()
        # library should list completed books
        assert isinstance(data, list) and len(data) >= 1


# ---------- AI: Trend analyze (real OpenAI) ----------
class TestTrendAnalyze:
    def test_analyze_self_help(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/trends/analyze", json={"vertical": "self-help"}, timeout=180)
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        # Accept either flat or nested
        report = data.get("report") if isinstance(data, dict) and "report" in data else data
        assert report.get("demandScore") is not None
        assert report.get("greenlightScore") is not None
        assert report.get("summary")
        # titleAngles should be a list with entries
        angles = report.get("titleAngles") or []
        assert isinstance(angles, list) and len(angles) > 0


# ---------- Create Project + Outline + Chapter (real AI) ----------
@pytest.fixture(scope="session")
def new_project(admin_client):
    payload = {
        "title": "TEST_Lexora Focus Rituals",
        "authorName": "Sergio A. Delgado",
        "vertical": "self-help",
        "targetLanguage": "english",
        "description": "A test book on daily focus rituals for knowledge workers.",
    }
    r = admin_client.post(f"{BASE_URL}/api/projects", json=payload, timeout=60)
    assert r.status_code in (200, 201), f"Create project failed {r.status_code}: {r.text[:400]}"
    proj = r.json()
    pid = proj.get("id") or proj.get("project", {}).get("id")
    assert pid, f"No project id: {proj}"
    return pid


class TestGeneration:
    def test_create_project_persists(self, admin_client, new_project):
        pid = new_project
        r = admin_client.get(f"{BASE_URL}/api/projects/{pid}", timeout=30)
        assert r.status_code == 200

    def test_generate_outline(self, admin_client, new_project):
        pid = new_project
        # Fire and ignore ingress 502 (Kubernetes edge ~100s timeout); poll for chapters.
        try:
            admin_client.post(f"{BASE_URL}/api/projects/{pid}/generate-outline", json={}, timeout=120)
        except requests.RequestException:
            pass
        # Poll up to 5 minutes
        chapters = []
        for _ in range(60):
            detail = admin_client.get(f"{BASE_URL}/api/projects/{pid}", timeout=30).json()
            chapters = detail.get("chapters") or detail.get("project", {}).get("chapters") or []
            if chapters:
                break
            time.sleep(5)
        assert len(chapters) > 0, "No chapters generated in outline after 5min poll"

    def test_generate_one_chapter(self, admin_client, new_project):
        pid = new_project
        # Fetch chapters (from project detail — nested)
        detail = admin_client.get(f"{BASE_URL}/api/projects/{pid}", timeout=30).json()
        chapters = detail.get("chapters") or detail.get("project", {}).get("chapters") or []
        assert chapters, "No chapters to generate (outline must run first)"
        ch = chapters[0]
        cid = ch["id"]
        try:
            admin_client.post(f"{BASE_URL}/api/projects/{pid}/chapters/{cid}/generate", json={}, timeout=120)
        except requests.RequestException:
            pass
        # Poll for chapter content
        got = None
        for _ in range(72):  # up to 6min
            detail = admin_client.get(f"{BASE_URL}/api/projects/{pid}", timeout=30).json()
            chs = detail.get("chapters") or detail.get("project", {}).get("chapters") or []
            target = next((c for c in chs if c["id"] == cid), None)
            if target and target.get("content") and len(target["content"]) > 100:
                got = target
                break
            time.sleep(5)
        assert got, "Chapter content not written after 6min poll"

    def test_generate_marketing(self, admin_client, new_project):
        pid = new_project
        r = admin_client.post(f"{BASE_URL}/api/projects/{pid}/generate-marketing", json={}, timeout=180)
        assert r.status_code == 200, f"marketing failed {r.status_code}: {r.text[:400]}"
        data = r.json()
        # Should contain blurbs / hooks
        s = json.dumps(data).lower()
        assert "blurb" in s or "hook" in s or "shortblurb" in s or "amazon" in s


# ---------- Chat ----------
class TestChat:
    def test_create_conversation_and_send(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/chat/conversations", json={"title": "TEST_Chat"}, timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        conv = r.json()
        cid = conv.get("id")
        assert cid
        # Send message (SSE) - read a bit of stream
        with admin_client.post(
            f"{BASE_URL}/api/chat/conversations/{cid}/messages",
            json={"content": "Say hello in 5 words."},
            stream=True,
            timeout=120,
        ) as resp:
            assert resp.status_code == 200, f"chat send failed {resp.status_code}: {resp.text[:300]}"
            collected = b""
            start = time.time()
            for chunk in resp.iter_content(chunk_size=256):
                if chunk:
                    collected += chunk
                    if len(collected) > 40 or (time.time() - start) > 30:
                        break
            assert len(collected) > 0, "No SSE bytes received"
