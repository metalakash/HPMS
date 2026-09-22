"""Tests for row-level security enforcement.

Verifies that users see only authorized projects and cannot bypass RLS.
"""

import pytest
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.project import Project
from backend.app.models.auth import User, ProjectOwner, UserRole
from backend.app.security.rls_service import RLSService
from backend.app.security.auth_middleware import CurrentUser


@pytest.fixture
async def admin_user():
    """Create admin user."""
    return CurrentUser({
        "username": "admin",
        "email": "admin@sbl.local",
        "full_name": "Admin User",
        "roles": ["admin"],
        "is_authenticated": True,
    })


@pytest.fixture
async def maker_user():
    """Create maker user."""
    return CurrentUser({
        "username": "maker1",
        "email": "maker1@sbl.local",
        "full_name": "Maker User 1",
        "roles": ["maker"],
        "is_authenticated": True,
    })


@pytest.fixture
async def other_maker_user():
    """Create another maker user."""
    return CurrentUser({
        "username": "maker2",
        "email": "maker2@sbl.local",
        "full_name": "Maker User 2",
        "roles": ["maker"],
        "is_authenticated": True,
    })


@pytest.fixture
async def auditor_user():
    """Create auditor user."""
    return CurrentUser({
        "username": "auditor",
        "email": "auditor@sbl.local",
        "full_name": "Auditor User",
        "roles": ["auditor"],
        "is_authenticated": True,
    })


@pytest.fixture
async def guest_user():
    """Create guest user."""
    return CurrentUser({
        "username": "guest",
        "email": "guest@sbl.local",
        "full_name": "Guest User",
        "roles": ["guest"],
        "is_authenticated": True,
    })


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
    maker_user.user_id = uuid4()
    ownership = ProjectOwner(
        user_id=maker_user.user_id,
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
    maker_user.user_id = uuid4()

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

    maker_user.user_id = uuid4()

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
        user_id=maker_user.user_id,
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

    maker_user.user_id = uuid4()

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
async def test_assign_project_ownership(
    db_session: AsyncSession,
):
    """Test assigning project ownership."""

    user_id = uuid4()
    project_id = uuid4()

    ownership = await RLSService.assign_project_ownership(
        db_session,
        user_id,
        project_id,
        "direct",
    )

    assert ownership.user_id == user_id
    assert ownership.project_id == project_id
    assert ownership.ownership_type == "direct"


@pytest.mark.asyncio
async def test_remove_project_ownership(
    db_session: AsyncSession,
):
    """Test removing project ownership."""

    user_id = uuid4()
    project_id = uuid4()

    # Assign first
    await RLSService.assign_project_ownership(
        db_session,
        user_id,
        project_id,
        "direct",
    )

    # Remove
    removed = await RLSService.remove_project_ownership(db_session, user_id, project_id)

    assert removed is True


@pytest.mark.asyncio
async def test_remove_nonexistent_ownership(
    db_session: AsyncSession,
):
    """Test removing ownership that doesn't exist."""

    removed = await RLSService.remove_project_ownership(
        db_session,
        uuid4(),
        uuid4(),
    )

    assert removed is False
