"""An upload of the bank's two portfolio workbooks, kept from preview until a second admin approves it."""

import uuid

from sqlalchemy import Boolean, Column, DateTime, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from .base import Base


class BankImport(Base):
    """The files as uploaded (encrypted), the reconciliation shown at preview, and the result once applied.

    The approval request that loads it has entity_type BANK_IMPORT and entity_id = this id. The
    content hashes bind the request to exactly the files that were previewed.
    """

    __tablename__ = "bank_imports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(String(20), nullable=False, default="previewed")  # previewed, applied, failed
    projection_filename = Column(String(255), nullable=False)
    generation_filename = Column(String(255), nullable=False)
    projection_sha256 = Column(String(64), nullable=False)
    generation_sha256 = Column(String(64), nullable=False)
    projection_content = Column(LargeBinary, nullable=False)  # encrypted by secret_box
    generation_content = Column(LargeBinary, nullable=False)
    summary = Column(JSONB, nullable=False)
    agrees = Column(Boolean, nullable=False, default=False)
    replaces = Column(JSONB)  # what the load would remove, counted at preview
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    applied_by = Column(String(100))
    applied_at = Column(DateTime(timezone=True))
    result = Column(JSONB)
