from app.core.rate_limit import TokenBucket


def test_token_bucket_burst_and_isolation() -> None:
    bucket = TokenBucket(rate=1.0, burst=2)
    assert bucket.consume("a")
    assert bucket.consume("a")
    assert not bucket.consume("a")
    assert bucket.consume("b")
