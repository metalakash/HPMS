"""Authentication models for user accounts and role management."""

from sqlalchemy import Column, String, Boolean, Date, Index, ForeignKey, Table, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from enum import Enum
import uuid
from .base import Base, TimestampedMixin


def _enum_values(enum_cls):
    return [member.value for member in enum_cls]


class UserRole(str, Enum):
    """User roles for authorization."""
    ADMIN = "admin"
    MAKER = "maker"
    APPROVER = "approver"
    AUDITOR = "auditor"
    GUEST = "guest"


class User(Base, TimestampedMixin):
    """User account linked to Active Directory.

    One user can belong to multiple projects (via project_owners).
    """

    __tablename__ = 'user'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # AD sync
    username = Column(String(255), nullable=False, unique=True, index=True)  # sAMAccountName
    email = Column(String(255), nullable=False, unique=True)  # mail
    full_name = Column(String(255))  # displayName
    ad_distinguished_name = Column(String(1000))  # DN from AD

    # Account status
    is_active = Column(Boolean, default=True, index=True)
    is_ad_synced = Column(Boolean, default=False)  # Synced from AD?
    last_login_at = Column(Date)
    last_ad_sync_at = Column(Date)

    # Default role (can have multiple via role_assignments)
    default_role = Column(
        SQLEnum(UserRole, native_enum=False, length=50, values_callable=_enum_values),
        default=UserRole.GUEST,
    )

    # Language preference (Phase 4 Task 5)
    language_preference = Column(String(10), default="en")  # en, ne

    # Relationships
    role_assignments = relationship("UserRoleAssignment", back_populates="user", cascade="all, delete-orphan")
    project_owners = relationship(
        "ProjectOwner",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="ProjectOwner.user_id",
    )

    __table_args__ = (
        Index("ix_user_username", "username"),
        Index("ix_user_email", "email"),
        Index("ix_user_is_active", "is_active"),
    )


class UserRoleAssignment(Base, TimestampedMixin):
    """User role assignments (many-to-many)."""
    
    __tablename__ = 'user_role_assignment'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, index=True)
    role = Column(SQLEnum(UserRole, native_enum=False, length=50, values_callable=_enum_values), nullable=False)

    # Role validity window (optional)
    valid_from = Column(Date)
    valid_to = Column(Date)

    # Relationships
    user = relationship("User", back_populates="role_assignments")

    __table_args__ = (
        Index("ix_role_user_role", "user_id", "role"),
    )


class ProjectOwner(Base, TimestampedMixin):
    """Project ownership for row-level security.

    Users can own projects directly or via consortium membership.
    """

    __tablename__ = 'project_owner'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    # Ownership type
    ownership_type = Column(String(50))  # direct, consortium_member, lead_bank

    # Ownership validity
    valid_from = Column(Date)
    valid_to = Column(Date)

    # Relationships
    user = relationship("User", back_populates="project_owners", foreign_keys=[user_id])
    project = relationship("Project", back_populates="project_owners", foreign_keys=[project_id])

    __table_args__ = (
        Index("ix_owner_user_project", "user_id", "project_id"),
        Index("ix_owner_project", "project_id"),
    )
