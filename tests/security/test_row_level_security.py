"""Tests for row-level security enforcement.

Verifies that users see only authorized projects and cannot bypass RLS.
Runs against a migrated Postgres (see tests/conftest.py).
"""

import pytest
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.project import Project
from backend.app.models.auth import User, ProjectOwner, UserRole
from backend.app.models.governance import ApprovalRequest, WorkflowDefinition
from backend.app.security.rls_service import RLSService
from backend.app.security.auth_middleware import CurrentUser


def make_user(username: str, role: str) -> CurrentUser:
    return CurrentUser({
        "sub": str(uuid4()),
        "username": username,
        "email": f"{username}@sbl.local",
        "full_name": username.title(),
        "roles": [role],
        "is_authenticated": True,
    })


async def persist(db: AsyncSession, user: CurrentUser) -> User:
    """Insert the DB row a logged-in user would have (login does this via sync_user)."""
    row = User(
        id=user.uuid,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        default_role=UserRole(user.roles[0].value),
    )
    db.add(row)
    await db.flush()
    return row


def make_project(code: str, **overrides) -> Project:
    fields = dict(
        project_code=code,
        name_en=f"Project {code}",
        name_np=f"प्रकल्प {code}",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="system",
    )
    fields.update(overrides)
    return Project(**fields)


@pytest.fixture
def admin_user():
    return make_user("admin", "admin")


@pytest.fixture
def maker_user():
    return make_user("maker1", "maker")


@pytest.fixture
def other_maker_user():
    return make_user("maker2", "maker")


@pytest.fixture
def auditor_user():
    return make_user("auditor", "auditor")


@pytest.fixture
def guest_user():
    return make_user("guest", "guest")


@pytest.fixture
def approver_user():
    return make_user("approver1", "approver")


@pytest.mark.asyncio
async def test_admin_sees_all_projects(db_session: AsyncSession, admin_user):
    """Test that admin can see all projects."""

    # Create test projects
    project1 = Project(
        project_code="PROJ-001",
        name_en="Project 1",
        name_np="प्रकल्प १",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="maker1"
    )
    project2 = Project(
        project_code="PROJ-002",
        name_en="Project 2",
        name_np="प्रकल्प २",
        province="Bagmati",
        installed_capacity_mw=75,
        project_stage="construction",
        pipeline_status="under_construction",
        created_by="maker2"
    )

    db_session.add_all([project1, project2])
    await db_session.flush()

    # Admin should see both
    authorized_ids = await RLSService.get_authorized_project_ids(db_session, admin_user)

    assert project1.id in authorized_ids
    assert project2.id in authorized_ids


@pytest.mark.asyncio
async def test_auditor_sees_all_projects(db_session: AsyncSession, auditor_user):
    """Test that auditor can see all projects."""

    project = Project(
        project_code="AUDIT-TEST",
        name_en="Audit Test",
        name_np="अडिट परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="system"
    )

    db_session.add(project)
    await db_session.flush()

    authorized_ids = await RLSService.get_authorized_project_ids(db_session, auditor_user)

    assert project.id in authorized_ids


@pytest.mark.asyncio
async def test_guest_sees_no_projects(db_session: AsyncSession, guest_user):
    """Test that guest users see no projects."""

    project = Project(
        project_code="GUEST-TEST",
        name_en="Guest Test",
        name_np="अतिथि परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="system"
    )

    db_session.add(project)
    await db_session.flush()

    authorized_ids = await RLSService.get_authorized_project_ids(db_session, guest_user)

    assert project.id not in authorized_ids
    assert len(authorized_ids) == 0


@pytest.mark.asyncio
async def test_maker_sees_owned_projects(
    db_session: AsyncSession,
    maker_user,
    other_maker_user,
):
    """Test that makers see only projects they own."""

    # Create projects
    owned_project = Project(
        project_code="OWNED-001",
        name_en="Owned Project",
        name_np="स्वामित्व प्रकल्प",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="maker1"
    )

    other_project = Project(
        project_code="OTHER-001",
        name_en="Other Project",
        name_np="अन्य प्रकल्प",
        province="Bagmati",
        installed_capacity_mw=75,
        project_stage="construction",
        pipeline_status="under_construction",
        created_by="maker2"
    )

    db_session.add_all([owned_project, other_project])
    await db_session.flush()

    # Set up maker1 to own only owned_project
    await persist(db_session, maker_user)
    ownership = ProjectOwner(
        user_id=maker_user.uuid,
        project_id=owned_project.id,
        ownership_type="direct",
    )
    db_session.add(ownership)
    await db_session.flush()

    # Maker1 sees only owned project
    authorized_ids = await RLSService.get_authorized_project_ids(db_session, maker_user)

    assert owned_project.id in authorized_ids
    assert other_project.id not in authorized_ids


@pytest.mark.asyncio
async def test_can_view_project_success(
    db_session: AsyncSession,
    admin_user,
):
    """Test can_view_project returns true for authorized access."""

    project = Project(
        project_code="VIEW-TEST",
        name_en="View Test",
        name_np="दृश्य परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="system"
    )

    db_session.add(project)
    await db_session.flush()

    # Admin can view
    can_view = await RLSService.can_view_project(db_session, admin_user, project.id)

    assert can_view is True


@pytest.mark.asyncio
async def test_can_view_project_denied(
    db_session: AsyncSession,
    maker_user,
):
    """Test can_view_project returns false for unauthorized access."""

    # Set up maker with no projects
    await persist(db_session, maker_user)

    project = Project(
        project_code="DENIED-TEST",
        name_en="Denied Test",
        name_np="अस्वीकृत परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="other_user"
    )

    db_session.add(project)
    await db_session.flush()

    # Maker cannot view
    can_view = await RLSService.can_view_project(db_session, maker_user, project.id)

    assert can_view is False


@pytest.mark.asyncio
async def test_can_create_project(maker_user, admin_user, guest_user):
    """Test can_create_project permission."""

    # Makers and admins can create
    assert await RLSService.can_create_project(maker_user) is True
    assert await RLSService.can_create_project(admin_user) is True

    # Guests cannot
    assert await RLSService.can_create_project(guest_user) is False


@pytest.mark.asyncio
async def test_can_update_project_admin(
    db_session: AsyncSession,
    admin_user,
):
    """Test admin can update any project."""

    project = Project(
        project_code="UPDATE-ADMIN",
        name_en="Update Admin Test",
        name_np="व्यवस्थापक अपडेट परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="system"
    )

    db_session.add(project)
    await db_session.flush()

    # Admin can update
    can_update = await RLSService.can_update_project(db_session, admin_user, project.id)

    assert can_update is True


@pytest.mark.asyncio
async def test_can_update_project_maker_owned(
    db_session: AsyncSession,
    maker_user,
):
    """Test maker can update owned projects."""

    await persist(db_session, maker_user)

    project = Project(
        project_code="UPDATE-MAKER",
        name_en="Update Maker Test",
        name_np="निर्माता अपडेट परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="maker1"
    )

    db_session.add(project)
    await db_session.flush()

    # Assign ownership
    ownership = ProjectOwner(
        user_id=maker_user.uuid,
        project_id=project.id,
        ownership_type="direct",
    )
    db_session.add(ownership)
    await db_session.flush()

    # Maker can update
    can_update = await RLSService.can_update_project(db_session, maker_user, project.id)

    assert can_update is True


@pytest.mark.asyncio
async def test_can_update_project_maker_unowned(
    db_session: AsyncSession,
    maker_user,
):
    """Test maker cannot update unowned projects."""

    await persist(db_session, maker_user)

    project = Project(
        project_code="UNOWNED",
        name_en="Unowned Project",
        name_np="स्वामित्वहीन प्रकल्प",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="other_maker"
    )

    db_session.add(project)
    await db_session.flush()

    # Maker cannot update
    can_update = await RLSService.can_update_project(db_session, maker_user, project.id)

    assert can_update is False


@pytest.mark.asyncio
async def test_can_delete_project_only_admin(
    db_session: AsyncSession,
    admin_user,
    maker_user,
):
    """Test only admin can delete projects."""

    project = Project(
        project_code="DELETE-TEST",
        name_en="Delete Test",
        name_np="मेटाइने परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="system"
    )

    db_session.add(project)
    await db_session.flush()

    # Admin can delete
    can_delete = await RLSService.can_delete_project(db_session, admin_user, project.id)
    assert can_delete is True

    # Maker cannot
    can_delete = await RLSService.can_delete_project(db_session, maker_user, project.id)
    assert can_delete is False


@pytest.mark.asyncio
async def test_assign_project_ownership(db_session: AsyncSession, maker_user):
    """Test assigning project ownership."""

    await persist(db_session, maker_user)
    project = make_project("ASSIGN-1")
    db_session.add(project)
    await db_session.flush()

    ownership = await RLSService.assign_project_ownership(db_session, maker_user.uuid, project.id, "direct")

    assert ownership.user_id == maker_user.uuid
    assert ownership.project_id == project.id
    assert ownership.ownership_type == "direct"
    assert project.id in await RLSService.get_authorized_project_ids(db_session, maker_user)


@pytest.mark.asyncio
async def test_remove_project_ownership(db_session: AsyncSession, maker_user):
    """Test removing project ownership."""

    await persist(db_session, maker_user)
    project = make_project("REMOVE-1")
    db_session.add(project)
    await db_session.flush()
    await RLSService.assign_project_ownership(db_session, maker_user.uuid, project.id, "direct")

    removed = await RLSService.remove_project_ownership(db_session, maker_user.uuid, project.id)

    assert removed is True
    assert project.id not in await RLSService.get_authorized_project_ids(db_session, maker_user)


@pytest.mark.asyncio
async def test_remove_nonexistent_ownership(db_session: AsyncSession):
    """Test removing ownership that doesn't exist."""

    removed = await RLSService.remove_project_ownership(db_session, uuid4(), uuid4())

    assert removed is False


@pytest.mark.asyncio
async def test_approver_sees_projects_awaiting_their_approval(db_session: AsyncSession, approver_user):
    """Approvers see projects with an open approval request assigned to them, and no others."""

    await persist(db_session, approver_user)
    pending = make_project("APPR-PENDING")
    done = make_project("APPR-DONE")
    unrelated = make_project("APPR-OTHER")
    workflow = WorkflowDefinition(name="project_approval", entity_type="project")
    db_session.add_all([pending, done, unrelated, workflow])
    await db_session.flush()

    db_session.add_all([
        ApprovalRequest(workflow_definition_id=workflow.id, entity_type="project", entity_id=str(pending.id),
                        current_state="submitted", maker_id="maker1", approver_id=approver_user.username),
        ApprovalRequest(workflow_definition_id=workflow.id, entity_type="project", entity_id=str(done.id),
                        current_state="approved", maker_id="maker1", approver_id=approver_user.username),
    ])
    await db_session.flush()

    ids = await RLSService.get_authorized_project_ids(db_session, approver_user)

    assert pending.id in ids
    assert done.id not in ids
    assert unrelated.id not in ids


@pytest.mark.asyncio
async def test_scope_query_filters_to_visible_projects(db_session: AsyncSession, maker_user, auditor_user):
    await persist(db_session, maker_user)
    mine = make_project("SCOPE-MINE")
    theirs = make_project("SCOPE-THEIRS")
    db_session.add_all([mine, theirs])
    await db_session.flush()
    await RLSService.assign_project_ownership(db_session, maker_user.uuid, mine.id)

    base = select(Project.id).where(Project.project_code.like("SCOPE-%"))

    maker_ids = set((await db_session.execute(await RLSService.scope_query(db_session, maker_user, base))).scalars())
    auditor_ids = set((await db_session.execute(await RLSService.scope_query(db_session, auditor_user, base))).scalars())

    assert maker_ids == {mine.id}
    assert auditor_ids == {mine.id, theirs.id}
