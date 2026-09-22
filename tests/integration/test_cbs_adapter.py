"""Unit tests for CBS integrator adapter.

Tests mock adapter success/failure scenarios, circuit breaker resilience,
and rate history tracking.
"""

import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal

from backend.app.integration.finacle_adapter import (
    MockFinacleAdapter,
    StubFinacleAdapter,
    FinacleSyncRequest,
    FinacleSyncType,
    CircuitBreaker,
    CircuitBreakerState,
)
from backend.app.integration.finacle_schema import FinacleFieldMapping


class TestMockAdapter:
    """Test MockFinacleAdapter success and failure modes."""

    @pytest.mark.asyncio
    async def test_mock_adapter_success(self):
        """Mock adapter returns accounts on success."""
        adapter = MockFinacleAdapter(failure_mode="success")

        request = FinacleSyncRequest(
            sync_type=FinacleSyncType.REALTIME_INQUIRY,
            request_id="req123",
            account_ids=["ACC00001"],
        )

        response = await adapter.sync_accounts(request)

        assert response.is_success
        assert response.response_code == "000"
        assert len(response.account_records) == 1
        assert response.account_records[0].finacle_account_id == "ACC00001"

    @pytest.mark.asyncio
    async def test_mock_adapter_all_accounts(self):
        """Mock adapter returns default 3 accounts when no IDs specified."""
        adapter = MockFinacleAdapter(failure_mode="success")

        request = FinacleSyncRequest(
            sync_type=FinacleSyncType.EOD_BATCH,
            request_id="req456",
        )

        response = await adapter.sync_accounts(request)

        assert response.is_success
        assert len(response.account_records) == 3

    @pytest.mark.asyncio
    async def test_mock_adapter_connection_error(self):
        """Mock adapter raises ConnectionError on connection failure mode."""
        adapter = MockFinacleAdapter(failure_mode="connection_error")

        request = FinacleSyncRequest(
            sync_type=FinacleSyncType.REALTIME_INQUIRY,
            request_id="req789",
        )

        with pytest.raises(ConnectionError):
            await adapter.sync_accounts(request)

    @pytest.mark.asyncio
    async def test_mock_adapter_timeout(self):
        """Mock adapter raises TimeoutError on timeout mode."""
        adapter = MockFinacleAdapter(failure_mode="timeout")

        request = FinacleSyncRequest(
            sync_type=FinacleSyncType.BOD_BATCH,
            request_id="req_timeout",
        )

        with pytest.raises(TimeoutError):
            await adapter.sync_accounts(request)


class TestStubAdapter:
    """Test StubFinacleAdapter raises NotImplementedError."""

    @pytest.mark.asyncio
    async def test_stub_adapter_not_implemented(self):
        """Stub adapter raises NotImplementedError for safety."""
        adapter = StubFinacleAdapter()

        request = FinacleSyncRequest(
            sync_type=FinacleSyncType.REALTIME_INQUIRY,
            request_id="req_stub",
        )

        with pytest.raises(NotImplementedError):
            await adapter.sync_accounts(request)


class TestCircuitBreaker:
    """Test circuit breaker resilience pattern."""

    def test_circuit_breaker_closed_initial_state(self):
        """Circuit breaker starts in CLOSED state."""
        breaker = CircuitBreaker(failure_threshold=3)

        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.failure_count == 0

    def test_circuit_breaker_opens_after_threshold(self):
        """Circuit breaker opens after failure threshold exceeded."""
        breaker = CircuitBreaker(failure_threshold=2)

        # First failure
        breaker._on_failure()
        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.failure_count == 1

        # Second failure
        breaker._on_failure()
        assert breaker.state == CircuitBreakerState.OPEN
        assert breaker.failure_count == 2

    def test_circuit_breaker_rejects_calls_when_open(self):
        """Circuit breaker rejects calls when OPEN."""
        breaker = CircuitBreaker(failure_threshold=1)
        breaker._on_failure()  # Open the breaker

        def dummy_func():
            return "should not execute"

        with pytest.raises(Exception, match="Circuit breaker OPEN"):
            breaker.call(dummy_func)

    def test_circuit_breaker_half_open_recovery(self):
        """Circuit breaker enters HALF_OPEN and recovers on success."""
        breaker = CircuitBreaker(
            failure_threshold=1,
            recovery_timeout_seconds=0,  # Allow immediate recovery
        )

        # Open the breaker
        breaker._on_failure()
        assert breaker.state == CircuitBreakerState.OPEN

        # Advance time, enter HALF_OPEN
        def dummy_success():
            return "success"

        result = breaker.call(dummy_success)
        assert result == "success"
        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.failure_count == 0


class TestFinacleSchema:
    """Test field mapping between Finacle and HPMS."""

    def test_account_mapping_lookup(self):
        """Field mapping lookups work bidirectionally."""
        # Finacle → HPMS
        hpms_field = FinacleFieldMapping.get_hpms_field("ACCT_MASTER_ID")
        assert hpms_field == "finacle_account_id"

        # HPMS → Finacle
        finacle_field = FinacleFieldMapping.get_finacle_field("finacle_account_id")
        assert finacle_field == "ACCT_MASTER_ID"

    def test_unknown_field_mapping(self):
        """Unknown field mapping returns None."""
        assert FinacleFieldMapping.get_hpms_field("UNKNOWN_FIELD") is None
        assert FinacleFieldMapping.get_finacle_field("unknown_hpms_field") is None


class TestFinacleSyncRequest:
    """Test sync request serialization."""

    def test_sync_request_to_dict(self):
        """Sync request converts to dict for logging."""
        request = FinacleSyncRequest(
            sync_type=FinacleSyncType.EOD_BATCH,
            request_id="req_123",
            account_ids=["ACC001", "ACC002"],
            date_range=(date(2026, 9, 1), date(2026, 9, 30)),
        )

        data = request.to_dict()

        assert data["sync_type"] == "eod_batch"
        assert data["request_id"] == "req_123"
        assert data["account_count"] == 2
        assert "2026-09-01" in data["date_range"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
