from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    """Application configuration from environment variables."""
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://hpms:hpms_dev_pass@localhost:5432/sbl_hpms_dev"
    )
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    
    # JWT Token
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = int(os.getenv("JWT_EXPIRY_MINUTES", "480"))  # 8 hours

    # LDAP / Active Directory (Phase 3)
    USE_LDAP: bool = os.getenv("USE_LDAP", "false").lower() == "true"
    AD_SERVER: str = os.getenv("AD_SERVER", "ldap.sbl.local")
    AD_DOMAIN: str = os.getenv("AD_DOMAIN", "sbl.local")
    AD_BASE_DN: str = os.getenv("AD_BASE_DN", "dc=sbl,dc=local")
    AD_SERVICE_ACCOUNT_USERNAME: str = os.getenv("AD_SERVICE_ACCOUNT_USERNAME", "")
    AD_SERVICE_ACCOUNT_PASSWORD: str = os.getenv("AD_SERVICE_ACCOUNT_PASSWORD", "")
    
    # Application
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Audit
    AUDIT_RETENTION_YEARS: int = int(os.getenv("AUDIT_RETENTION_YEARS", "7"))

    # S3 / File Storage (Phase 3)
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "s3")  # s3, minio, local
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "hpms-exports-dev")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", "")
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", "")
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "")  # For MinIO

    # File Export Settings
    EXPORT_FILE_EXPIRY_HOURS: int = int(os.getenv("EXPORT_FILE_EXPIRY_HOURS", "24"))  # Delete after 24h
    PRESIGNED_URL_EXPIRY_SECONDS: int = int(os.getenv("PRESIGNED_URL_EXPIRY_SECONDS", "3600"))  # 1 hour
    MAX_EXPORT_RECORDS: int = int(os.getenv("MAX_EXPORT_RECORDS", "100000"))

    # Rate Limiting (Phase 3, Task 5)
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    RATE_LIMIT_DEFAULT_QUOTA: int = int(os.getenv("RATE_LIMIT_DEFAULT_QUOTA", "10"))  # Requests per minute
    RATE_LIMIT_PREMIUM_QUOTA: int = int(os.getenv("RATE_LIMIT_PREMIUM_QUOTA", "50"))
    RATE_LIMIT_ADMIN_QUOTA: Optional[int] = None if os.getenv("RATE_LIMIT_ADMIN_QUOTA", "unlimited") == "unlimited" else int(os.getenv("RATE_LIMIT_ADMIN_QUOTA", "1000"))
    RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

    # Caching (Phase 3, Task 5)
    CACHE_ENABLED: bool = os.getenv("CACHE_ENABLED", "true").lower() == "true"
    CACHE_MAX_SIZE: int = int(os.getenv("CACHE_MAX_SIZE", "1000"))
    CACHE_DEFAULT_TTL_SECONDS: int = int(os.getenv("CACHE_DEFAULT_TTL_SECONDS", "300"))  # 5 minutes
    CACHE_PROJECT_LIST_TTL: int = int(os.getenv("CACHE_PROJECT_LIST_TTL", "300"))
    CACHE_PROJECT_DETAIL_TTL: int = int(os.getenv("CACHE_PROJECT_DETAIL_TTL", "600"))
    CACHE_REPORT_TTL: int = int(os.getenv("CACHE_REPORT_TTL", "900"))  # 15 minutes
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
