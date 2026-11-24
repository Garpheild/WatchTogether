import time
from dataclasses import dataclass

from app.core.errors import RateLimited


@dataclass
class Bucket:
    tokens: float
    updated_at: float


class TokenBucket:
    def __init__(self, rate: float, burst: float) -> None:
        self.rate = rate
        self.burst = burst
        self._buckets: dict[str, Bucket] = {}

    def consume(self, key: str) -> bool:
        now = time.monotonic()
        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = Bucket(self.burst, now)
            self._buckets[key] = bucket
        elapsed = max(0.0, now - bucket.updated_at)
        bucket.tokens = min(self.burst, bucket.tokens + elapsed * self.rate)
        bucket.updated_at = now
        if bucket.tokens < 1:
            return False
        bucket.tokens -= 1
        return True

    def require(self, key: str) -> None:
        if not self.consume(key):
            raise RateLimited(max(1, int(1 / self.rate)))
