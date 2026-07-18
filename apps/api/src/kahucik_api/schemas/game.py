from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

GameStatus = Literal[
    "lobby",
    "countdown",
    "question_active",
    "question_reveal",
    "leaderboard",
    "finished",
    "cancelled",
]


class HostGameRequest(BaseModel):
    quiz_id: UUID


class JoinGuestRequest(BaseModel):
    nickname: str = Field(min_length=2, max_length=40)
    locale: str = Field(default="en", pattern="^(en|sk)$")


class JoinRegisteredRequest(BaseModel):
    locale: str = Field(default="en", pattern="^(en|sk)$")


class AnswerPayload(BaseModel):
    option_id: UUID | None = None
    option_ids: list[UUID] = Field(default_factory=list)
    ordered_option_ids: list[UUID] = Field(default_factory=list)


class ParticipantOut(BaseModel):
    id: UUID
    nickname: str
    is_guest: bool
    score: int
    connected: bool
    join_order: int


class GameOut(BaseModel):
    id: UUID
    code: str
    status: GameStatus
    quiz_title: str
    current_question_index: int
    participant_count: int
    join_url: str
    created_at: datetime


class JoinResponse(BaseModel):
    game_id: UUID
    participant_id: UUID
    reconnect_token: str
    nickname: str
    is_guest: bool


class LeaderboardEntry(BaseModel):
    nickname: str
    score: int
    rank: int
    is_guest: bool
    user_id: UUID | None = None
    games_played: int | None = None
    wins: int | None = None
    average_score: float | None = None


class GameHistoryItem(BaseModel):
    game_id: UUID
    quiz_title: str
    score: int
    rank: int
    answers_correct: int
    answers_total: int
    finished_at: datetime | None
    participants: int


class WsCommand(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class WsEvent(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
