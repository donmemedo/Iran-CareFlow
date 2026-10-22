"""End-to-end checks against the seeded demo dataset."""
def test_health(client):
    assert client.get("/api/v1/health").json()["status"] == "ok"


def test_login_rejects_bad_password(client):
    assert client.post("/api/v1/auth/login", json={"email": "manager@careflow.ir", "password": "nope"}).status_code == 401


def test_protected_routes_require_a_token(client):
    assert client.get("/api/v1/overview").status_code == 401


def test_overview_returns_six_kpis(client, auth):
    body = client.get("/api/v1/overview", headers=auth).json()
    assert len(body["kpis"]) == 6
    assert body["beds_occupied"] <= body["beds_total"]
    assert body["active_patients"] > 0


def test_forecast_has_widening_uncertainty(client, auth):
    body = client.get("/api/v1/analytics/occupancy?days=90&horizon=14", headers=auth).json()
    assert len(body["forecast"]) == 14
    first, last = body["forecast"][0], body["forecast"][-1]
    assert (last["upper"] - last["lower"]) > (first["upper"] - first["lower"])
    assert all(p["lower"] <= p["value"] <= p["upper"] for p in body["forecast"])


def test_patient_detail_carries_pathway_and_thread(client, auth):
    patients = client.get("/api/v1/patients?limit=1", headers=auth).json()
    detail = client.get(f"/api/v1/patients/{patients[0]['id']}", headers=auth).json()
    assert detail["steps"] and detail["care_team"]
    assert 0 <= detail["progress"] <= 100


def test_advancing_a_step_moves_the_case_forward(client, login):
    physician = login("physician@careflow.ir")  # physicians may sign off any step in their scope
    patients = client.get("/api/v1/patients?status=active&limit=50", headers=physician).json()
    target = next(p for p in patients if 0 < p["progress"] < 100)
    detail = client.get(f"/api/v1/patients/{target['id']}", headers=physician).json()
    current = next(s for s in detail["steps"] if s["status"] in ("active", "blocked"))
    steps = client.post(
        f"/api/v1/patients/{target['id']}/steps/{current['id']}/advance", headers=physician
    ).json()
    advanced = next(s for s in steps if s["id"] == current["id"])
    assert advanced["status"] == "done"


def test_posting_a_message_appends_to_the_thread(client, auth):
    patient_id = client.get("/api/v1/patients?limit=1", headers=auth).json()[0]["id"]
    before = len(client.get(f"/api/v1/patients/{patient_id}/messages", headers=auth).json())
    created = client.post(
        f"/api/v1/patients/{patient_id}/messages", headers=auth, json={"body": "تست هماهنگی تیم درمان", "kind": "note"}
    )
    assert created.status_code == 200
    after = client.get(f"/api/v1/patients/{patient_id}/messages", headers=auth).json()
    assert len(after) == before + 1


def test_pathway_board_columns_match_steps(client, auth):
    pathway = client.get("/api/v1/pathways", headers=auth).json()[0]
    board = client.get(f"/api/v1/pathways/{pathway['id']}/board", headers=auth).json()
    assert len(board["columns"]) == len(pathway["steps"])


def test_roi_scales_with_hospital_size(client):
    small = client.post("/api/v1/roi/calculate", json={"beds": 120, "clinical_staff": 180}).json()
    large = client.post("/api/v1/roi/calculate", json={"beds": 800, "clinical_staff": 1100}).json()
    assert large["annual_benefit"] > small["annual_benefit"]
    assert small["payback_months"] > 0


def test_lead_capture_validates_email(client):
    bad = client.post("/api/v1/leads", json={"full_name": "A B", "organization": "Mehr", "email": "not-an-email"})
    assert bad.status_code == 422
