import pytest
from pydantic import ValidationError

from kahucik_api.schemas.quiz import QuestionIn


def test_quiz_requires_one_correct():
    with pytest.raises(ValidationError):
        QuestionIn(
            type="quiz",
            text="Q?",
            options=[
                {"text": "A", "is_correct": False},
                {"text": "B", "is_correct": False},
            ],
        )


def test_puzzle_orders():
    q = QuestionIn(
        type="puzzle",
        text="Order",
        options=[
            {"text": "A", "correct_order": 0},
            {"text": "B", "correct_order": 1},
            {"text": "C", "correct_order": 2},
        ],
    )
    assert len(q.options) == 3


def test_true_false():
    q = QuestionIn(
        type="true_false",
        text="True?",
        options=[
            {"text": "True", "is_correct": True},
            {"text": "False", "is_correct": False},
        ],
    )
    assert q.type == "true_false"
