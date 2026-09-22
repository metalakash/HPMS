"""Unit tests for document vault service and storage backend.

Tests document creation, versioning, uploads, approvals, and local storage.
"""

import pytest
from datetime import date
from io import BytesIO
import tempfile
import os

from backend.app.models.document import DocumentClassification
from backend.app.services.document_service import DocumentService
from backend.app.storage.storage_interface import (
    LocalStorageBackend,
    get_storage_backend,
    StorageMetadata,
)


class TestLocalStorageBackend:
    """Test local filesystem storage backend."""

    @pytest.fixture
    def temp_storage(self):
        """Create temporary directory for storage testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield LocalStorageBackend(base_path=tmpdir)

    @pytest.mark.asyncio
    async def test_upload_file(self, temp_storage):
        """Upload file to local storage."""
        file_content = BytesIO(b"Test file content for document vault")

        metadata = await temp_storage.upload(
            file_path="projects/PRJ001/doc001.pdf",
            file_content=file_content,
            mime_type="application/pdf",
        )

        assert metadata.path == "projects/PRJ001/doc001.pdf"
        assert metadata.size_bytes == len(b"Test file content for document vault")
        assert metadata.mime_type == "application/pdf"
        assert len(metadata.hash_sha256) == 64  # SHA-256 hex string
        assert metadata.backend == "local"

    @pytest.mark.asyncio
    async def test_download_file(self, temp_storage):
        """Download file from local storage."""
        # Upload first
        original_content = b"Test content for download"
        file_content = BytesIO(original_content)

        await temp_storage.upload(
            file_path="projects/PRJ001/doc002.pdf",
            file_content=file_content,
            mime_type="application/pdf",
        )

        # Download
        downloaded = await temp_storage.download("projects/PRJ001/doc002.pdf")
        assert downloaded.read() == original_content
        downloaded.close()

    @pytest.mark.asyncio
    async def test_file_not_found(self, temp_storage):
        """Download non-existent file raises error."""
        with pytest.raises(FileNotFoundError):
            await temp_storage.download("nonexistent/file.pdf")

    @pytest.mark.asyncio
    async def test_exists_file(self, temp_storage):
        """Check file existence."""
        # Upload file
        file_content = BytesIO(b"Test content")
        await temp_storage.upload(
            file_path="projects/PRJ001/doc003.pdf",
            file_content=file_content,
            mime_type="application/pdf",
        )

        # Check existence
        assert await temp_storage.exists("projects/PRJ001/doc003.pdf")
        assert not await temp_storage.exists("nonexistent.pdf")

    @pytest.mark.asyncio
    async def test_delete_file(self, temp_storage):
        """Delete file from storage."""
        # Upload file
        file_content = BytesIO(b"Test content")
        await temp_storage.upload(
            file_path="projects/PRJ001/doc004.pdf",
            file_content=file_content,
            mime_type="application/pdf",
        )

        # Delete
        result = await temp_storage.delete("projects/PRJ001/doc004.pdf")
        assert result is True

        # Verify deleted
        assert not await temp_storage.exists("projects/PRJ001/doc004.pdf")

    @pytest.mark.asyncio
    async def test_get_metadata(self, temp_storage):
        """Get metadata for stored file."""
        # Upload file
        original_content = b"Metadata test content"
        file_content = BytesIO(original_content)

        await temp_storage.upload(
            file_path="projects/PRJ001/doc005.pdf",
            file_content=file_content,
            mime_type="application/pdf",
        )

        # Get metadata
        metadata = await temp_storage.get_metadata("projects/PRJ001/doc005.pdf")

        assert metadata.path == "projects/PRJ001/doc005.pdf"
        assert metadata.size_bytes == len(original_content)
        assert len(metadata.hash_sha256) == 64
        assert metadata.backend == "local"


class TestStorageBackendFactory:
    """Test storage backend factory."""

    def test_get_local_backend(self):
        """Factory creates local backend."""
        backend = get_storage_backend("local", base_path="/tmp/test")
        assert isinstance(backend, LocalStorageBackend)

    def test_get_s3_backend_stub(self):
        """Factory creates S3 stub (not implemented)."""
        backend = get_storage_backend("s3", bucket_name="test-bucket")
        # S3 backend is stub in Phase 2
        with pytest.raises(NotImplementedError):
            import asyncio
            asyncio.run(backend.upload("test", BytesIO(b"test"), "text/plain"))

    def test_unknown_backend(self):
        """Factory raises error for unknown backend."""
        with pytest.raises(ValueError, match="Unknown storage backend"):
            get_storage_backend("unknown")


class TestDocumentService:
    """Test document service (requires DB mock or fixtures in real tests)."""

    @pytest.fixture
    def doc_service(self):
        """Create document service with local storage."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = LocalStorageBackend(base_path=tmpdir)
            yield DocumentService(storage_backend=storage, encryption_enabled=False)

    def test_service_initialization(self, doc_service):
        """Document service initializes with storage backend."""
        assert doc_service.storage is not None
        assert doc_service.encryption_enabled is False

    def test_service_encryption_flag(self):
        """Document service can enable encryption flag."""
        service = DocumentService(encryption_enabled=True)
        assert service.encryption_enabled is True


class TestDocumentClassification:
    """Test document classification enum."""

    def test_classification_values(self):
        """Classification enum has expected values."""
        classifications = [
            "project_charter",
            "ppa",
            "environmental_clearance",
            "land_deed",
            "water_license",
            "board_approval",
            "technical_report",
            "financial_analysis",
            "contract",
            "insurance",
            "other",
        ]

        for cls in classifications:
            enum_val = DocumentClassification(cls)
            assert enum_val.value == cls


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
