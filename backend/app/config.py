from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
from typing import Optional
import os

class Settings(BaseSettings):
    """Application configuration from environment variables."""

    model_config = ConfigDict(extra="ignore")  # Ignore extra env vars

    @field_validator("ALLOW_DEV_AUTH", mode="before")
    @classmethod
    def _blank_is_unset(cls, v):
        """An empty ALLOW_DEV_AUTH means "not set" (rather than failing startup); anything but true/1/yes is false."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "on")
        return bool(v)

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
    # Built-in demo accounts (public passwords). Unset = allowed only while DEBUG=true; see security/auth_selection.py
    ALLOW_DEV_AUTH: Optional[bool] = None
    AD_SERVER: str = os.getenv("AD_SERVER", "ldap.sbl.local")
    AD_DOMAIN: str = os.getenv("AD_DOMAIN", "sbl.local")
    AD_BASE_DN: str = os.getenv("AD_BASE_DN", "dc=sbl,dc=local")
    AD_SERVICE_ACCOUNT_USERNAME: str = os.getenv("AD_SERVICE_ACCOUNT_USERNAME", "")
    AD_SERVICE_ACCOUNT_PASSWORD: str = os.getenv("AD_SERVICE_ACCOUNT_PASSWORD", "")
    
    # Encrypts TOTP seeds at rest (security/secret_box.py). Falls back to SECRET_KEY when unset.
    # Roles that should have MFA; users in them without it get `mfa_enrollment_required` at login (comma separated)
    MFA_REQUIRED_ROLES: str = os.getenv("MFA_REQUIRED_ROLES", "")
    MFA_ENCRYPTION_KEY: str = os.getenv("MFA_ENCRYPTION_KEY", "")
    MFA_ENCRYPTION_KEY_OLD: str = os.getenv("MFA_ENCRYPTION_KEY_OLD", "")  # previous key(s), comma separated

    # Application
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Network access control (RFP A.7). Empty allow-list = disabled.
    ADMIN_IP_ALLOWLIST: str = os.getenv("ADMIN_IP_ALLOWLIST", "")  # comma-separated IPs / CIDRs
    ADMIN_PROTECTED_PREFIXES: str = os.getenv(
        "ADMIN_PROTECTED_PREFIXES",
        "/api/v1/admin,/api/v1/cbs,/api/v1/reports/schedules,/api/v1/regulatory/requirements,/api/v1/stakeholders")
    TRUSTED_PROXY_HOPS: int = int(os.getenv("TRUSTED_PROXY_HOPS", "0"))  # proxies in front of the app (X-Forwarded-For)

    # Core banking integration (integration/cbs_adapters.py, docs/CBS-INTEGRATION.md)
    # mock = built-in sample record, never saved; stub = refuse; file = end-of-day extract; http = API inquiry
    CBS_ADAPTER: str = os.getenv("CBS_ADAPTER", "mock")
    CBS_MAPPING_FILE: str = os.getenv("CBS_MAPPING_FILE", "")  # JSON: where each field is in the bank's data
    CBS_EXTRACT_DIR: str = os.getenv("CBS_EXTRACT_DIR", "")  # file adapter: where the bank drops its extract
    CBS_EXTRACT_MAX_AGE_HOURS: int = int(os.getenv("CBS_EXTRACT_MAX_AGE_HOURS", "0"))  # 0 = any age accepted
    CBS_HTTP_BASE_URL: str = os.getenv("CBS_HTTP_BASE_URL", "")
    CBS_HTTP_AUTH_HEADER: str = os.getenv("CBS_HTTP_AUTH_HEADER", "")  # e.g. Authorization or X-API-Key
    CBS_HTTP_AUTH_VALUE: str = os.getenv("CBS_HTTP_AUTH_VALUE", "")  # secret; set in the environment only
    CBS_HTTP_TIMEOUT_SECONDS: float = float(os.getenv("CBS_HTTP_TIMEOUT_SECONDS", "15"))
    CBS_HTTP_VERIFY_TLS: bool = os.getenv("CBS_HTTP_VERIFY_TLS", "true").lower() == "true"
    CBS_HTTP_CLIENT_CERT: str = os.getenv("CBS_HTTP_CLIENT_CERT", "")  # mutual TLS, if the bank requires it
    CBS_HTTP_CLIENT_KEY: str = os.getenv("CBS_HTTP_CLIENT_KEY", "")
    CBS_MAX_CALLS_PER_DAY: int = int(os.getenv("CBS_MAX_CALLS_PER_DAY", "1000"))

    # Audit
    # Not a confirmed NRB figure: set from the bank's records-retention policy. Purging is manual and off by default.
    AUDIT_RETENTION_YEARS: int = int(os.getenv("AUDIT_RETENTION_YEARS", "7"))
    AUDIT_PURGE_ENABLED: bool = os.getenv("AUDIT_PURGE_ENABLED", "false").lower() == "true"

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

    # PDF Generation (Phase 4, Task 2)
    PDF_ENABLED: bool = os.getenv("PDF_ENABLED", "true").lower() == "true"
    PDF_FONT: str = os.getenv("PDF_FONT", "Helvetica")
    PDF_PAGESIZE: str = os.getenv("PDF_PAGESIZE", "letter")  # letter or a4
    PDF_MARGIN_TOP: int = int(os.getenv("PDF_MARGIN_TOP", "72"))  # 1 inch
    PDF_MARGIN_BOTTOM: int = int(os.getenv("PDF_MARGIN_BOTTOM", "72"))  # 1 inch
    PDF_MARGIN_LEFT: int = int(os.getenv("PDF_MARGIN_LEFT", "54"))  # 0.75 inch
    PDF_MARGIN_RIGHT: int = int(os.getenv("PDF_MARGIN_RIGHT", "54"))  # 0.75 inch
    PDF_COLOR_PRIMARY: str = os.getenv("PDF_COLOR_PRIMARY", "#1F4788")  # SBL Blue
    PDF_COLOR_SECONDARY: str = os.getenv("PDF_COLOR_SECONDARY", "#2E7D32")  # SBL Green
    PDF_COLOR_ACCENT: str = os.getenv("PDF_COLOR_ACCENT", "#F57C00")  # SBL Orange
    PDF_WATERMARK_ENABLED: bool = os.getenv("PDF_WATERMARK_ENABLED", "false").lower() == "true"
    PDF_WATERMARK_TEXT: str = os.getenv("PDF_WATERMARK_TEXT", "CONFIDENTIAL")
    PDF_WATERMARK_OPACITY: float = float(os.getenv("PDF_WATERMARK_OPACITY", "0.3"))
    PDF_WATERMARK_ANGLE: int = int(os.getenv("PDF_WATERMARK_ANGLE", "45"))
    PDF_ENCRYPTION_ENABLED: bool = os.getenv("PDF_ENCRYPTION_ENABLED", "false").lower() == "true"
    PDF_ENCRYPTION_ALGORITHM: str = os.getenv("PDF_ENCRYPTION_ALGORITHM", "AES128")
    PDF_ENCRYPTION_DEFAULT_PASSWORD: Optional[str] = os.getenv("PDF_ENCRYPTION_DEFAULT_PASSWORD", None)
    PDF_MAX_FILE_SIZE_MB: int = int(os.getenv("PDF_MAX_FILE_SIZE_MB", "50"))

    # WebSocket (Phase 4, Task 4)
    WEBSOCKET_ENABLED: bool = os.getenv("WEBSOCKET_ENABLED", "true").lower() == "true"
    WEBSOCKET_HEARTBEAT_INTERVAL: int = int(os.getenv("WEBSOCKET_HEARTBEAT_INTERVAL", "30"))  # seconds
    WEBSOCKET_HEARTBEAT_TIMEOUT: int = int(os.getenv("WEBSOCKET_HEARTBEAT_TIMEOUT", "60"))  # seconds
    WEBSOCKET_MAX_CONNECTIONS_PER_USER: int = int(os.getenv("WEBSOCKET_MAX_CONNECTIONS_PER_USER", "5"))
    WEBSOCKET_MESSAGE_QUEUE_SIZE: int = int(os.getenv("WEBSOCKET_MESSAGE_QUEUE_SIZE", "1000"))
    WEBSOCKET_RECONNECT_TIMEOUT: int = int(os.getenv("WEBSOCKET_RECONNECT_TIMEOUT", "300"))  # 5 minutes
    REDIS_ENABLED: bool = os.getenv("REDIS_ENABLED", "false").lower() == "true"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")


settings = Settings()
