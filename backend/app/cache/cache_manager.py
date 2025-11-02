# backend/app/cache/cache_manager.py
from functools import lru_cache
from typing import Any, Dict, Optional
import time

class CacheManager:
    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        self.ttl = ttl
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_size = max_size

    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            item = self.cache[key]
            if time.time() - item['timestamp'] < self.ttl:
                return item['value']
            del self.cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        if len(self.cache) >= self.max_size:
            # Remove oldest item
            oldest = min(self.cache.items(), key=lambda x: x[1]['timestamp'])
            del self.cache[oldest[0]]
        
        self.cache[key] = {
            'value': value,
            'timestamp': time.time()
        }