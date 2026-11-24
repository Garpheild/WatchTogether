import pytest

from app.core.youtube import canonical_youtube_url, parse_youtube_url


@pytest.mark.parametrize(
    ("url", "video_id"),
    [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ],
)
def test_parse_supported_youtube_urls(url: str, video_id: str) -> None:
    assert parse_youtube_url(url) == video_id
    assert canonical_youtube_url(video_id) == f"https://www.youtube.com/watch?v={video_id}"


@pytest.mark.parametrize(
    "url",
    [
        "https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ",
        "https://127.0.0.1/watch?v=dQw4w9WgXcQ",
        "javascript:alert(1)",
        "https://youtube.com/watch?v=short",
    ],
)
def test_reject_invalid_youtube_urls(url: str) -> None:
    assert parse_youtube_url(url) is None
