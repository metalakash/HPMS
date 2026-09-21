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
    
    # LDAP / Active Directory (stub)
    LDAP_SERVER: str = os.getenv("LDAP_SERVER", "ldap://localhost:389")
    LDAP_BIND_DN: str = os.getenv("LDAP_BIND_DN", "")
    LDAP_BIND_PASSWORD: str = os.getenv("LDAP_BIND_PASSWORD", "")
    
    # Application
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Audit
    AUDIT_RETENTION_YEARS: int = int(os.getenv("AUDIT_RETENTION_YEARS", "7"))
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
