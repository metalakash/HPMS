"""GraphQL schema for mobile and web clients.

Type-safe GraphQL queries over the same data and access rules as the REST API.
Field names are exposed in camelCase (Strawberry default), e.g. ``installedCapacityMw``.

Every resolver expects ``info.context`` to carry:
- ``db``: AsyncSession
- ``user``: the authenticated CurrentUser (row-level security is applied per user)
"""

import base64
import logging
from datetime import date
from typing import List, Optional
from uuid import UUID

import strawberry
from sqlalchemy import func, select
from strawberry.types import Info

logger = logging.getLogger(__name__)


class GraphQLPermissionError(PermissionError):
    """Raised when the user may not perform an operation; surfaces as a GraphQL error."""


def _context(info: Info):
    """Return (db, user) from the request context, failing loudly if missing."""
    db = info.context.get("db")
    user = info.context.get("user")
    if db is None or user is None:
        raise GraphQLPermissionError("Not authenticated")
    return db, user


def _encode_cursor(offset: int) -> str:
    return base64.b64encode(str(offset).encode()).decode()


def _decode_cursor(cursor: Optional[str]) -> int:
    if not cursor:
        return 0
    try:
        return max(int(base64.b64decode(cursor).decode()), 0)
    except (ValueError, UnicodeDecodeError):
        raise ValueError("Invalid cursor")


@strawberry.type
class ProjectType:
    """Project (maps to the ``projects`` table)."""

    id: UUID
    project_code: str
    name_en: str
    name_np: str
    installed_capacity_mw: float
    province: str
    district: str
    pipeline_status: str  # proposal_under_pipeline, under_review, approved, dropped, ...
    project_stage: str  # feasibility, construction, operation
    original_cod_ad: Optional[date] = None
    current_approved_cod_ad: Optional[date] = None
    forecast_cod_ad: Optional[date] = None
    actual_cod_ad: Optional[date] = None
    drop_reason: Optional[str] = None

    @classmethod
    def from_model(cls, project) -> "ProjectType":
        return cls(
            id=project.id,
            project_code=project.project_code,
            name_en=project.name_en,
            name_np=project.name_np,
            installed_capacity_mw=float(project.installed_capacity_mw or 0),
            province=project.province or "",
            district=project.district or "",
            pipeline_status=project.pipeline_status,
            project_stage=project.project_stage,
            original_cod_ad=project.original_cod_ad,
            current_approved_cod_ad=project.current_approved_cod_ad,
            forecast_cod_ad=project.forecast_cod_ad,
            actual_cod_ad=project.actual_cod_ad,
            drop_reason=project.drop_reason,
        )


@strawberry.type
class LoanAccountType:
    """Loan account (maps to the ``loan_accounts`` table). The Finacle account id is never exposed."""

    id: UUID
    project_id: UUID
    facility_type: Optional[str]
    currency_code: str
    sanctioned_amount: float
    disbursed_amount: float
    outstanding_principal: float
    interest_rate_pct: Optional[float]
    maturity_ad: Optional[date]
    sync_status: str

    @classmethod
    def from_model(cls, account) -> "LoanAccountType":
        return cls(
            id=account.id,
            project_id=account.project_id,
            facility_type=account.facility_type,
            currency_code=account.currency_code or "NPR",
            sanctioned_amount=float(account.sanctioned_amount or 0),
            disbursed_amount=float(account.disbursed_amount or 0),
            outstanding_principal=float(account.outstanding_principal or 0),
            interest_rate_pct=float(account.interest_rate_pct) if account.interest_rate_pct is not None else None,
            maturity_ad=account.maturity_ad,
            sync_status=account.sync_status or "pending",
        )


@strawberry.type
class UserType:
    """Authenticated user."""

    id: UUID
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    default_role: str
    language_preference: str


@strawberry.type
class PortfolioMetricsType:
    """Portfolio totals over the projects the user may see."""

    total_projects: int
    active_projects: int  # under construction or under operation
    total_capacity_mw: float
    total_sanctioned: float
    total_disbursed: float
    average_rate_pct: Optional[float]  # mean interest rate across loan accounts; null if none


@strawberry.type
class PageInfoType:
    """Pagination information for cursor-based navigation."""

    has_next_page: bool
    has_previous_page: bool
    start_cursor: Optional[str] = None
    end_cursor: Optional[str] = None
    total_count: int


@strawberry.type
class ProjectEdgeType:
    node: ProjectType
    cursor: str


@strawberry.type
class ProjectConnectionType:
    edges: List[ProjectEdgeType]
    page_info: PageInfoType


ACTIVE_STATUSES = ("under_construction", "under_operation")


@strawberry.type
class Query:
    """GraphQL queries. All results are limited to projects the user may see."""

    @strawberry.field
    async def project(self, id: UUID, info: Info) -> Optional[ProjectType]:
        """Single project by id, or null if it doesn't exist or isn't visible."""
        from backend.app.models.project import Project
        from backend.app.security.rls_service import RLSService

        db, user = _context(info)
        if not await RLSService.can_view_project(db, user, id):
            return None

        result = await db.execute(select(Project).where(Project.id == id))
        project = result.scalar_one_or_none()
        return ProjectType.from_model(project) if project else None

    @strawberry.field
    async def projects(
        self,
        info: Info,
        first: int = 10,
        after: Optional[str] = None,
        pipeline_status: Optional[str] = None,
        province: Optional[str] = None,
    ) -> ProjectConnectionType:
        """Cursor-paginated projects (``first`` capped at 100), newest first."""
        from backend.app.models.project import Project
        from backend.app.security.rls_service import RLSService

        db, user = _context(info)
        first = max(1, min(first, 100))
        offset = _decode_cursor(after)

        query = select(Project)
        if pipeline_status:
            query = query.where(Project.pipeline_status == pipeline_status)
        if province:
            query = query.where(Project.province == province)
        query = await RLSService.scope_query(db, user, query)

        total = await db.execute(select(func.count()).select_from(query.subquery()))
        total_count = total.scalar() or 0

        page = await db.execute(
            query.order_by(Project.created_at.desc(), Project.id).offset(offset).limit(first)
        )
        projects = page.scalars().all()

        edges = [
            ProjectEdgeType(node=ProjectType.from_model(p), cursor=_encode_cursor(offset + i + 1))
            for i, p in enumerate(projects)
        ]

        return ProjectConnectionType(
            edges=edges,
            page_info=PageInfoType(
                has_next_page=offset + len(projects) < total_count,
                has_previous_page=offset > 0,
                start_cursor=edges[0].cursor if edges else None,
                end_cursor=edges[-1].cursor if edges else None,
                total_count=total_count,
            ),
        )

    @strawberry.field
    async def loan_accounts(self, project_id: UUID, info: Info) -> List[LoanAccountType]:
        """Loan accounts on a project; empty if the project isn't visible."""
        from backend.app.models.financial import LoanAccount
        from backend.app.security.rls_service import RLSService

        db, user = _context(info)
        if not await RLSService.can_view_project(db, user, project_id):
            return []

        result = await db.execute(
            select(LoanAccount)
            .where(LoanAccount.project_id == project_id)
            .order_by(LoanAccount.created_at.desc())
        )
        return [LoanAccountType.from_model(a) for a in result.scalars().all()]

    @strawberry.field
    async def portfolio_metrics(self, info: Info) -> PortfolioMetricsType:
        """Totals across every project the user may see."""
        from backend.app.models.financial import LoanAccount
        from backend.app.models.project import Project
        from backend.app.security.rls_service import RLSService

        db, user = _context(info)

        project_query = await RLSService.scope_query(
            db,
            user,
            select(
                func.count(Project.id),
                func.count(Project.id).filter(Project.pipeline_status.in_(ACTIVE_STATUSES)),
                func.coalesce(func.sum(Project.installed_capacity_mw), 0),
            ),
        )
        total_projects, active_projects, total_capacity = (await db.execute(project_query)).one()

        loan_query = await RLSService.scope_query(
            db,
            user,
            select(
                func.coalesce(func.sum(LoanAccount.sanctioned_amount), 0),
                func.coalesce(func.sum(LoanAccount.disbursed_amount), 0),
                func.avg(LoanAccount.interest_rate_pct),
            ),
            LoanAccount.project_id,
        )
        total_sanctioned, total_disbursed, avg_rate = (await db.execute(loan_query)).one()

        return PortfolioMetricsType(
            total_projects=int(total_projects),
            active_projects=int(active_projects),
            total_capacity_mw=float(total_capacity),
            total_sanctioned=float(total_sanctioned),
            total_disbursed=float(total_disbursed),
            average_rate_pct=float(avg_rate) if avg_rate is not None else None,
        )

    @strawberry.field
    async def current_user(self, info: Info) -> Optional[UserType]:
        """The authenticated user's DB record."""
        from backend.app.models.auth import User

        db, user = _context(info)
        result = await db.execute(select(User).where(User.id == user.uuid))
        row = result.scalar_one_or_none()
        if not row:
            return None

        return UserType(
            id=row.id,
            username=row.username,
            email=row.email,
            full_name=row.full_name,
            is_active=bool(row.is_active),
            default_role=row.default_role.value if row.default_role else "guest",
            language_preference=row.language_preference or "en",
        )


@strawberry.type
class Mutation:
    """GraphQL mutations. Same permission rules as PATCH /api/v1/projects/{id}."""

    @strawberry.mutation
    async def update_project(
        self,
        id: UUID,
        info: Info,
        name_en: Optional[str] = None,
        name_np: Optional[str] = None,
        project_stage: Optional[str] = None,
        pipeline_status: Optional[str] = None,
        drop_reason: Optional[str] = None,
    ) -> ProjectType:
        """Update project fields. Admins may update any project, makers only projects they own."""
        from backend.app.models.project import PipelineStatus, Project, ProjectStage
        from backend.app.security.rls_service import RLSService

        db, user = _context(info)

        result = await db.execute(select(Project).where(Project.id == id))
        project = result.scalar_one_or_none()
        if not project or not await RLSService.can_view_project(db, user, id):
            raise ValueError(f"Project {id} not found")
        if not await RLSService.can_update_project(db, user, id):
            raise GraphQLPermissionError("Not allowed to update this project")

        changes = {
            key: value
            for key, value in {
                "name_en": name_en,
                "name_np": name_np,
                "project_stage": project_stage,
                "pipeline_status": pipeline_status,
                "drop_reason": drop_reason,
            }.items()
            if value is not None
        }
        if not changes:
            raise ValueError("No fields to update")
        if project_stage is not None and project_stage not in {s.value for s in ProjectStage}:
            raise ValueError(f"Invalid projectStage: {project_stage}")
        if pipeline_status is not None and pipeline_status not in {s.value for s in PipelineStatus}:
            raise ValueError(f"Invalid pipelineStatus: {pipeline_status}")
        if pipeline_status == PipelineStatus.DROPPED.value and not (drop_reason or project.drop_reason):
            raise ValueError("dropReason is required when dropping a project")

        for field, value in changes.items():
            setattr(project, field, value)
        project.updated_by = user.username

        await db.commit()
        await db.refresh(project)
        logger.info(f"GraphQL updated project {project.project_code} fields {sorted(changes)} by {user.username}")
        return ProjectType.from_model(project)


schema = strawberry.Schema(query=Query, mutation=Mutation)
