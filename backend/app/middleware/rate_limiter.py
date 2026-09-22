"""Rate limiting middleware using token bucket algorithm.

Enforces per-user request quotas to prevent API abuse.
"""

import logging
import time
from typing import Dict, Tuple, Optional
from collections import defaultdict
from threading import Lock

logger = logging.getLogger(__name__)


class TokenBucket:
    """Token bucket for rate limiting.

    Allows burst traffic up to capacity, then throttles to rate.
    """

    def __init__(
        self,
        capacity: int,
        refill_rate: float,
        refill_interval_seconds: int = 60,
    ):
        """Initialize bucket.

        Args:
            capacity: Maximum tokens in bucket
            refill_rate: Tokens to add per interval
            refill_interval_seconds: Seconds between refills (default 60 = 1 minute)
        """

        self.capacity = capacity
        self.refill_rate = refill_rate
        self.refill_interval_seconds = refill_interval_seconds
        self.tokens = float(capacity)
        self.last_refill_time = time.time()
        self.lock = Lock()

    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens from bucket.

        Args:
            tokens: Number of tokens to consume

        Returns:
            True if tokens available, False if rate limited
        """

        with self.lock:
            self._refill()

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True

            return False

    def _refill(self):
        """Add tokens based on time elapsed since last refill."""

        now = time.time()
        elapsed = now - self.last_refill_time

        # Calculate refills (how many intervals have passed)
        refills = elapsed / self.refill_interval_seconds
        tokens_to_add = refills * self.refill_rate

        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill_time = now

    def get_remaining_tokens(self) -> int:
        """Get current token count."""

        with self.lock:
            self._refill()
            return int(self.tokens)


class RateLimitManager:
    """Manage rate limits for users."""

    def __init__(
        self,
        default_quota: int = 10,
        default_window_seconds: int = 60,
        premium_quota: int = 50,
        admin_quota: Optional[int] = None,  # Unlimited if None
    ):
        """Initialize rate limit manager.

        Args:
            default_quota: Requests per window for standard users
            default_window_seconds: Time window (default 60 seconds)
            premium_quota: Requests per window for premium users
            admin_quota: Requests per window for admins (None = unlimited)
        """

        self.default_quota = default_quota
        self.default_window_seconds = default_window_seconds
        self.premium_quota = premium_quota
        self.admin_quota = admin_quota

        self.buckets: Dict[str, TokenBucket] = defaultdict(lambda: None)
        self.lock = Lock()

    def get_quota_for_user(
        self,
        user_id: str,
        user_roles: list,
    ) -> int:
        """Get request quota for user based on role.

        Args:
            user_id: User identifier
            user_roles: List of user roles (e.g., ["admin", "maker"])

        Returns:
            Requests allowed per window
        """

        # Admin role gets unlimited quota
        if "admin" in user_roles:
            if self.admin_quota is None:
                return float("inf")
            return self.admin_quota

        # Premium user gets higher quota
        if "premium" in user_roles:
            return self.premium_quota

        # Standard quota for everyone else
        return self.default_quota

    def is_allowed(
        self,
        user_id: str,
        user_roles: list,
    ) -> Tuple[bool, int, int]:
        """Check if user is allowed to make request.

        Args:
            user_id: User identifier
            user_roles: List of user roles

        Returns:
            (is_allowed, remaining_quota, reset_time_seconds)
        """

        # Admin with unlimited quota always allowed
        if self.admin_quota is None and "admin" in user_roles:
            return True, 999999, 0

        # Get or create bucket for user
        quota = self.get_quota_for_user(user_id, user_roles)

        if user_id not in self.buckets or self.buckets[user_id] is None:
            with self.lock:
                self.buckets[user_id] = TokenBucket(
                    capacity=quota,
                    refill_rate=quota / self.default_window_seconds,
                    refill_interval_seconds=1,
                )

        bucket = self.buckets[user_id]

        # Try to consume 1 token
        allowed = bucket.consume(1)
        remaining = bucket.get_remaining_tokens()

        logger.info(
            f"Rate limit check: user={user_id}, allowed={allowed}, "
            f"remaining={remaining}, quota={quota}"
        )

        return allowed, remaining, self.default_window_seconds

    def reset_user_quota(self, user_id: str):
        """Reset quota for a user (admin override).

        Args:
            user_id: User to reset
        """

        with self.lock:
            if user_id in self.buckets:
                self.buckets[user_id] = None

        logger.info(f"Rate limit quota reset for user: {user_id}")

    def get_user_stats(self, user_id: str) -> Dict:
        """Get rate limit stats for a user.

        Args:
            user_id: User to check

        Returns:
            Stats dict with quota info
        """

        if user_id not in self.buckets or self.buckets[user_id] is None:
            return {"error": "No bucket for user"}

        bucket = self.buckets[user_id]

        return {
            "user_id": user_id,
            "remaining_tokens": bucket.get_remaining_tokens(),
            "capacity": bucket.capacity,
            "refill_rate": bucket.refill_rate,
        }


class RateLimitExceeded(Exception):
    """Exception raised when rate limit exceeded."""

    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"Rate limit exceeded. Retry after {retry_after_seconds}s")
