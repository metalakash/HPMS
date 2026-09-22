"""Cache manager for query result caching.

Reduces database load by caching frequently-accessed data.
"""

import logging
import time
import json
from typing import Any, Optional, Dict, Callable
from collections import OrderedDict
from threading import Lock

logger = logging.getLogger(__name__)


class CacheEntry:
    """Single cache entry with TTL."""

    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.created_at = time.time()
        self.ttl_seconds = ttl_seconds

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        age = time.time() - self.created_at
        return age > self.ttl_seconds

    def __repr__(self):
        return f"CacheEntry(age={int(time.time() - self.created_at)}s, ttl={self.ttl_seconds}s)"


class CacheManager:
    """In-memory cache with TTL support.

    Thread-safe LRU cache for query results.
    """

    def __init__(self, max_size: int = 1000, default_ttl_seconds: int = 300):
        """Initialize cache.

        Args:
            max_size: Maximum entries (default 1000)
            default_ttl_seconds: Default TTL for entries (default 5 minutes)
        """

        self.max_size = max_size
        self.default_ttl_seconds = default_ttl_seconds
        self.cache: Dict[str, CacheEntry] = OrderedDict()
        self.hits = 0
        self.misses = 0
        self.lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """

        with self.lock:
            if key not in self.cache:
                self.misses += 1
                return None

            entry = self.cache[key]

            if entry.is_expired():
                del self.cache[key]
                self.misses += 1
                logger.debug(f"Cache miss (expired): {key}")
                return None

            # Move to end (LRU)
            self.cache.move_to_end(key)

            self.hits += 1
            logger.debug(f"Cache hit: {key} ({entry})")
            return entry.value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None):
        """Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl_seconds: TTL override (default uses class default)
        """

        ttl = ttl_seconds or self.default_ttl_seconds

        with self.lock:
            # Remove old entry if exists
            if key in self.cache:
                del self.cache[key]

            # Add new entry
            self.cache[key] = CacheEntry(value, ttl)

            # Evict LRU if over capacity
            while len(self.cache) > self.max_size:
                evicted_key, _ = self.cache.popitem(last=False)
                logger.debug(f"Cache eviction: {evicted_key} (size={len(self.cache)})")

            logger.debug(f"Cache set: {key} (ttl={ttl}s)")

    def delete(self, key: str) -> bool:
        """Delete entry from cache.

        Args:
            key: Cache key to delete

        Returns:
            True if deleted, False if not found
        """

        with self.lock:
            if key in self.cache:
                del self.cache[key]
                logger.debug(f"Cache delete: {key}")
                return True

            return False

    def clear(self):
        """Clear all cache entries."""

        with self.lock:
            size = len(self.cache)
            self.cache.clear()
            self.hits = 0
            self.misses = 0
            logger.info(f"Cache cleared ({size} entries)")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics.

        Returns:
            Stats dict with hits, misses, hit rate, size
        """

        with self.lock:
            total = self.hits + self.misses
            hit_rate = (self.hits / total * 100) if total > 0 else 0

            return {
                "hits": self.hits,
                "misses": self.misses,
                "total": total,
                "hit_rate_percent": round(hit_rate, 2),
                "size": len(self.cache),
                "max_size": self.max_size,
            }

    def cache_key(self, prefix: str, **kwargs) -> str:
        """Generate cache key from prefix and kwargs.

        Args:
            prefix: Cache key prefix (e.g., "project_list")
            **kwargs: Key components (e.g., province="Gandaki")

        Returns:
            Cache key string
        """

        # Sort kwargs for consistent keys
        sorted_items = sorted(kwargs.items())
        params = "&".join(f"{k}={v}" for k, v in sorted_items)

        if params:
            return f"{prefix}:{params}"
        return prefix


# Global cache instance
_cache_instance: Optional[CacheManager] = None


def get_cache_manager() -> CacheManager:
    """Get global cache manager instance."""

    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheManager()
    return _cache_instance


def cache_result(
    ttl_seconds: int = 300,
    key_prefix: str = "",
) -> Callable:
    """Decorator to cache async function results.

    Args:
        ttl_seconds: Cache TTL (default 5 minutes)
        key_prefix: Cache key prefix

    Usage:
        @cache_result(ttl_seconds=600, key_prefix="projects")
        async def get_projects(province: str):
            ...
    """

    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            cache = get_cache_manager()

            # Generate cache key
            func_prefix = key_prefix or func.__name__
            cache_key = cache.cache_key(func_prefix, **kwargs)

            # Try to get from cache
            cached = cache.get(cache_key)
            if cached is not None:
                logger.debug(f"Returning cached result: {cache_key}")
                return cached

            # Call function
            result = await func(*args, **kwargs)

            # Cache result
            cache.set(cache_key, result, ttl_seconds)

            return result

        return wrapper

    return decorator
