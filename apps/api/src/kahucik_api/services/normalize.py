import re

_NICK_RE = re.compile(r"^[A-Za-z0-9_\- .ÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽáäčďéíĺľňóôŕšťúýž]{2,40}$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_nickname(nickname: str) -> str:
    return " ".join(nickname.strip().split()).casefold()


def validate_nickname(nickname: str) -> str:
    cleaned = " ".join(nickname.strip().split())
    if not _NICK_RE.match(cleaned):
        raise ValueError("Nickname must be 2-40 characters and use letters, numbers, spaces, _ or -")
    return cleaned
