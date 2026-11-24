from urllib.parse import parse_qs, urlparse

_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}


def parse_youtube_url(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None

    parsed = urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
        return None
    if parsed.hostname not in _HOSTS:
        return None
    if parsed.port not in (None, 80, 443):
        return None

    host = parsed.hostname
    video_id: str | None = None
    if host == "youtu.be":
        video_id = parsed.path.strip("/").split("/")[0]
    elif parsed.path == "/watch":
        video_id = parse_qs(parsed.query).get("v", [None])[0]
    elif parsed.path.startswith("/embed/"):
        video_id = parsed.path.split("/")[2] if len(parsed.path.split("/")) > 2 else None
    elif parsed.path.startswith("/shorts/"):
        video_id = parsed.path.split("/")[2] if len(parsed.path.split("/")) > 2 else None
    elif parsed.path.startswith("/live/"):
        video_id = parsed.path.split("/")[2] if len(parsed.path.split("/")) > 2 else None

    if not video_id or len(video_id) != 11:
        return None
    if any(
        char not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        for char in video_id
    ):
        return None
    return video_id


def canonical_youtube_url(video_id: str | None) -> str | None:
    return f"https://www.youtube.com/watch?v={video_id}" if video_id else None
