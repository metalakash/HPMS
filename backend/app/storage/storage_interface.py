"""Abstract storage interface for document files.

Allows swapping storage backends (local filesystem, S3, etc.) without
changing document service code.
"""

from abc import ABC, abstractmethod
from typing import Optional, BinaryIO
from dataclasses import dataclass
import hashlib


@dataclass
class StorageMetadata:
    """Metadata about stored file."""

    path: str  # Storage backend path
    size_bytes: int
    mime_type: str
    hash_sha256: str  # SHA-256 hash of file content
    backend: str  # 'local', 's3', etc.


class StorageBackend(ABC):
    """Abstract interface for document storage backends."""

    @abstractmethod
    async def upload(
        self,
        file_path: str,
        file_content: BinaryIO,
        mime_type: str,
    ) -> StorageMetadata:
        """Upload file to storage backend.

        Args:
            file_path: relative path in storage (e.g., 'projects/PRJ001/doc001.pdf')
            file_content: binary file stream
            mime_type: MIME type (e.g., 'application/pdf')

        Returns:
            StorageMetadata with size, hash, and storage path

        Raises:
            IOError: if upload fails
        """
        pass

    @abstractmethod
    async def download(self, file_path: str) -> BinaryIO:
        """Download file from storage backend.

        Args:
            file_path: storage backend path

        Returns:
            Binary file stream

        Raises:
            FileNotFoundError: if file doesn't exist
            IOError: if download fails
        """
        pass

    @abstractmethod
    async def delete(self, file_path: str) -> bool:
        """Delete file from storage backend.

        Args:
            file_path: storage backend path

        Returns:
            True if deleted, False if already gone

        Note:
            For compliance, actual deletion may be deferred
            (soft delete / archive) until retention period expires.
        """
        pass

    @abstractmethod
    async def exists(self, file_path: str) -> bool:
        """Check if file exists in storage backend."""
        pass

    @abstractmethod
    async def get_metadata(self, file_path: str) -> StorageMetadata:
        """Get metadata (size, hash) for stored file."""
        pass


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage (development and on-premise SAN).

    Files stored in configured base directory, preserving relative paths.
    Suitable for on-premise deployment with LUKS/SAN encryption at rest.
    """

    def __init__(self, base_path: str = "/var/hpms/documents"):
        """Initialize local storage backend.

        Args:
            base_path: root directory for document storage
        """
        self.base_path = base_path
        self.backend_name = "local"

    async def upload(
        self,
        file_path: str,
        file_content: BinaryIO,
        mime_type: str,
    ) -> StorageMetadata:
        """Upload file to local filesystem."""
        import os
        from pathlib import Path

        # Construct full path
        full_path = os.path.join(self.base_path, file_path)

        # Create directories if needed
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Write file and compute hash
        sha256_hash = hashlib.sha256()
        file_size = 0

        try:
            with open(full_path, 'wb') as f:
                while chunk := file_content.read(8192):
                    f.write(chunk)
                    sha256_hash.update(chunk)
                    file_size += len(chunk)
        except Exception as e:
            raise IOError(f"Failed to upload file to {full_path}: {str(e)}")

        return StorageMetadata(
            path=file_path,
            size_bytes=file_size,
            mime_type=mime_type,
            hash_sha256=sha256_hash.hexdigest(),
            backend=self.backend_name,
        )

    async def download(self, file_path: str) -> BinaryIO:
        """Download file from local filesystem."""
        import os

        full_path = os.path.join(self.base_path, file_path)

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        try:
            return open(full_path, 'rb')
        except Exception as e:
            raise IOError(f"Failed to download file from {full_path}: {str(e)}")

    async def delete(self, file_path: str) -> bool:
        """Delete file from local filesystem."""
        import os

        full_path = os.path.join(self.base_path, file_path)

        if not os.path.exists(full_path):
            return False

        try:
            os.remove(full_path)
            # Clean up empty directories
            try:
                os.removedirs(os.path.dirname(full_path))
            except OSError:
                pass  # Directory not empty or already gone
            return True
        except Exception as e:
            raise IOError(f"Failed to delete file {full_path}: {str(e)}")

    async def exists(self, file_path: str) -> bool:
        """Check if file exists in local filesystem."""
        import os

        full_path = os.path.join(self.base_path, file_path)
        return os.path.exists(full_path)

    async def get_metadata(self, file_path: str) -> StorageMetadata:
        """Get metadata for file in local filesystem."""
        import os

        full_path = os.path.join(self.base_path, file_path)

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Compute hash
        sha256_hash = hashlib.sha256()
        try:
            with open(full_path, 'rb') as f:
                while chunk := f.read(8192):
                    sha256_hash.update(chunk)
        except Exception as e:
            raise IOError(f"Failed to compute hash for {full_path}: {str(e)}")

        file_size = os.path.getsize(full_path)

        return StorageMetadata(
            path=file_path,
            size_bytes=file_size,
            mime_type='application/octet-stream',  # Would need to detect
            hash_sha256=sha256_hash.hexdigest(),
            backend=self.backend_name,
        )


class S3StorageBackend(StorageBackend):
    """AWS S3 storage backend (Phase 3+).

    Stub implementation for future cloud storage support.
    """

    def __init__(self, bucket_name: str, region: str = "us-east-1"):
        """Initialize S3 storage backend (stub).

        Args:
            bucket_name: S3 bucket name
            region: AWS region
        """
        self.bucket_name = bucket_name
        self.region = region
        self.backend_name = "s3"

    async def upload(self, file_path: str, file_content: BinaryIO, mime_type: str) -> StorageMetadata:
        raise NotImplementedError("S3 storage backend not available in Phase 2")

    async def download(self, file_path: str) -> BinaryIO:
        raise NotImplementedError("S3 storage backend not available in Phase 2")

    async def delete(self, file_path: str) -> bool:
        raise NotImplementedError("S3 storage backend not available in Phase 2")

    async def exists(self, file_path: str) -> bool:
        raise NotImplementedError("S3 storage backend not available in Phase 2")

    async def get_metadata(self, file_path: str) -> StorageMetadata:
        raise NotImplementedError("S3 storage backend not available in Phase 2")


def get_storage_backend(backend_type: str = "local", **kwargs) -> StorageBackend:
    """Factory to get storage backend implementation.

    Args:
        backend_type: 'local' or 's3'
        **kwargs: backend-specific arguments (base_path for local, bucket_name for s3)

    Returns:
        StorageBackend instance
    """
    if backend_type == "local":
        return LocalStorageBackend(base_path=kwargs.get("base_path", "/var/hpms/documents"))
    elif backend_type == "s3":
        return S3StorageBackend(
            bucket_name=kwargs.get("bucket_name"),
            region=kwargs.get("region", "us-east-1"),
        )
    else:
        raise ValueError(f"Unknown storage backend: {backend_type}")
