import pytest

from kahucik_api.services.normalize import normalize_email, normalize_nickname, validate_nickname


def test_normalize_email():
    assert normalize_email("  Foo@Example.COM ") == "foo@example.com"


def test_normalize_nickname():
    assert normalize_nickname("  Super  Rooster ") == "super rooster"


def test_validate_nickname_ok():
    assert validate_nickname("Kahúcik") == "Kahúcik"


def test_validate_nickname_bad():
    with pytest.raises(ValueError):
        validate_nickname("x")
