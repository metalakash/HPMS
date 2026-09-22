"""Finacle CBS read-only adapter with circuit breaker and DLQ support.

This module provides a pluggable interface to synchronize loan account data from
Finacle CBS. It supports multiple sync modes (realtime, EOD, BOD) and includes
resilience patterns: circuit breaker for cascading failures, DLQ for retryable
errors, and comprehensive audit logging.

HPMS does NOT write back to CBS — this is a one-way read-only integration.
"""

from abc import ABC, abstractmethod
from typing import Optional, List
import logging
from datetime import datetime, date, timedelta
import uuid
from enum import Enum

from .finacle_schema import (
    FinacleSyncType,
    FinacleAccountRecord,
    FinacleSyncRequest,
    FinacleSyncResponse,
)

logger = logging.getLogger(__name__)


class CircuitBreakerState(str, Enum):
    """Circuit breaker states for Finacle adapter."""
    CLOSED = "CLOSED"  # Normal operation
    OPEN = "OPEN"  # Failing, reject requests
    HALF_OPEN = "HALF_OPEN"  # Testing if service recovered


class CircuitBreaker:
    """Resilience pattern: stop cascading failures to CBS.

    - CLOSED: requests pass through normally
    - OPEN: requests fail fast (don't hit CBS)
    - HALF_OPEN: allow limited requests to test recovery
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout_seconds: int = 300,
        expected_exception: type = Exception,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self.expected_exception = expected_exception

        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = CircuitBreakerState.CLOSED

    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info("Circuit breaker entering HALF_OPEN state; testing recovery")
            else:
                raise Exception(f"Circuit breaker OPEN (failed {self.failure_count} times)")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        """Record successful call."""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.CLOSED
            self.failure_count = 0
            logger.info("Circuit breaker CLOSED; service recovered")

    def _on_failure(self):
        """Record failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            logger.warning(f"Circuit breaker OPEN after {self.failure_count} failures")

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to try recovery."""
        if not self.last_failure_time:
            return True
        elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
        return elapsed >= self.recovery_timeout_seconds


class FinacleAdapterBase(ABC):
    """Abstract interface for Finacle CBS adapter implementations."""

    def __init__(self, circuit_breaker: Optional[CircuitBreaker] = None):
        self.circuit_breaker = circuit_breaker or CircuitBreaker()

    @abstractmethod
    async def sync_accounts(
        self,
        request: FinacleSyncRequest,
    ) -> FinacleSyncResponse:
        """Fetch loan account data from Finacle CBS.

        Args:
            request: sync request with type, account IDs, date range

        Returns:
            sync response with account records and status

        Raises:
            Exception if circuit breaker is OPEN or CBS is unreachable
        """
        pass

    async def sync_with_circuit_breaker(
        self,
        request: FinacleSyncRequest,
    ) -> FinacleSyncResponse:
        """Execute sync with circuit breaker protection."""
        return self.circuit_breaker.call(self.sync_accounts, request)


class MockFinacleAdapter(FinacleAdapterBase):
    """Mock Finacle adapter for testing and development.

    Returns synthetic account records without hitting real CBS.
    Supports simulating various scenarios: success, failures, timeouts.
    """

    def __init__(self, failure_mode: str = "success"):
        super().__init__()
        self.failure_mode = failure_mode

    async def sync_accounts(
        self,
        request: FinacleSyncRequest,
    ) -> FinacleSyncResponse:
        """Return mock account records based on failure mode."""
        request_id = request.request_id or str(uuid.uuid4())

        # Simulate different failure scenarios
        if self.failure_mode == "connection_error":
            logger.error(f"Mock: simulating connection error for {request_id}")
            raise ConnectionError("Mock: Finacle CBS unreachable")

        if self.failure_mode == "timeout":
            logger.error(f"Mock: simulating timeout for {request_id}")
            raise TimeoutError("Mock: Finacle CBS request timed out")

        if self.failure_mode == "malformed_response":
            logger.error(f"Mock: simulating malformed response for {request_id}")
            raise ValueError("Mock: CBS returned malformed response")

        # Success case: return mock accounts
        mock_accounts = []

        # If specific account IDs requested, return those
        if request.account_ids:
            for acc_id in request.account_ids:
                mock_accounts.append(self._create_mock_account(acc_id))
        else:
            # Return 3 sample accounts
            mock_accounts = [
                self._create_mock_account("ACC00001"),
                self._create_mock_account("ACC00002"),
                self._create_mock_account("ACC00003"),
            ]

        logger.info(f"Mock: returning {len(mock_accounts)} accounts for {request_id}")

        return FinacleSyncResponse(
            request_id=request_id,
            response_code="000",
            response_message="Success",
            account_records=mock_accounts,
            sync_timestamp=datetime.utcnow().isoformat(),
            total_records=len(mock_accounts),
            records_processed=len(mock_accounts),
            records_failed=0,
        )

    @staticmethod
    def _create_mock_account(account_id: str) -> FinacleAccountRecord:
        """Create a synthetic account record."""
        from decimal import Decimal

        return FinacleAccountRecord(
            finacle_account_id=account_id,
            customer_id=f"CUST{account_id[3:]}",
            account_status="ACTIVE",
            account_type="Term Loan",
            facility_type="Loan",
            sanctioned_amount=Decimal("5000000.00"),
            currency_code="NPR",
            disbursed_amount=Decimal("3500000.00"),
            outstanding_principal=Decimal("2800000.00"),
            outstanding_interest=Decimal("25000.00"),
            overdue_principal=Decimal("0.00"),
            overdue_interest=Decimal("0.00"),
            interest_rate_pct=Decimal("8.75"),
            rate_reset_date=date.today(),
            sanction_date=date.today() - timedelta(days=365),
            disbursement_date=date.today() - timedelta(days=300),
            moratorium_end_date=date.today() + timedelta(days=100),
            maturity_date=date.today() + timedelta(days=2555),
            linked_project_code=None,
            collateral_value=Decimal("6000000.00"),
            security_type="Hypothecation",
            last_updated_at_cbs=datetime.utcnow().isoformat(),
            record_version=1,
        )


class StubFinacleAdapter(FinacleAdapterBase):
    """Stub adapter for production — raises NotImplementedError.

    Prevents accidental CBS calls without real credentials configured.
    In production, inject a real adapter implementation.
    """

    async def sync_accounts(
        self,
        request: FinacleSyncRequest,
    ) -> FinacleSyncResponse:
        """Raise NotImplementedError — real adapter not configured."""
        raise NotImplementedError(
            "Finacle adapter not configured. "
            "Provide a real adapter implementation with CBS credentials."
        )


def get_adapter(adapter_type: str = "mock") -> FinacleAdapterBase:
    """Factory to get appropriate adapter implementation.

    Args:
        adapter_type: "mock" for testing, "stub" for production placeholder

    Returns:
        Adapter instance (mock or stub)
    """
    if adapter_type == "mock":
        return MockFinacleAdapter(failure_mode="success")
    elif adapter_type == "stub":
        return StubFinacleAdapter()
    else:
        raise ValueError(f"Unknown adapter type: {adapter_type}")
