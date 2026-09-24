"""GraphQL schema for mobile API.

Type-safe GraphQL queries for mobile-friendly data access.
"""

from typing import Optional, List
from datetime import datetime
from uuid import UUID
import strawberry
from strawberry.types import Info

import logging

logger = logging.getLogger(__name__)


@strawberry.type
class ProjectType:
    """Project GraphQL type for mobile (maps to backend Project model columns)."""

    id: UUID
    project_code: str  # Unique project identifier
    name_en: str  # English name (use name_np for Nepali via i18n)
    installed_capacity_mw: float  # Technical capacity in MW
    province: str
    district: str
    pipeline_status: str  # Proposal, Under Review, Approved, Dropped, etc.
    project_stage: str  # Feasibility, Construction, Operation
    rate: Optional[float] = None  # Interest rate (from related LoanAccount, not on Project)
    original_cod_ad: Optional[datetime] = None  # Original Commercial Operation Date
    forecast_cod_ad: Optional[datetime] = None  # Forecast COD
    description: Optional[str] = None


@strawberry.type
class LoanAccountType:
    """Loan account GraphQL type for mobile."""

    id: UUID
    project_id: UUID
    bank_name: str
    loan_amount: float
    disbursed_amount: float
    remaining_amount: float
    status: str
    interest_rate: float
    tenor_years: int
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


@strawberry.type
class RateType:
    """Interest rate GraphQL type for mobile."""

    id: UUID
    loan_account_id: UUID
    rate: float
    rate_type: str  # fixed, floating, stepped
    effective_date: datetime
    end_date: Optional[datetime] = None
    tenor_years: int


@strawberry.type
class UserType:
    """User GraphQL type for mobile."""

    id: UUID
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    default_role: str


@strawberry.type
class PortfolioMetricsType:
    """Portfolio metrics for dashboard."""

    total_projects: int
    total_capacity_mw: float
    total_loan_amount: float
    total_disbursed: float
    active_projects: int
    average_rate: float
    average_tenor_years: int


@strawberry.type
class CovenantMetricsType:
    """Covenant compliance metrics."""

    dscr: float
    ltv: float
    icr: float
    dscr_pass: bool
    ltv_pass: bool
    icr_pass: bool


@strawberry.type
class CapexMetricsType:
    """Capital expenditure metrics."""

    total_budgeted: float
    total_spent: float
    total_remaining: float
    total_pct: float
    civil_budgeted: float
    civil_spent: float
    civil_pct: float
    equip_budgeted: float
    equip_spent: float
    equip_pct: float


@strawberry.type
class PageInfoType:
    """Pagination information for cursor-based nav."""

    has_next_page: bool
    has_previous_page: bool
    start_cursor: Optional[str] = None
    end_cursor: Optional[str] = None
    total_count: int


@strawberry.type
class ProjectConnectionType:
    """Connection type for projects (cursor pagination)."""

    edges: List["ProjectEdgeType"]
    page_info: PageInfoType


@strawberry.type
class ProjectEdgeType:
    """Edge type for project connections."""

    node: ProjectType
    cursor: str


@strawberry.type
class LoanConnectionType:
    """Connection type for loan accounts."""

    edges: List["LoanEdgeType"]
    page_info: PageInfoType


@strawberry.type
class LoanEdgeType:
    """Edge type for loan connections."""

    node: LoanAccountType
    cursor: str


@strawberry.type
class Query:
    """GraphQL queries for mobile API."""

    @strawberry.field
    async def project(
        self,
        id: UUID,
        info: Info,
    ) -> Optional[ProjectType]:
        """Get single project by ID.

        Args:
            id: Project UUID

        Returns:
            Project with full details or null
        """

        try:
            db = info.context.get("db")
            user_id = info.context.get("user_id")

            if not db or not user_id:
                logger.error("Missing database or user context")
                return None

            from sqlalchemy import select
            from backend.app.models.project import Project

            query = select(Project).where(Project.id == id)
            result = await db.execute(query)
            project_row = result.scalar_one_or_none()

            if not project_row:
                return None

            return ProjectType(
                id=project_row.id,
                project_code=project_row.project_code,
                name_en=project_row.name_en,
                installed_capacity_mw=float(project_row.installed_capacity_mw or 0),
                province=project_row.province or "",
                district=project_row.district or "",
                pipeline_status=project_row.pipeline_status or "unknown",
                project_stage=project_row.project_stage or "feasibility",
                rate=None,  # Rate is on LoanAccount, not Project
                original_cod_ad=project_row.original_cod_ad,
                forecast_cod_ad=project_row.forecast_cod_ad,
                description=None,  # Project model doesn't have description field
            )

        except Exception as e:
            logger.error(f"Error fetching project: {e}")
            return None

    @strawberry.field
    async def projects(
        self,
        first: int = 10,
        after: Optional[str] = None,
        status: Optional[str] = None,
        info: Info = None,
    ) -> ProjectConnectionType:
        """Get paginated projects with cursor pagination.

        Args:
            first: Number of projects to return (default 10, max 100)
            after: Cursor for pagination
            status: Filter by status (active, inactive, planned)

        Returns:
            Connection with edges and page info
        """

        try:
            from sqlalchemy import select
            from backend.app.models.project import Project
            import base64

            db = info.context.get("db")
            user_id = info.context.get("user_id")

            if not db or not user_id:
                return ProjectConnectionType(edges=[], page_info=PageInfoType(
                    has_next_page=False,
                    has_previous_page=False,
                    total_count=0,
                ))

            # Limit to 100 for mobile
            first = min(first, 100)

            # Build query
            query = select(Project)

            # Filter by pipeline_status (not "status" - that's a GraphQL param name)
            if status:
                query = query.where(Project.pipeline_status == status)

            # Get offset from cursor
            offset = 0
            if after:
                try:
                    offset = int(base64.b64decode(after).decode())
                except Exception:
                    offset = 0

            query = query.offset(offset).limit(first + 1)

            result = await db.execute(query)
            projects = result.scalars().all()

            # Check if there are more
            has_next = len(projects) > first
            if has_next:
                projects = projects[:first]

            edges = []
            for i, proj in enumerate(projects):
                cursor = base64.b64encode(str(offset + i).encode()).decode()
                edges.append(ProjectEdgeType(
                    node=ProjectType(
                        id=proj.id,
                        project_code=proj.project_code,
                        name_en=proj.name_en,
                        installed_capacity_mw=float(proj.installed_capacity_mw or 0),
                        province=proj.province or "",
                        district=proj.district or "",
                        pipeline_status=proj.pipeline_status or "unknown",
                        project_stage=proj.project_stage or "feasibility",
                        rate=None,  # Rate is on LoanAccount
                        original_cod_ad=proj.original_cod_ad,
                        forecast_cod_ad=proj.forecast_cod_ad,
                        description=None,
                    ),
                    cursor=cursor,
                ))

            end_cursor = edges[-1].cursor if edges else None

            return ProjectConnectionType(
                edges=edges,
                page_info=PageInfoType(
                    has_next_page=has_next,
                    has_previous_page=offset > 0,
                    start_cursor=edges[0].cursor if edges else None,
                    end_cursor=end_cursor,
                    total_count=len(projects),
                ),
            )

        except Exception as e:
            logger.error(f"Error fetching projects: {e}")
            return ProjectConnectionType(edges=[], page_info=PageInfoType(
                has_next_page=False,
                has_previous_page=False,
                total_count=0,
            ))

    @strawberry.field
    async def portfolio_metrics(
        self,
        info: Info,
    ) -> Optional[PortfolioMetricsType]:
        """Get portfolio summary metrics.

        Returns:
            Aggregated portfolio statistics
        """

        try:
            from sqlalchemy import select, func
            from backend.app.models.project import Project

            db = info.context.get("db")

            if not db:
                return None

            # Query all active projects by pipeline status
            query = select(
                func.count(Project.id).label("total_projects"),
                func.sum(Project.installed_capacity_mw).label("total_capacity"),
                func.avg(Project.installed_capacity_mw).label("avg_rate"),  # No rate on Project; avg capacity as placeholder
            ).where(Project.pipeline_status == "under_operation")

            result = await db.execute(query)
            row = result.first()

            if not row:
                return PortfolioMetricsType(
                    total_projects=0,
                    total_capacity_mw=0.0,
                    total_loan_amount=0.0,
                    total_disbursed=0.0,
                    active_projects=0,
                    average_rate=0.0,
                    average_tenor_years=0,
                )

            return PortfolioMetricsType(
                total_projects=int(row[0] or 0),
                total_capacity_mw=float(row[1] or 0),
                total_loan_amount=0.0,  # Would sum from LoanAccount
                total_disbursed=0.0,  # Would sum from LoanAccount
                active_projects=int(row[0] or 0),
                average_rate=float(row[2] or 0),
                average_tenor_years=0,
            )

        except Exception as e:
            logger.error(f"Error fetching metrics: {e}")
            return None

    @strawberry.field
    async def covenant_metrics(
        self,
        info: Info,
    ) -> Optional[CovenantMetricsType]:
        """Get covenant compliance metrics.

        Returns:
            Current covenant status
        """

        # Placeholder - would fetch from database
        return CovenantMetricsType(
            dscr=1.35,
            ltv=65.0,
            icr=2.5,
            dscr_pass=True,
            ltv_pass=True,
            icr_pass=True,
        )

    @strawberry.field
    async def current_user(
        self,
        info: Info,
    ) -> Optional[UserType]:
        """Get current authenticated user.

        Returns:
            Current user details
        """

        try:
            user_id = info.context.get("user_id")

            if not user_id:
                return None

            from sqlalchemy import select
            from backend.app.models.auth import User

            db = info.context.get("db")

            if not db:
                return None

            query = select(User).where(User.id == user_id)
            result = await db.execute(query)
            user = result.scalar_one_or_none()

            if not user:
                return None

            return UserType(
                id=user.id,
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                is_active=user.is_active,
                default_role=str(user.default_role.value) if user.default_role else "guest",
            )

        except Exception as e:
            logger.error(f"Error fetching current user: {e}")
            return None


@strawberry.type
class Mutation:
    """GraphQL mutations for mobile API."""

    @strawberry.mutation
    async def update_project(
        self,
        id: UUID,
        name: Optional[str] = None,
        rate: Optional[float] = None,
        status: Optional[str] = None,
        info: Info = None,
    ) -> Optional[ProjectType]:
        """Update project details.

        Args:
            id: Project UUID
            name: New project name
            rate: New interest rate
            status: New status

        Returns:
            Updated project or null on error
        """

        try:
            from sqlalchemy import select, update
            from backend.app.models.project import Project

            db = info.context.get("db")
            user_id = info.context.get("user_id")

            if not db or not user_id:
                return None

            # Update project
            stmt = update(Project).where(Project.id == id).values()

            if name is not None:
                stmt = stmt.values(name=name)
            if rate is not None:
                stmt = stmt.values(rate=rate)
            if status is not None:
                stmt = stmt.values(status=status)

            await db.execute(stmt)
            await db.commit()

            # Fetch updated project
            query = select(Project).where(Project.id == id)
            result = await db.execute(query)
            project = result.scalar_one_or_none()

            if not project:
                return None

            return ProjectType(
                id=project.id,
                name=project.name,
                capacity_mw=float(project.capacity_mw or 0),
                province=project.province or "",
                district=project.district or "",
                status=project.status or "unknown",
                facility_type=project.facility_type or "",
                rate=float(project.rate or 0),
            )

        except Exception as e:
            logger.error(f"Error updating project: {e}")
            return None


schema = strawberry.Schema(query=Query, mutation=Mutation)
