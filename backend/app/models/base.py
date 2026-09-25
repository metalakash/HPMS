from sqlalchemy.orm import DeclarativeBase, declared_attr
from sqlalchemy import Column, DateTime, String, func
from datetime import datetime
import uuid
from typing import Any

class Base(DeclarativeBase):
    """Base class for all models."""
    
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"

class TimestampedMixin:
    """Mixin for created_at/updated_at timestamps."""
    
    @declared_attr
    def created_at(cls):
        return Column(DateTime(timezone=True), server_default=func.now())
    
    @declared_attr
    def updated_at(cls):
        return Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    @declared_attr
    def created_by(cls):
        return Column(String(255))
    
    @declared_attr
    def updated_by(cls):
        return Column(String(255))
