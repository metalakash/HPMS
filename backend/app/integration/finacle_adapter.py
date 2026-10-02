"""Finacle CBS read-only adapter with circuit breaker and DLQ support.

This module provides a pluggable interface to synchronize loan account data from
Finacle CBS. It supports multiple sync modes (realtime, EOD, BOD) and includes
resilience patterns: circuit breaker for cascading failures, DLQ for retryable
errors, and comprehensive audit logging.

HPMS does NOT write back to CBS — this is a one-way read-only integration.
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime, date, timedelta
import uuid
from enum import Enum
from decimal import Decimal

from .finacle_schema import (
    FinacleSyncType,
    FinacleAccountRecord,
    FinacleSyncRequest,
    FinacleSyncResponse,
)

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token-bucket rate limiter for API calls.

    Tracks call frequency to prevent overwhelming Finacle CBS.
    Default: 1000 calls per 24 hours.
    """

    def __init__(self, max_calls: int = 1000, time_window_seconds: int = 86400):
        """Initialize rate limiter.

        Args:
            max_calls: Maximum calls allowed per time window
            time_window_seconds: Time window in seconds (default: 24 hours)
        """
        self.max_calls = max_calls
        self.time_window_seconds = time_window_seconds
        self.call_times: List[datetime] = []

    def is_allowed(self) -> bool:
        """Check if call is allowed within rate limit."""
        now = datetime.utcnow()

        # Remove calls older than time window
        self.call_times = [t for t in self.call_times
                          if (now - t).total_seconds() < self.time_window_seconds]

        # Check limit
        if len(self.call_times) < self.max_calls:
            self.call_times.append(now)
            return True

        logger.warning(f"Rate limit exceeded: {len(self.call_times)}/{self.max_calls} calls in window")
        return False

    def get_remaining_calls(self) -> int:
        """Get remaining calls in current window."""
        now = datetime.utcnow()
        self.call_times = [t for t in self.call_times
                          if (now - t).total_seconds() < self.time_window_seconds]
        return max(0, self.max_calls - len(self.call_times))

    def get_status(self) -> Dict[str, Any]:
        """Get rate limiter status."""
        now = datetime.utcnow()
        self.call_times = [t for t in self.call_times
                          if (now - t).total_seconds() < self.time_window_seconds]
        return {
            "max_calls_per_day": self.max_calls,
            "calls_used_today": len(self.call_times),
            "remaining_calls": self.get_remaining_calls(),
        }


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

    def _before_call(self):
        """Fail fast while OPEN; move to HALF_OPEN once the recovery timeout has passed."""
        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                logger.info("Circuit breaker entering HALF_OPEN state; testing recovery")
            else:
                raise Exception(f"Circuit breaker OPEN (failed {self.failure_count} times)")

    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        self._before_call()
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception:
            self._on_failure()
            raise

    async def call_async(self, func, *args, **kwargs):
        """Like ``call`` but awaits ``func`` so its failures count against the breaker."""
        self._before_call()
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception:
            self._on_failure()
            raise

    def _on_success(self):
        """Record successful call."""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.CLOSED
            logger.info("Circuit breaker CLOSED; service recovered")
        self.failure_count = 0  # only consecutive failures open the breaker

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

    def __init__(
        self,
        circuit_breaker: Optional[CircuitBreaker] = None,
        rate_limiter: Optional[RateLimiter] = None,
    ):
        self.circuit_breaker = circuit_breaker or CircuitBreaker()
        self.rate_limiter = rate_limiter or RateLimiter()

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
        """Execute sync with circuit breaker and rate limiter protection."""
        # Check rate limit
        if not self.rate_limiter.is_allowed():
            remaining = self.rate_limiter.get_remaining_calls()
            raise Exception(
                f"Finacle rate limit exceeded. Remaining calls today: {remaining}"
            )

        # Execute with circuit breaker
        return await self.circuit_breaker.call_async(self.sync_accounts, request)

    @staticmethod
    def compute_diff_log(
        local_account: Dict[str, Any],
        finacle_account: FinacleAccountRecord,
    ) -> List[Dict[str, Any]]:
        """Compute field-level diff between local and Finacle data.

        Args:
            local_account: Current local account data
            finacle_account: Fetched Finacle account data

        Returns:
            List of diffs showing changed/unchanged fields
        """
        fields_to_compare = [
            "disbursed_amount",
            "outstanding_principal",
            "outstanding_interest",
            "overdue_principal",
            "overdue_interest",
            "interest_rate_pct",
            "account_status",
            "maturity_date",
        ]

        diff_log = []
        for field in fields_to_compare:
            local_value = local_account.get(field)
            finacle_value = getattr(finacle_account, field, None)

            # Convert Decimal to float for comparison
            if isinstance(finacle_value, Decimal):
                finacle_value = float(finacle_value)
            if isinstance(local_value, Decimal):
                local_value = float(local_value)

            status = "same" if local_value == finacle_value else "changed"

            diff_log.append({
                "field": field,
                "previous_value": local_value,
                "new_value": finacle_value,
                "status": status,
            })

        return diff_log

    def get_circuit_breaker_status(self) -> Dict[str, Any]:
        """Get circuit breaker status."""
        return {
            "state": self.circuit_breaker.state,
            "failure_count": self.circuit_breaker.failure_count,
            "last_failure_time": (
                self.circuit_breaker.last_failure_time.isoformat()
                if self.circuit_breaker.last_failure_time
                else None
            ),
        }

    def get_rate_limiter_status(self) -> Dict[str, Any]:
        """Get rate limiter status."""
        return self.rate_limiter.get_status()


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
