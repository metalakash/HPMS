"""Seed maker-checker change requests in each workflow state, for Phase 11 testing.

Requests are created through MutationService, so the approval steps and the hash-chained
audit entries are exactly what the application writes. The approved one really changes its
project's forecast COD. Needs seeded projects with loans
(run seed_realistic_data first). Safe to re-run: it does nothing once its requests exist,
because audit entries are append-only and cannot be cleaned up.

Run from the repository root:
    python -m backend.scripts.seed_test_workflows
"""

import asyncio
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine
from backend.app.models.auth import ProjectOwner, User
from backend.app.models.financial import LoanAccount
from backend.app.models.governance import ApprovalRequest
from backend.app.models.project import Project
from backend.app.security.auth_middleware import CurrentUser
from backend.app.security.ldap_provider import UserRole
from backend.app.services.mutation_service import MutationService

# Two approvers, because the recommendation and the final approval must come from different people.
TEST_USERS = {
    "maker": ("e2e.maker", UserRole.MAKER),
    "recommender": ("e2e.recommender", UserRole.APPROVER),
    "approver": ("e2e.approver", UserRole.APPROVER),
}


DEMO_MAKER = "maker"  # LocalDevAuthProvider account; its user row is otherwise created at first login


async def _ensure_user(session: AsyncSession, username: str, role: UserRole) -> CurrentUser:
    user = (await session.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if user is None:
        email = "maker@sbl.local" if username == DEMO_MAKER else f"{username}@hpms.test"
        user = User(username=username, email=email, full_name=username,
                    default_role=role.value, created_by="seed_test_workflows")
        session.add(user)
        await session.flush()
    return CurrentUser({"sub": str(user.id), "username": username, "email": user.email,
                        "roles": [role.value], "is_authenticated": True})


async def seed(session: AsyncSession) -> List[Dict[str, str]]:
    """Create one request per workflow state. Returns [] if they already exist."""
    users = {key: await _ensure_user(session, name, role) for key, (name, role) in TEST_USERS.items()}
    maker = users["maker"]

    existing = (await session.execute(
        select(ApprovalRequest.id).where(ApprovalRequest.maker_id == maker.id).limit(1))).first()
    if existing:
        return []

    financed = (await session.execute(
        select(Project, LoanAccount).join(LoanAccount, LoanAccount.project_id == Project.id)
        .order_by(Project.project_code).limit(4))).all()
    if len(financed) < 4:
        raise RuntimeError("Need at least 4 projects with loans; run seed_realistic_data first")

    # A maker may only propose changes to projects they own. The built-in demo maker gets the same
    # projects, so the flow can be exercised by signing in as "maker".
    demo_maker = await _ensure_user(session, DEMO_MAKER, UserRole.MAKER)
    for project, _ in financed:
        for owner in (maker, demo_maker):
            session.add(ProjectOwner(user_id=owner.uuid, project_id=project.id, ownership_type="direct"))
    await session.flush()

    async def submit(entity_type: str, entity_id, changes: dict, justification: str) -> str:
        result = await MutationService.submit_mutation(
            session, maker, entity_type=entity_type, entity_id=str(entity_id), action="UPDATE",
            changes=changes, justification=justification, source_ip="127.0.0.1", session_id="seed")
        return result["approval_request_id"]

    (p1, _), (_, loan2), (p3, _), (_, loan4) = financed
    created = []

    request_id = await submit("PROJECT", p1.id, {"forecast_cod_ad": "2027-03-31"},
                              "Monsoon delay per NEA correspondence dated 2083/06/15 BS")
    await MutationService.approve_mutation(session, users["recommender"], request_id, "Supported by the site report")
    await MutationService.approve_mutation(session, users["approver"], request_id, "Approved")
    created.append({"id": request_id, "state": "approved"})

    request_id = await submit("LOAN", loan2.id, {"interest_rate_pct": "9.75"},
                              "Rate reset per board resolution of Ashwin 2083")
    created.append({"id": request_id, "state": "submitted"})

    request_id = await submit("PROJECT", p3.id, {"pipeline_status": "dropped", "drop_reason": "Developer withdrew"},
                              "Developer has requested withdrawal of the facility")
    await MutationService.reject_mutation(session, users["approver"], request_id,
                                          "Withdrawal letter is not on file; resubmit with it attached")
    created.append({"id": request_id, "state": "rejected"})

    request_id = await submit("LOAN", loan4.id, {"maturity_ad": "2041-06-01"},
                              "Tenor extension agreed with the consortium lead bank")
    await MutationService.approve_mutation(session, users["recommender"], request_id, "Consortium minutes attached")
    created.append({"id": request_id, "state": "recommended"})

    return created


async def main() -> List[Dict[str, str]]:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        created = await seed(session)
        await session.commit()
    return created


if __name__ == "__main__":
    requests = asyncio.run(main())
    if not requests:
        print("Workflow requests already seeded; nothing to do")
    for request in requests:
        print(f"{request['state']:<12} {request['id']}")
