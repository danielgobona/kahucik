from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

QuestionType = Literal["quiz", "true_false", "multi_select", "puzzle"]
QuizStatus = Literal["draft", "published", "archived"]


class OptionIn(BaseModel):
    id: UUID | None = None
    text: str = Field(default="", max_length=120)
    is_correct: bool = False
    correct_order: int | None = None
    image_id: UUID | None = None


class QuestionIn(BaseModel):
    id: UUID | None = None
    type: QuestionType
    text: str = Field(min_length=1, max_length=240)
    timer_seconds: int = Field(default=20, ge=5, le=240)
    image_id: UUID | None = None
    options: list[OptionIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_options(self) -> QuestionIn:
        opts = self.options
        if self.type == "true_false":
            if len(opts) != 2:
                raise ValueError("true_false requires exactly 2 options")
            if sum(1 for o in opts if o.is_correct) != 1:
                raise ValueError("true_false requires exactly one correct option")
        elif self.type == "quiz":
            if not 2 <= len(opts) <= 4:
                raise ValueError("quiz requires 2-4 options")
            if sum(1 for o in opts if o.is_correct) != 1:
                raise ValueError("quiz requires exactly one correct option")
        elif self.type == "multi_select":
            if not 2 <= len(opts) <= 6:
                raise ValueError("multi_select requires 2-6 options")
            if sum(1 for o in opts if o.is_correct) < 1:
                raise ValueError("multi_select requires at least one correct option")
        elif self.type == "puzzle":
            if not 2 <= len(opts) <= 6:
                raise ValueError("puzzle requires 2-6 tiles")
            orders = sorted(o.correct_order for o in opts if o.correct_order is not None)
            if orders != list(range(len(opts))):
                raise ValueError("puzzle options must have correct_order 0..n-1")
        return self


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class QuizUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    questions: list[QuestionIn] | None = None


class OptionOut(BaseModel):
    id: UUID
    text: str
    is_correct: bool
    correct_order: int | None
    image_id: UUID | None
    position: int

    model_config = {"from_attributes": True}


class QuestionOut(BaseModel):
    id: UUID
    type: QuestionType
    text: str
    timer_seconds: int
    image_id: UUID | None
    position: int
    options: list[OptionOut]

    model_config = {"from_attributes": True}


class QuizOut(BaseModel):
    id: UUID
    title: str
    description: str
    status: QuizStatus
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    questions: list[QuestionOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class QuizSummary(BaseModel):
    id: UUID
    title: str
    description: str
    status: QuizStatus
    question_count: int
    updated_at: datetime


class MediaOut(BaseModel):
    id: UUID
    url: str
    content_type: str
    width: int
    height: int
    byte_size: int
