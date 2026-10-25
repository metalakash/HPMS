"""Project documents: file a document, add versions, read them back, archive (RFP C.1, C.3, C.10, G.5).

Every version is kept; a new upload never replaces the old file. Content is encrypted before it reaches
storage when encryption is on (the default), and its SHA-256 is checked on every read, so a file that
was altered in storage is refused rather than served. Archiving hides a document from the default list;
nothing is deleted, because documents are evidence and fall under the retention policy.
"""

import hashlib
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from io import BytesIO
from pathlib import PurePath
from typing import List, Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.document import Document, DocumentClassification, DocumentStatus, DocumentVersion
from backend.app.models.project import Project
from backend.app.security import secret_box
from backend.app.storage.storage_interface import LocalStorageBackend, StorageBackend

logger = logging.getLogger(__name__)

# What the RFP asks to attach (G.5): images, PDF, Word and Excel
ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


class DocumentRejected(ValueError):
    """The file or the request cannot be accepted; the message says why, for the user."""


@dataclass
class FileContent:
    name: str
    content: bytes

    @property
    def extension(self) -> str:
        return PurePath(self.name).suffix.lower()


def safe_file_name(name: str) -> str:
    """The base name only, with characters that are awkward in paths and headers replaced."""
    base = PurePath(name.replace("\\", "/")).name.strip() or "file"
    return re.sub(r"[^\w.\- ()]", "_", base)[:200]


class DocumentService:
    """File, version, read and archive project documents."""

    def __init__(self, storage_backend: Optional[StorageBackend] = None, encryption_enabled: bool = False,
                 max_bytes: int = 10 * 1024 * 1024):
        self.storage = storage_backend or LocalStorageBackend()
        self.encryption_enabled = encryption_enabled
        self.max_bytes = max_bytes

    def check_file(self, file: FileContent) -> str:
        """The MIME type to record; refuses empty, oversized and unsupported files."""
        if file.extension not in ALLOWED_TYPES:
            raise DocumentRejected(
                f"{file.name}: this file type is not accepted. Attach a PDF, image (jpg, png), Word or Excel file")
        if not file.content:
            raise DocumentRejected(f"{file.name} is empty")
        if len(file.content) > self.max_bytes:
            raise DocumentRejected(
                f"{file.name} is {len(file.content) / 1048576:.1f} MB; the limit is {self.max_bytes // 1048576} MB")
        return ALLOWED_TYPES[file.extension]

    async def create_document(
        self, db: AsyncSession, *, project: Project, title: str, classification: str, file: FileContent,
        user_id: str, document_date: Optional[date] = None, expiry_date: Optional[date] = None,
        description: Optional[str] = None, source_reference: Optional[str] = None,
        upload_comment: Optional[str] = None,
    ) -> tuple[Document, DocumentVersion]:
        """File a new document with its first version."""
        try:
            classification = DocumentClassification(classification).value
        except ValueError:
            raise DocumentRejected(f"Unknown document type {classification!r}")
        if not title.strip():
            raise DocumentRejected("A document needs a title")
        self.check_file(file)

        sequence = (await db.execute(
            select(func.count()).select_from(Document).where(Document.project_id == project.id))).scalar() + 1
        doc = Document(
            id=uuid.uuid4(), project_id=project.id, document_code=f"{project.project_code}-D{sequence:03d}-{uuid.uuid4().hex[:4]}",
            title=title.strip()[:255], description=description, classification=classification,
            status=DocumentStatus.APPROVED.value, document_date=document_date, expiry_date=expiry_date,
            requires_approval="N", source_reference=source_reference, file_count=0, total_size_bytes=0,
            created_by=user_id, updated_by=user_id, created_at=datetime.now(timezone.utc))
        db.add(doc)
        await db.flush()
        version = await self.add_version(db, doc, file, user_id=user_id, upload_comment=upload_comment)
        return doc, version

    async def add_version(self, db: AsyncSession, doc: Document, file: FileContent, *, user_id: str,
                          upload_comment: Optional[str] = None, change_summary: Optional[str] = None) -> DocumentVersion:
        """Store a new version and make it the current one. Earlier versions stay readable."""
        if doc.status == DocumentStatus.ARCHIVED.value:
            raise DocumentRejected("This document is archived; file a new document instead")
        mime_type = self.check_file(file)
        number = (await db.execute(select(func.coalesce(func.max(DocumentVersion.version_number), 0))
                                   .where(DocumentVersion.document_id == doc.id))).scalar() + 1
        name = safe_file_name(file.name)
        path = f"projects/{doc.project_id}/documents/{doc.id}/v{number}/{uuid.uuid4().hex}{file.extension}"
        stored = secret_box.encrypt_bytes(file.content) if self.encryption_enabled else file.content
        metadata = await self.storage.upload(path, BytesIO(stored), mime_type)
        checksum = hashlib.sha256(file.content).hexdigest()

        await db.execute(update(DocumentVersion).where(DocumentVersion.document_id == doc.id,
                                                       DocumentVersion.is_current == "Y").values(is_current="N"))
        version = DocumentVersion(
            id=uuid.uuid4(), document_id=doc.id, version_number=number, is_current="Y", file_name=name,
            file_size_bytes=len(file.content), file_hash=checksum, mime_type=mime_type, storage_path=path,
            storage_backend=metadata.backend, content_encrypted="Y" if self.encryption_enabled else "N",
            content_checksum=checksum, upload_comment=upload_comment, change_summary=change_summary,
            created_by=user_id, updated_by=user_id, created_at=datetime.now(timezone.utc))
        db.add(version)
        doc.file_count = number
        doc.total_size_bytes = (doc.total_size_bytes or 0) + len(file.content)
        doc.updated_by = user_id
        await db.flush()
        logger.info("Filed %s v%s (%s bytes)", doc.document_code, number, len(file.content))
        return version

    async def list_documents(self, db: AsyncSession, project_id, include_archived: bool = False) -> List[Document]:
        query = select(Document).where(Document.project_id == project_id)
        if not include_archived:
            query = query.where(Document.status != DocumentStatus.ARCHIVED.value)
        return list((await db.execute(query.order_by(Document.document_date.desc().nulls_last(),
                                                     Document.created_at.desc()))).scalars())

    async def current_versions(self, db: AsyncSession, document_ids) -> dict:
        if not document_ids:
            return {}
        rows = (await db.execute(select(DocumentVersion).where(
            DocumentVersion.document_id.in_(document_ids), DocumentVersion.is_current == "Y"))).scalars()
        return {row.document_id: row for row in rows}

    async def get_version_history(self, db: AsyncSession, document_id) -> List[DocumentVersion]:
        return list((await db.execute(select(DocumentVersion).where(DocumentVersion.document_id == document_id)
                                      .order_by(DocumentVersion.version_number.desc()))).scalars())

    async def read_version(self, version: DocumentVersion) -> bytes:
        """The original file. Refuses content whose checksum no longer matches what was filed."""
        try:
            stored = (await self.storage.download(version.storage_path)).read()
        except FileNotFoundError:
            raise DocumentRejected("The file for this version is missing from storage")
        content = secret_box.decrypt_bytes(stored) if version.content_encrypted == "Y" else stored
        if hashlib.sha256(content).hexdigest() != version.file_hash:
            logger.error("Checksum mismatch for document version %s", version.id)
            raise DocumentRejected("This file has changed since it was filed and cannot be served")
        return content

    async def archive_document(self, db: AsyncSession, doc: Document, user_id: str) -> Document:
        doc.status = DocumentStatus.ARCHIVED.value
        doc.updated_by = user_id
        await db.flush()
        return doc
