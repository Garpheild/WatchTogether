import re

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.realtime.protocol import (
    ClientEnvelope,
    PlaybackCommandPayload,
    server_event,
    validation_details,
)

ISO_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def test_server_event_has_protocol_fields() -> None:
    event = server_event("playback.state", "k7m2p9qx", {"reason": "command"})
    assert event["type"] == "playback.state"
    assert event["room_code"] == "k7m2p9qx"
    assert event["request_id"] is None
    assert ISO_PATTERN.match(str(event["server_time"]))
    assert event["event_id"]
    assert event["payload"] == {"reason": "command"}


def test_client_envelope_rejects_unknown_fields() -> None:
    with pytest.raises(PydanticValidationError):
        ClientEnvelope.model_validate({"type": "ping", "payload": {}, "unexpected": True})


def test_playback_command_rejects_unknown_action() -> None:
    with pytest.raises(PydanticValidationError):
        PlaybackCommandPayload.model_validate({"action": "rewind", "position_seconds": 1})


def test_validation_details_lists_fields() -> None:
    try:
        ClientEnvelope.model_validate({"type": "ping", "payload": {}, "x": 1})
    except PydanticValidationError as exc:
        details = validation_details(exc)
    else:  # pragma: no cover
        raise AssertionError("validation should fail")
    assert details["fields"]
    assert details["fields"][0]["field"]
