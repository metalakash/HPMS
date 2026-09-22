"""Document management service with versioning and audit trail.

Handles document uploads, version tracking, approval workflows,
and encryption for sensitive content.
"""

import logging
from datetime import date, datetime
from typing import Optional, BinaryIO
import uuid
import hashlib

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.exc import IntegrityError

from backend.app.models.document import (
    Document,
    DocumentVersion,
    DocumentApprovalRequest,
    DocumentClassification,
    DocumentStatus,
)
from backend.app.models.project import Project
from backend.app.storage.storage_interface import StorageBackend, LocalStorageBackend
from backend.app.integration.finacle_schema import FinacleFieldMapping

logger = logging.getLogger(__name__)


class DocumentService:
    """Manage document lifecycle: upload, version, approve, archive."""

    def __init__(
        self,
        storage_backend: Optional[StorageBackend] = None,
        encryption_enabled: bool = False,
    ):
        self.storage = storage_backend or LocalStorageBackend()
        self.encryption_enabled = encryption_enabled

    async def create_document(
        self,
        db: AsyncSession,
        project_id: str,
        document_code: str,
        title: str,
        classification: DocumentClassification,
        document_date: date,
        requires_approval: bool = False,
        source_reference: Optional[str] = None,
        user_id: str = "SYSTEM",
    ) -> Document:
        """Create new document master record.

        Args:
            db: async database session
            project_id: FK to projects
            document_code: unique document identifier
            title: document title
            classification: document type
            document_date: when document was created
            requires_approval: if True, upload won't activate until approved
            source_reference: audit trail (e.g., "Board Meeting 2026-09-15")
            user_id: who is creating

        Returns:
            Document object (not yet persisted; needs db.add)
        """

        # Verify project exists
        stmt = select(Project).where(Project.id == project_id)
        result = await db.execute(stmt)
        if not result.scalar_one_or_none():
            raise ValueError(f"Project {project_id} not found")

        # Create document
        doc = Document(
            id=uuid.uuid4(),
            project_id=project_id,
            document_code=document_code,
            title=title,
            classification=classification.value,
            status=DocumentStatus.DRAFT.value if requires_approval else DocumentStatus.UNDER_REVIEW.value,
            document_date=document_date,
            requires_approval='Y' if requires_approval else 'N',
            source_reference=source_reference,
            created_by=user_id,
            updated_by=user_id,
        )

        db.add(doc)

        try:
            await db.flush()
        except IntegrityError as e:
            logger.error(f"Failed to create document {document_code}: {e}")
            raise ValueError(f"Document code {document_code} already exists")

        logger.info(f"Created document {document_code} ({title})")
        return doc

    async def upload_version(
        self,
        db: AsyncSession,
        document_id: str,
        file_content: BinaryIO,
        file_name: str,
        mime_type: str = "application/octet-stream",
        upload_comment: Optional[str] = None,
        change_summary: Optional[str] = None,
        user_id: str = "SYSTEM",
    ) -> DocumentVersion:
        """Upload new version of document.

        Args:
            db: async database session
            document_id: which document to add version to
            file_content: binary file stream
            file_name: original file name
            mime_type: MIME type (e.g., 'application/pdf')
            upload_comment: why this version (e.g., "Updated by legal review")
            change_summary: what changed from previous
            user_id: who uploaded

        Returns:
            DocumentVersion object
        """

        # Get document
        stmt = select(Document).where(Document.id == document_id)
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        # Get next version number
        stmt = select(func.coalesce(func.max(DocumentVersion.version_number), 0)).where(
            DocumentVersion.document_id == document_id
        )
        result = await db.execute(stmt)
        next_version = result.scalar() + 1

        # Upload to storage
        storage_path = f"projects/{doc.project_id}/documents/{doc.document_code}/v{next_version}/{file_name}"

        try:
            metadata = await self.storage.upload(storage_path, file_content, mime_type)
        except IOError as e:
            logger.error(f"Failed to upload file: {e}")
            raise ValueError(f"File upload failed: {str(e)}")

        # Create version record
        version = DocumentVersion(
            id=uuid.uuid4(),
            document_id=document_id,
            version_number=next_version,
            is_current='Y',
            file_name=file_name,
            file_size_bytes=metadata.size_bytes,
            file_hash=metadata.hash_sha256,
            mime_type=mime_type,
            storage_path=storage_path,
            storage_backend=metadata.backend,
            content_encrypted='Y' if self.encryption_enabled else 'N',
            upload_comment=upload_comment,
            change_summary=change_summary,
            created_by=user_id,
            updated_by=user_id,
        )

        # Mark prior version as not current
        if next_version > 1:
            stmt = (
                update(DocumentVersion)
                .where(
                    (DocumentVersion.document_id == document_id) &
                    (DocumentVersion.is_current == 'Y')
                )
                .values(is_current='N')
            )
            await db.execute(stmt)

        # Update document metadata
        update_data = {
            'file_count': next_version,
            'total_size_bytes': (doc.total_size_bytes or 0) + metadata.size_bytes,
            'updated_by': user_id,
        }
        stmt = update(Document).where(Document.id == document_id).values(**update_data)
        await db.execute(stmt)

        db.add(version)

        try:
            await db.flush()
        except Exception as e:
            logger.error(f"Failed to create document version: {e}")
            # Try to clean up uploaded file
            try:
                await self.storage.delete(storage_path)
            except:
                pass
            raise ValueError(f"Failed to create version: {str(e)}")

        logger.info(
            f"Uploaded document version: {doc.document_code} v{next_version} "
            f"({metadata.size_bytes} bytes, {metadata.hash_sha256[:8]}...)"
        )

        return version

    async def approve_document(
        self,
        db: AsyncSession,
        document_id: str,
        approver_id: str,
        approval_remarks: Optional[str] = None,
    ) -> Document:
        """Approve document (transition to APPROVED status).

        Args:
            db: async database session
            document_id: which document to approve
            approver_id: who is approving
            approval_remarks: why/how approved

        Returns:
            Updated Document
        """

        # Get document
        stmt = select(Document).where(Document.id == document_id)
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        # Update status
        update_data = {
            'status': DocumentStatus.APPROVED.value,
            'approved_by': approver_id,
            'approval_date': date.today(),
            'approval_remarks': approval_remarks,
            'updated_by': approver_id,
        }

        stmt = update(Document).where(Document.id == document_id).values(**update_data)
        await db.execute(stmt)

        logger.info(f"Approved document {doc.document_code} by {approver_id}")

        return doc

    async def reject_document(
        self,
        db: AsyncSession,
        document_id: str,
        rejector_id: str,
        rejection_reason: str,
    ) -> Document:
        """Reject document (transition to REJECTED status).

        Args:
            db: async database session
            document_id: which document to reject
            rejector_id: who is rejecting
            rejection_reason: why rejected

        Returns:
            Updated Document
        """

        # Get document
        stmt = select(Document).where(Document.id == document_id)
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        # Update status
        update_data = {
            'status': DocumentStatus.REJECTED.value,
            'approval_remarks': rejection_reason,
            'updated_by': rejector_id,
        }

        stmt = update(Document).where(Document.id == document_id).values(**update_data)
        await db.execute(stmt)

        logger.info(f"Rejected document {doc.document_code}: {rejection_reason}")

        return doc

    async def get_current_version(
        self,
        db: AsyncSession,
        document_id: str,
    ) -> Optional[DocumentVersion]:
        """Get current (active) version of document.

        Args:
            db: async database session
            document_id: which document

        Returns:
            DocumentVersion or None if no versions
        """

        stmt = select(DocumentVersion).where(
            (DocumentVersion.document_id == document_id) &
            (DocumentVersion.is_current == 'Y')
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_version_history(
        self,
        db: AsyncSession,
        document_id: str,
    ) -> list[DocumentVersion]:
        """Get all versions of document (newest first).

        Args:
            db: async database session
            document_id: which document

        Returns:
            List of DocumentVersion ordered by version_number DESC
        """

        stmt = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .order_by(DocumentVersion.version_number.desc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def download_version(
        self,
        db: AsyncSession,
        version_id: str,
    ) -> tuple[BinaryIO, DocumentVersion]:
        """Download specific version of document.

        Args:
            db: async database session
            version_id: which version to download

        Returns:
            (binary file stream, DocumentVersion metadata)
        """

        # Get version
        stmt = select(DocumentVersion).where(DocumentVersion.id == version_id)
        result = await db.execute(stmt)
        version = result.scalar_one_or_none()
        if not version:
            raise ValueError(f"Document version {version_id} not found")

        # Download from storage
        try:
            file_stream = await self.storage.download(version.storage_path)
        except FileNotFoundError:
            logger.error(f"File not found in storage: {version.storage_path}")
            raise ValueError(f"Document file not found (may have been archived)")

        logger.info(f"Downloaded document version {version_id} ({version.file_name})")

        return file_stream, version

    async def archive_document(
        self,
        db: AsyncSession,
        document_id: str,
        user_id: str = "SYSTEM",
    ) -> Document:
        """Archive document (transition to ARCHIVED status).

        Note: Files are NOT deleted; they're just marked inactive.
        For compliance, files must be retained per AUDIT_RETENTION_YEARS.

        Args:
            db: async database session
            document_id: which document to archive
            user_id: who is archiving

        Returns:
            Updated Document
        """

        # Get document
        stmt = select(Document).where(Document.id == document_id)
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        # Update status
        update_data = {
            'status': DocumentStatus.ARCHIVED.value,
            'updated_by': user_id,
        }

        stmt = update(Document).where(Document.id == document_id).values(**update_data)
        await db.execute(stmt)

        logger.info(f"Archived document {doc.document_code}")

        return doc
