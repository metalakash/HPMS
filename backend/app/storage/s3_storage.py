"""S3 storage backend for exporting reports and files.

Handles upload to AWS S3 and presigned URL generation.
"""

import logging
from typing import Optional
from datetime import datetime, timedelta
import io

logger = logging.getLogger(__name__)


class S3StorageBackend:
    """Store exports on AWS S3 with presigned URLs."""

    def __init__(
        self,
        bucket_name: str,
        region: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
    ):
        """Initialize S3 backend.

        Args:
            bucket_name: S3 bucket name
            region: AWS region
            aws_access_key_id: Optional AWS access key
            aws_secret_access_key: Optional AWS secret key
        """

        try:
            import boto3
        except ImportError:
            logger.error("boto3 not installed. Install with: pip install boto3")
            raise ImportError("boto3 required for S3 storage")

        self.bucket_name = bucket_name
        self.region = region

        # Initialize S3 client
        if aws_access_key_id and aws_secret_access_key:
            self.s3_client = boto3.client(
                "s3",
                region_name=region,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
            )
        else:
            # Use IAM role or environment variables
            self.s3_client = boto3.client("s3", region_name=region)

        logger.info(f"S3 backend initialized: bucket={bucket_name}, region={region}")

    async def upload_file(
        self,
        file_content: bytes,
        file_key: str,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> str:
        """Upload file to S3.

        Args:
            file_content: File bytes to upload
            file_key: S3 object key (path)
            content_type: MIME type
            metadata: Optional metadata dict

        Returns:
            S3 object URL
        """

        try:
            # Upload with metadata
            extra_args = {
                "ContentType": content_type,
            }

            if metadata:
                extra_args["Metadata"] = metadata

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_key,
                Body=file_content,
                **extra_args,
            )

            url = f"s3://{self.bucket_name}/{file_key}"
            logger.info(f"File uploaded to S3: {url}")

            return url

        except Exception as e:
            logger.error(f"S3 upload failed for {file_key}: {e}")
            raise

    async def get_presigned_url(
        self,
        file_key: str,
        expiration_seconds: int = 3600,  # 1 hour default
    ) -> str:
        """Generate presigned URL for file download.

        Args:
            file_key: S3 object key
            expiration_seconds: URL validity (default 1 hour)

        Returns:
            Presigned URL string
        """

        try:
            presigned_url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": file_key,
                },
                ExpiresIn=expiration_seconds,
            )

            logger.info(
                f"Presigned URL generated: {file_key} "
                f"(expires in {expiration_seconds}s)"
            )

            return presigned_url

        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {file_key}: {e}")
            raise

    async def delete_file(self, file_key: str) -> bool:
        """Delete file from S3.

        Args:
            file_key: S3 object key

        Returns:
            True if deleted, False otherwise
        """

        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_key,
            )

            logger.info(f"File deleted from S3: {file_key}")
            return True

        except Exception as e:
            logger.error(f"S3 delete failed for {file_key}: {e}")
            return False

    async def file_exists(self, file_key: str) -> bool:
        """Check if file exists in S3.

        Args:
            file_key: S3 object key

        Returns:
            True if exists, False otherwise
        """

        try:
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=file_key,
            )
            return True

        except self.s3_client.exceptions.NoSuchKey:
            return False

        except Exception as e:
            logger.error(f"S3 head_object failed for {file_key}: {e}")
            return False

    async def list_files(
        self,
        prefix: str = "",
        max_keys: int = 100,
    ) -> list:
        """List files in S3 bucket.

        Args:
            prefix: Object key prefix to filter
            max_keys: Maximum number of objects

        Returns:
            List of file metadata dicts
        """

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix,
                MaxKeys=max_keys,
            )

            files = []
            for obj in response.get("Contents", []):
                files.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat(),
                })

            logger.info(f"Listed {len(files)} files with prefix: {prefix}")
            return files

        except Exception as e:
            logger.error(f"S3 list_objects failed: {e}")
            return []


class MinioStorageBackend(S3StorageBackend):
    """MinIO-compatible S3 storage (for development without AWS).

    MinIO implements S3-compatible API, so this uses boto3 with endpoint_url.
    """

    def __init__(
        self,
        endpoint_url: str,
        bucket_name: str,
        access_key: str,
        secret_key: str,
    ):
        """Initialize MinIO backend.

        Args:
            endpoint_url: MinIO server URL (e.g., "http://localhost:9000")
            bucket_name: Bucket name
            access_key: MinIO access key
            secret_key: MinIO secret key
        """

        try:
            import boto3
        except ImportError:
            logger.error("boto3 not installed")
            raise ImportError("boto3 required for MinIO storage")

        self.bucket_name = bucket_name
        self.region = "us-east-1"

        # Connect to MinIO with endpoint override
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="us-east-1",
        )

        logger.info(f"MinIO backend initialized: endpoint={endpoint_url}, bucket={bucket_name}")
