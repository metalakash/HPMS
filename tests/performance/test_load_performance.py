"""Performance and load testing for HPMS API.

Measures query performance and API response times under load.
"""

import pytest
import time
import asyncio
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.project import Project
from backend.app.models.financial import LoanAccount
from backend.app.cache.cache_manager import CacheManager, get_cache_manager
from backend.app.middleware.rate_limiter import RateLimitManager, TokenBucket


class TestQueryPerformance:
    """Test individual query performance."""

    @pytest.mark.asyncio
    async def test_project_list_query_performance(self, db_session: AsyncSession):
        """Test list projects query time < 200ms."""

        # Create test projects
        for i in range(50):
            project = Project(
                project_code=f"PERF-{i:03d}",
                name_en=f"Performance Test {i}",
                name_np=f"प्रदर्शन परीक्षण {i}",
                province="Gandaki",
                installed_capacity_mw=Decimal(50 + i),
                project_stage="operation",
                pipeline_status="under_operation",
                created_by="test",
            )
            db_session.add(project)

        await db_session.flush()

        # Measure query time
        start = time.time()

        from sqlalchemy import select
        query = select(Project).limit(50)
        result = await db_session.execute(query)
        projects = result.scalars().all()

        elapsed = time.time() - start

        assert len(projects) > 0
        assert elapsed < 0.2  # < 200ms

    @pytest.mark.asyncio
    async def test_project_detail_with_relations(self, db_session: AsyncSession):
        """Test project detail query with eager loading < 100ms."""

        # Create project with relations
        project = Project(
            project_code="DETAIL-001",
            name_en="Detail Test",
            name_np="विवरण परीक्षण",
            province="Gandaki",
            installed_capacity_mw=Decimal("50.00"),
            project_stage="operation",
            pipeline_status="under_operation",
            created_by="test",
        )
        db_session.add(project)
        await db_session.flush()

        # Create loan accounts
        for i in range(5):
            account = LoanAccount(
                project_id=project.id,
                finacle_account_id=f"ACC{i:05d}",
                facility_type="Term Loan",
                sanctioned_amount=Decimal("1000000.00"),
                created_by="test",
            )
            db_session.add(account)

        await db_session.flush()

        # Measure query time with eager loading
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload

        start = time.time()

        query = (
            select(Project)
            .where(Project.project_code == "DETAIL-001")
            .options(joinedload(Project.loan_accounts))
        )
        result = await db_session.execute(query)
        project = result.scalar_one()

        elapsed = time.time() - start

        assert project.loan_accounts is not None
        assert elapsed < 0.1  # < 100ms


class TestCachePerformance:
    """Test cache performance."""

    def test_cache_hit_performance(self):
        """Test cache hit is fast (< 1ms)."""

        cache = CacheManager()
        cache.set("test_key", {"data": "value"})

        # Measure cache hit time
        start = time.time()

        for _ in range(1000):
            cache.get("test_key")

        elapsed = (time.time() - start) / 1000  # Per access

        assert elapsed < 0.001  # < 1ms per hit

    def test_cache_lru_eviction(self):
        """Test LRU eviction when cache full."""

        cache = CacheManager(max_size=10)

        # Fill cache
        for i in range(10):
            cache.set(f"key_{i}", f"value_{i}")

        assert len(cache.cache) == 10

        # Add one more (should evict LRU)
        cache.set("key_10", "value_10")

        assert len(cache.cache) == 10
        assert cache.get("key_0") is None  # LRU evicted

    def test_cache_ttl_expiration(self):
        """Test cache entries expire after TTL."""

        cache = CacheManager(default_ttl_seconds=1)
        cache.set("expiring", "value")

        assert cache.get("expiring") is not None

        # Wait for expiry
        time.sleep(1.1)

        assert cache.get("expiring") is None

    def test_cache_stats(self):
        """Test cache statistics tracking."""

        cache = CacheManager()
        cache.set("key", "value")

        # Generate hits and misses
        cache.get("key")  # hit
        cache.get("key")  # hit
        cache.get("missing")  # miss

        stats = cache.get_stats()

        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["total"] == 3
        assert stats["hit_rate_percent"] == pytest.approx(66.67, rel=0.01)


class TestRateLimitPerformance:
    """Test rate limiting performance."""

    def test_rate_limit_check_performance(self):
        """Test rate limit check is fast (< 1ms)."""

        limiter = RateLimitManager(default_quota=10, default_window_seconds=60)

        start = time.time()

        for _ in range(1000):
            limiter.is_allowed("user_123", ["maker"])

        elapsed = (time.time() - start) / 1000  # Per check

        assert elapsed < 0.001  # < 1ms

    def test_token_bucket_refill(self):
        """Test token bucket refills correctly."""

        bucket = TokenBucket(capacity=10, refill_rate=10, refill_interval_seconds=1)

        # Consume all tokens
        for _ in range(10):
            assert bucket.consume(1) is True

        # Should be rate limited
        assert bucket.consume(1) is False

        # Wait for refill
        time.sleep(1.1)

        # Should have tokens again
        assert bucket.consume(1) is True

    def test_admin_unlimited_quota(self):
        """Test admin users have unlimited quota."""

        limiter = RateLimitManager(admin_quota=None)

        # Admin should always be allowed
        for _ in range(100):
            allowed, _, _ = limiter.is_allowed("admin_user", ["admin"])
            assert allowed is True


class TestLoadScenarios:
    """Simulate load scenarios."""

    @pytest.mark.asyncio
    async def test_burst_traffic_handling(self, db_session: AsyncSession):
        """Test handling burst traffic with rate limiting."""

        limiter = RateLimitManager(default_quota=10, default_window_seconds=60)

        # Simulate 50 requests from same user
        blocked = 0
        allowed = 0

        for i in range(50):
            is_allowed, _, _ = limiter.is_allowed("burst_user", ["maker"])

            if is_allowed:
                allowed += 1
            else:
                blocked += 1

        # First 10 should be allowed, rest blocked
        assert allowed == 10
        assert blocked == 40

    def test_concurrent_users(self):
        """Test rate limiting with multiple concurrent users."""

        limiter = RateLimitManager(default_quota=5, default_window_seconds=60)
        users = ["user_1", "user_2", "user_3"]

        results = []

        for user in users:
            allowed_count = 0

            for _ in range(10):
                allowed, _, _ = limiter.is_allowed(user, ["maker"])
                if allowed:
                    allowed_count += 1

            results.append(allowed_count)

        # Each user should be independently rate limited
        assert all(count == 5 for count in results)

    def test_premium_user_higher_quota(self):
        """Test premium users have higher quota than standard."""

        limiter = RateLimitManager(default_quota=10, premium_quota=50)

        # Standard user
        standard_allowed = 0
        for _ in range(15):
            allowed, _, _ = limiter.is_allowed("standard_user", ["maker"])
            if allowed:
                standard_allowed += 1

        # Premium user
        premium_allowed = 0
        for _ in range(60):
            allowed, _, _ = limiter.is_allowed("premium_user", ["premium"])
            if allowed:
                premium_allowed += 1

        assert standard_allowed == 10
        assert premium_allowed == 50


class TestCacheKeyGeneration:
    """Test cache key generation."""

    def test_cache_key_consistency(self):
        """Test cache key generation is consistent."""

        cache = CacheManager()

        key1 = cache.cache_key("projects", province="Gandaki", status="active")
        key2 = cache.cache_key("projects", status="active", province="Gandaki")

        # Keys should be identical regardless of kwarg order
        assert key1 == key2

    def test_cache_key_with_no_params(self):
        """Test cache key with no parameters."""

        cache = CacheManager()
        key = cache.cache_key("simple_key")

        assert key == "simple_key"

    def test_cache_key_with_special_chars(self):
        """Test cache key with special characters."""

        cache = CacheManager()
        key = cache.cache_key(
            "projects",
            province="काली गण्डकी",
            status="under_operation",
        )

        # Should handle special characters
        assert "projects:" in key
        assert "province=" in key
