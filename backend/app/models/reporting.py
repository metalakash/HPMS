"""Saved report definitions for the filter-driven report builder (RFP F.5, F.6, F.10)."""
import uuid

from sqlalchemy import Boolean, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from .base import Base, TimestampedMixin


class ReportDefinition(Base, TimestampedMixin):
    """A named report: a source, the columns to show, and the filters to apply."""

    __tablename__ = 'report_definitions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    source = Column(String(50), nullable=False, index=True)  # key in report_builder.SOURCES
    columns = Column(JSONB)  # ordered list of column names; null = all
    filters = Column(JSONB)  # ExportFilter fields: province, district, local_level, status, ...
    sort_by = Column(String(100))
    sort_desc = Column(Boolean, default=False)
    default_format = Column(String(20), default='excel')
    is_shared = Column(Boolean, default=False)  # visible to every report user, not just the owner
    owner_username = Column(String(255), nullable=False, index=True)
