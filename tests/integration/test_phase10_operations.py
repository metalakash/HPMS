"""Phase 10 coverage: 7 operations endpoints, CBS sync service, adapter resilience.

No database required: services are stubbed and ``get_db`` / auth are overridden, so these
tests pin the route contracts (status codes, envelope, wiring, role gates) and the
resilience behaviour. Service SQL itself is exercised by the DB-backed suite.
"""

import importlib
import uuid
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.database import get_db
from backend.app.integration.finacle_adapter import (
    FinacleAdapterBase,
    CircuitBreaker,
    CircuitBreakerState,
    MockFinacleAdapter,
    RateLimiter,
)
from backend.app.integration.finacle_schema import FinacleSyncRequest, FinacleSyncType
from backend.app.main import app
from backend.app.security.auth_middleware import CurrentUser, get_current_user

PID = "00000000-0000-0000-0000-000000000001"


def _user(role: str = "admin") -> CurrentUser:
    return CurrentUser({
        "sub": str(uuid.uuid4()), "username": "tester", "email": "t@sbl.local",
        "full_name": "Tester", "roles": [role], "is_authenticated": True,
    })


@pytest.fixture
async def api(monkeypatch):
    async def fake_db():
        yield SimpleNamespace()

    async def visible(db, user, project_id):
        return SimpleNamespace(id=project_id)

    async def can_update(db, user, project_id):
        return True

    monkeypatch.setattr("backend.app.api.routes_projects._get_visible_project", visible)
    monkeypatch.setattr("backend.app.api.routes_compliance._get_visible_project", visible)
    monkeypatch.setattr("backend.app.security.rls_service.RLSService.can_update_project", can_update)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: _user("admin")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.clear()


def _stub(monkeypatch, target: str, payload=None, exc: Exception | None = None):
    """Replace an async static service method; returns the list of recorded calls."""
    calls = []

    async def fake(*args, **kwargs):
        calls.append((args, kwargs))
        if exc:
            raise exc
        return payload

    module, cls, name = target.rsplit(".", 2)
    owner = getattr(importlib.import_module(module), cls)
    monkeypatch.setattr(owner, name, staticmethod(fake))
    return calls


PROJECT_TABS = [
    ("generation-ppa", "backend.app.services.generation_service.GenerationService.get_generation_ppa_data"),
    ("hydrology", "backend.app.services.hydrology_service.HydrologyService.get_hydrology_data"),
    ("land-governance", "backend.app.services.land_governance_service.LandGovernanceService.get_land_governance_data"),
    ("esg", "backend.app.services.esg_service.ESGService.get_esg_data"),
    ("maintenance", "backend.app.services.maintenance_service.MaintenanceService.get_maintenance_data"),
]


@pytest.mark.parametrize("tab,target", PROJECT_TABS)
async def test_project_tab_endpoints(api, monkeypatch, tab, target):
    calls = _stub(monkeypatch, target, {"marker": tab})
    r = await api.get(f"/api/v1/projects/{PID}/{tab}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["data"] == {"marker": tab}
    assert body["audit"]["user_id"] == "tester"
    assert len(calls) == 1


@pytest.mark.parametrize("tab,target", PROJECT_TABS)
async def test_project_tab_service_failure_is_500(api, monkeypatch, tab, target):
    _stub(monkeypatch, target, exc=RuntimeError("boom"))
    r = await api.get(f"/api/v1/projects/{PID}/{tab}")
    assert r.status_code == 500
    assert "boom" not in r.text  # internals are not leaked


async def test_covenant_history_passes_quarters(api, monkeypatch):
    calls = _stub(monkeypatch, "backend.app.services.covenant_service.CovenantService.get_covenant_history",
                  {"quarters": []})
    assert (await api.get(f"/api/v1/compliance/covenants/{PID}/history")).status_code == 200
    assert calls[0][1]["quarters"] == 8
    await api.get(f"/api/v1/compliance/covenants/{PID}/history?quarters=12")
    assert calls[1][1]["quarters"] == 12


@pytest.mark.parametrize("q", [0, 21])
async def test_covenant_history_rejects_bad_quarters(api, q):
    assert (await api.get(f"/api/v1/compliance/covenants/{PID}/history?quarters={q}")).status_code == 422


async def test_alert_remediations(api, monkeypatch):
    _stub(monkeypatch, "backend.app.services.alert_service.AlertService.get_expiry_alerts", {"critical": []})
    r = await api.get(f"/api/v1/compliance/alerts/{PID}/remediations")
    assert r.status_code == 200
    assert r.json()["data"] == {"critical": []}


@pytest.mark.parametrize("path", [
    f"/api/v1/projects/{PID}/generation-ppa",
    f"/api/v1/projects/{PID}/esg",
    f"/api/v1/compliance/covenants/{PID}/history",
    f"/api/v1/compliance/alerts/{PID}/remediations",
])
async def test_endpoints_require_auth(path):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        assert (await client.get(path)).status_code in (401, 403)


# ---------------------------------------------------------------- CBS status/sync routes

async def test_cbs_status_admin_ok_and_reports_limits(api):
    r = await api.get("/api/v1/cbs/status")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["circuit_breaker"]["state"] == "CLOSED"
    assert data["rate_limiter"]["max_calls_per_day"] == 1000


async def test_cbs_status_forbidden_for_other_roles(api):
    app.dependency_overrides[get_current_user] = lambda: _user("maker")
    assert (await api.get("/api/v1/cbs/status")).status_code == 403


async def test_cbs_sync_route_returns_service_result(api, monkeypatch):
    result = {"status": "success", "changes_count": 2, "diff_log": [], "sync_timestamp": "x"}
    calls = []

    async def fake(self, db, project_id, loan_id, user_id="system", **options):
        calls.append((project_id, loan_id, user_id))
        return result

    monkeypatch.setattr("backend.app.services.cbs_sync_real_service.CBSSyncService.sync_loan_account", fake)
    r = await api.post(f"/api/v1/cbs/sync/{PID}", json={"loan_id": "ACC00001"})
    assert r.status_code == 200
    assert r.json()["data"]["changes_count"] == 2
    assert calls == [(PID, "ACC00001", "tester")]


async def test_cbs_sync_forbidden_for_guest_and_auditor(api):
    for role in ("guest", "auditor"):
        app.dependency_overrides[get_current_user] = lambda role=role: _user(role)
        r = await api.post(f"/api/v1/cbs/sync/{PID}", json={"loan_id": "ACC00001"})
        assert r.status_code == 403, role


# ---------------------------------------------------------------- CBSSyncService

class _FakeDB:
    def __init__(self, account):
        self.account = account
        self.flushed = 0

    async def execute(self, stmt):
        account = self.account
        return SimpleNamespace(scalars=lambda: SimpleNamespace(first=lambda: account))

    async def flush(self):
        self.flushed += 1


def _local_account(**over):
    base = dict(
        finacle_account_id="ACC00001", disbursed_amount=Decimal("3500000.00"),
        outstanding_principal=Decimal("2800000.00"), outstanding_interest=Decimal("25000.00"),
        overdue_principal=Decimal("0.00"), overdue_interest=Decimal("0.00"),
        interest_rate_pct=Decimal("8.75"), maturity_ad=None,
    )
    base.update(over)
    return SimpleNamespace(**base)


class _LiveLikeAdapter(FinacleAdapterBase):
    """Stands in for a real Finacle connection: answers like the mock, but is not the mock."""

    async def sync_accounts(self, request):
        return await MockFinacleAdapter().sync_accounts(request)


# Applying a real adapter's record needs the audit chain: see test_cbs_adapters.py


async def test_sync_against_the_mock_adapter_reports_differences_but_changes_nothing():
    """The mock answers every account with one sample record; it must never overwrite real balances."""
    from backend.app.services.cbs_sync_real_service import CBSSyncService
    account = _local_account(outstanding_principal=Decimal("1.00"))
    db = _FakeDB(account)
    out = await CBSSyncService(MockFinacleAdapter()).sync_loan_account(db, PID, "ACC00001")
    assert out["status"] == "success" and out["changes_count"] >= 1
    assert (out["simulated"], out["applied"]) == (True, False)
    assert account.outstanding_principal == Decimal("1.00")
    assert db.flushed == 0


async def test_sync_service_unknown_account():
    from backend.app.services.cbs_sync_real_service import CBSSyncService
    out = await CBSSyncService(MockFinacleAdapter()).sync_loan_account(_FakeDB(None), PID, "NOPE")
    assert out["status"] == "error" and out["changes_count"] == 0


async def test_sync_service_adapter_failure_is_reported_not_raised():
    from backend.app.services.cbs_sync_real_service import CBSSyncService
    adapter = MockFinacleAdapter(failure_mode="connection_error")
    out = await CBSSyncService(adapter).sync_loan_account(_FakeDB(_local_account()), PID, "ACC00001")
    assert out["status"] == "error"
    assert adapter.circuit_breaker.failure_count == 1


# ---------------------------------------------------------------- resilience

def _req():
    return FinacleSyncRequest(sync_type=FinacleSyncType.REALTIME_INQUIRY, request_id="r1", account_ids=["ACC00001"])


async def test_circuit_opens_after_five_adapter_failures_then_fails_fast():
    adapter = MockFinacleAdapter(failure_mode="connection_error")
    for _ in range(5):
        with pytest.raises(ConnectionError):
            await adapter.sync_with_circuit_breaker(_req())
    assert adapter.circuit_breaker.state == CircuitBreakerState.OPEN
    with pytest.raises(Exception, match="Circuit breaker OPEN"):
        await adapter.sync_with_circuit_breaker(_req())


def test_circuit_stays_closed_below_threshold():
    cb = CircuitBreaker(failure_threshold=5)

    def fail():
        raise ValueError("x")

    for _ in range(4):
        with pytest.raises(ValueError):
            cb.call(fail)
    assert cb.state == CircuitBreakerState.CLOSED


def test_rate_limiter_blocks_after_1000_per_day():
    rl = RateLimiter()
    assert (rl.max_calls, rl.time_window_seconds) == (1000, 86400)
    assert all(rl.is_allowed() for _ in range(1000))
    assert rl.is_allowed() is False
    assert rl.get_remaining_calls() == 0
    assert rl.get_status()["calls_used_today"] == 1000


def test_rate_limiter_window_expiry_restores_quota():
    rl = RateLimiter(max_calls=2, time_window_seconds=60)
    assert rl.is_allowed() and rl.is_allowed() and not rl.is_allowed()
    rl.call_times = [t - timedelta(seconds=61) for t in rl.call_times]
    assert rl.is_allowed()
    assert rl.get_remaining_calls() == 1


async def test_adapter_rejects_when_rate_limited_before_hitting_cbs():
    adapter = MockFinacleAdapter()
    adapter.rate_limiter = RateLimiter(max_calls=1)
    await adapter.sync_with_circuit_breaker(_req())
    with pytest.raises(Exception, match="rate limit exceeded"):
        await adapter.sync_with_circuit_breaker(_req())
    assert adapter.circuit_breaker.failure_count == 0  # throttling is not a CBS failure


def test_circuit_counts_only_consecutive_failures():
    cb = CircuitBreaker(failure_threshold=3)

    def fail():
        raise ValueError("x")

    for _ in range(10):
        with pytest.raises(ValueError):
            cb.call(fail)
            cb.call(fail)
        cb.call(lambda: None)  # success in between resets the count
    assert cb.state == CircuitBreakerState.CLOSED


# ---------------------------------------------------------------- row-level security on Phase 10 endpoints

async def test_compliance_endpoints_are_404_for_invisible_projects(api, monkeypatch):
    from fastapi import HTTPException

    async def hidden(db, user, project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    monkeypatch.setattr("backend.app.api.routes_compliance._get_visible_project", hidden)
    calls = _stub(monkeypatch, "backend.app.services.covenant_service.CovenantService.get_covenant_history", {})
    calls += _stub(monkeypatch, "backend.app.services.alert_service.AlertService.get_expiry_alerts", {})
    assert (await api.get(f"/api/v1/compliance/covenants/{PID}/history")).status_code == 404
    assert (await api.get(f"/api/v1/compliance/alerts/{PID}/remediations")).status_code == 404
    assert calls == []  # the service was never reached


@pytest.mark.parametrize("alert_id,action,status", [
    (f"PPA:{PID}", "RENEWAL", 200),
    ("PPA:not-a-uuid", "RENEWAL", 422),
    (f"BANANA:{PID}", "RENEWAL", 422),
    ("nocolon", "RENEWAL", 422),
    (f"PPA:{PID}", "DELETE_EVERYTHING", 422),
])
async def test_initiate_alert_action_validates_input(api, alert_id, action, status):
    r = await api.post("/api/v1/compliance/alert-actions/initiate",
                       params={"alert_id": alert_id, "action_type": action})
    assert r.status_code == status, r.text


async def test_initiate_alert_action_blocked_for_guest_and_auditor(api):
    for role in ("guest", "auditor"):
        app.dependency_overrides[get_current_user] = lambda role=role: _user(role)
        r = await api.post("/api/v1/compliance/alert-actions/initiate",
                           params={"alert_id": f"PPA:{PID}", "action_type": "RENEWAL"})
        assert r.status_code == 403, role


async def test_cbs_sync_needs_project_visibility_and_update_rights(api, monkeypatch):
    from fastapi import HTTPException

    async def hidden(db, user, project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    monkeypatch.setattr("backend.app.api.routes_projects._get_visible_project", hidden)
    assert (await api.post(f"/api/v1/cbs/sync/{PID}", json={"loan_id": "ACC00001"})).status_code == 404

    async def visible(db, user, project_id):
        return SimpleNamespace(id=project_id)

    async def cannot_update(db, user, project_id):
        return False

    monkeypatch.setattr("backend.app.api.routes_projects._get_visible_project", visible)
    monkeypatch.setattr("backend.app.security.rls_service.RLSService.can_update_project", cannot_update)
    assert (await api.post(f"/api/v1/cbs/sync/{PID}", json={"loan_id": "ACC00001"})).status_code == 403


async def test_sync_service_query_is_scoped_to_the_project():
    from backend.app.services.cbs_sync_real_service import CBSSyncService
    seen = []

    class Recording(_FakeDB):
        async def execute(self, stmt):
            seen.append(str(stmt.compile(compile_kwargs={"literal_binds": False})))
            return await super().execute(stmt)

    await CBSSyncService(MockFinacleAdapter()).sync_loan_account(Recording(None), PID, "ACC00001")
    assert "loan_accounts.project_id" in seen[0] and "finacle_account_id" in seen[0]
