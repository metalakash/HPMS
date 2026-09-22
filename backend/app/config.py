from pydantic_settings import BaseSettings
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
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
