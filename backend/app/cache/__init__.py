"""Cache module for query result caching."""

from .cache_manager import CacheManager, get_cache_manager, cache_result

__all__ = [
    "CacheManager",
    "get_cache_manager",
    "cache_result",
]
