"""Common schemas shared across API endpoints.

Defines request/response envelopes, pagination, and shared data types.
"""

from typing import Optional, Any, Generic, TypeVar
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field
import uuid

T = TypeVar('T')


class AuditMetadata(BaseModel):
    """Audit information on every API response."""

    user_id: str = Field(description="User who triggered action")
    action: str = Field(description="Action performed (create, read, update, approve)")
    timestamp: str = Field(description="Server timestamp (ISO format)")
    request_id: Optional[str] = Field(None, description="Request tracking ID")

    class Config:
        strict = True


class ResponseMeta(BaseModel):
    """Metadata about API response."""

    timestamp: str = Field(description="Server timestamp (ISO format)")
    version: str = Field(default="0.1.0", description="API version")
    page: Optional[int] = Field(None, description="Page number (for paginated results)")
    page_size: Optional[int] = Field(None, description="Items per page")
    total_count: Optional[int] = Field(None, description="Total items (for paginated results)")

    class Config:
        strict = True


class ApiResponse(BaseModel, Generic[T]):
    """Standard API response envelope.

    All endpoints return this structure for consistency.
    """

    data: T = Field(description="Response data")
    meta: ResponseMeta = Field(description="Response metadata")
    audit: AuditMetadata = Field(description="Audit trail")

    class Config:
        strict = True
        arbitrary_types_allowed = True


class DualCalendarDate(BaseModel):
    """Date in both Gregorian AD and Bikram Sambat BS calendars."""

    ad: Optional[date] = Field(None, description="Gregorian (AD) date")
    bs: Optional[str] = Field(None, description="Bikram Sambat (BS) date (YYYY-MM-DD format)")

    class Config:
        strict = True


class PaginationParams(BaseModel):
    """Pagination query parameters."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")

    class Config:
        strict = True


class ErrorResponse(BaseModel):
    """Error response when endpoint fails."""

    error: str = Field(description="Error type")
    detail: str = Field(description="Detailed error message")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")

    class Config:
        strict = True


class FilterParams(BaseModel):
    """Common filter parameters for list endpoints."""

    status: Optional[str] = Field(None, description="Filter by status")
    province: Optional[str] = Field(None, description="Filter by province (location)")
    date_from: Optional[date] = Field(None, description="Filter from date")
    date_to: Optional[date] = Field(None, description="Filter to date")
    search: Optional[str] = Field(None, description="Free-text search")

    class Config:
        strict = True


class NumericFieldResponse(BaseModel):
    """Numeric field response (Decimal with string representation for precision)."""

    value: Decimal = Field(description="Numeric value (precise decimal)")
    currency: Optional[str] = Field(None, description="Currency code (e.g., NPR)")
    formatted: str = Field(description="Formatted string representation")

    class Config:
        strict = True
        json_encoders = {
            Decimal: lambda v: str(v),
        }
