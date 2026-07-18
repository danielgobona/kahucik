from __future__ import annotations

from typing import Any


MAX_POINTS = 1000


def speed_points(response_ms: int, timer_seconds: int, max_points: int = MAX_POINTS) -> int:
    if response_ms < 500:
        return max_points
    timer_ms = max(timer_seconds, 1) * 1000
    ratio = min(max(response_ms / timer_ms, 0.0), 1.0)
    return int(round((1 - (ratio / 2)) * max_points))


def score_answer(
    question_type: str,
    timer_seconds: int,
    response_ms: int,
    payload: dict[str, Any],
    correct: dict[str, Any],
) -> tuple[bool, int]:
    if question_type in {"quiz", "true_false"}:
        selected = payload.get("option_id")
        correct_id = correct.get("correct_option_id")
        ok = selected is not None and str(selected) == str(correct_id)
        return ok, speed_points(response_ms, timer_seconds) if ok else 0

    if question_type == "multi_select":
        selected = {str(x) for x in payload.get("option_ids", [])}
        correct_ids = {str(x) for x in correct.get("correct_option_ids", [])}
        if not selected:
            return False, 0
        if selected - correct_ids:
            return False, 0
        if not correct_ids:
            return False, 0
        if selected == correct_ids:
            return True, speed_points(response_ms, timer_seconds)
        # Partial credit when no incorrect options selected; not counted as fully correct
        fraction = len(selected & correct_ids) / len(correct_ids)
        points = int(round(speed_points(response_ms, timer_seconds) * fraction))
        return False, points

    if question_type == "puzzle":
        order = [str(x) for x in payload.get("ordered_option_ids", [])]
        expected = [str(x) for x in correct.get("ordered_option_ids", [])]
        ok = order == expected and bool(expected)
        return ok, speed_points(response_ms, timer_seconds) if ok else 0

    return False, 0
