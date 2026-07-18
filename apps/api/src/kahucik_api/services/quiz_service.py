from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from kahucik_api.models.entities import Question, QuestionOption, QuestionType, Quiz, QuizStatus
from kahucik_api.schemas.quiz import QuestionIn, QuizCreate, QuizUpdate


async def create_quiz(db: AsyncSession, owner_id: uuid.UUID, data: QuizCreate) -> Quiz:
    quiz = Quiz(owner_id=owner_id, title=data.title, description=data.description)
    db.add(quiz)
    await db.flush()
    return quiz


async def get_owned_quiz(db: AsyncSession, quiz_id: uuid.UUID, owner_id: uuid.UUID) -> Quiz:
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .where(Quiz.id == quiz_id, Quiz.owner_id == owner_id)
    )
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return quiz


async def list_quizzes(db: AsyncSession, owner_id: uuid.UUID) -> list[Quiz]:
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.owner_id == owner_id, Quiz.status != QuizStatus.ARCHIVED)
        .order_by(Quiz.updated_at.desc())
    )
    return list(result.scalars().all())


def _replace_questions(quiz: Quiz, questions: list[QuestionIn]) -> None:
    quiz.questions.clear()
    for idx, q in enumerate(questions):
        question = Question(
            id=q.id or uuid.uuid4(),
            position=idx,
            type=QuestionType(q.type),
            text=q.text,
            timer_seconds=q.timer_seconds,
            image_id=q.image_id,
        )
        for oidx, opt in enumerate(q.options):
            question.options.append(
                QuestionOption(
                    id=opt.id or uuid.uuid4(),
                    position=oidx,
                    text=opt.text,
                    is_correct=opt.is_correct if q.type != "puzzle" else False,
                    correct_order=opt.correct_order if q.type == "puzzle" else None,
                    image_id=opt.image_id,
                )
            )
        quiz.questions.append(question)


async def update_quiz(db: AsyncSession, quiz: Quiz, data: QuizUpdate) -> Quiz:
    if quiz.status == QuizStatus.ARCHIVED:
        raise HTTPException(status_code=400, detail="Archived quiz cannot be edited")
    if data.title is not None:
        quiz.title = data.title
    if data.description is not None:
        quiz.description = data.description
    if data.questions is not None:
        if quiz.status == QuizStatus.PUBLISHED:
            quiz.status = QuizStatus.DRAFT
            quiz.published_at = None
        _replace_questions(quiz, data.questions)
    quiz.updated_at = datetime.now(UTC)
    await db.flush()
    return await get_owned_quiz(db, quiz.id, quiz.owner_id)


async def publish_quiz(db: AsyncSession, quiz: Quiz) -> Quiz:
    if not quiz.questions:
        raise HTTPException(status_code=400, detail="Quiz needs at least one question")
    quiz.status = QuizStatus.PUBLISHED
    quiz.published_at = datetime.now(UTC)
    quiz.updated_at = datetime.now(UTC)
    await db.flush()
    return quiz


async def unpublish_quiz(db: AsyncSession, quiz: Quiz) -> Quiz:
    quiz.status = QuizStatus.DRAFT
    quiz.published_at = None
    quiz.updated_at = datetime.now(UTC)
    await db.flush()
    return quiz


async def archive_quiz(db: AsyncSession, quiz: Quiz) -> Quiz:
    quiz.status = QuizStatus.ARCHIVED
    quiz.updated_at = datetime.now(UTC)
    await db.flush()
    return quiz


async def duplicate_quiz(db: AsyncSession, quiz: Quiz, owner_id: uuid.UUID) -> Quiz:
    clone = Quiz(
        owner_id=owner_id,
        title=f"{quiz.title} (copy)",
        description=quiz.description,
        status=QuizStatus.DRAFT,
    )
    for q in quiz.questions:
        nq = Question(
            position=q.position,
            type=q.type,
            text=q.text,
            timer_seconds=q.timer_seconds,
            image_id=q.image_id,
        )
        for o in q.options:
            nq.options.append(
                QuestionOption(
                    position=o.position,
                    text=o.text,
                    is_correct=o.is_correct,
                    correct_order=o.correct_order,
                    image_id=o.image_id,
                )
            )
        clone.questions.append(nq)
    db.add(clone)
    await db.flush()
    return await get_owned_quiz(db, clone.id, owner_id)


def quiz_snapshot(quiz: Quiz) -> dict:
    questions = []
    for q in sorted(quiz.questions, key=lambda x: x.position):
        options = []
        for o in sorted(q.options, key=lambda x: x.position):
            options.append(
                {
                    "id": str(o.id),
                    "text": o.text,
                    "is_correct": o.is_correct,
                    "correct_order": o.correct_order,
                    "image_id": str(o.image_id) if o.image_id else None,
                    "position": o.position,
                }
            )
        questions.append(
            {
                "id": str(q.id),
                "type": q.type.value,
                "text": q.text,
                "timer_seconds": q.timer_seconds,
                "image_id": str(q.image_id) if q.image_id else None,
                "position": q.position,
                "options": options,
            }
        )
    return {
        "id": str(quiz.id),
        "title": quiz.title,
        "description": quiz.description,
        "questions": questions,
    }


def public_question(snapshot_q: dict, include_answers: bool = False) -> dict:
    options = []
    for o in snapshot_q["options"]:
        item = {
            "id": o["id"],
            "text": o["text"],
            "image_id": o["image_id"],
            "position": o["position"],
        }
        if include_answers:
            item["is_correct"] = o["is_correct"]
            item["correct_order"] = o["correct_order"]
        options.append(item)
    # Shuffle display order for players is handled client-side for puzzle; keep stable server order
    return {
        "id": snapshot_q["id"],
        "type": snapshot_q["type"],
        "text": snapshot_q["text"],
        "timer_seconds": snapshot_q["timer_seconds"],
        "image_id": snapshot_q["image_id"],
        "position": snapshot_q["position"],
        "options": options,
    }


def correct_map(snapshot_q: dict) -> dict:
    qtype = snapshot_q["type"]
    if qtype in {"quiz", "true_false"}:
        correct = next(o for o in snapshot_q["options"] if o["is_correct"])
        return {"correct_option_id": correct["id"]}
    if qtype == "multi_select":
        return {
            "correct_option_ids": [o["id"] for o in snapshot_q["options"] if o["is_correct"]],
        }
    ordered = sorted(
        snapshot_q["options"],
        key=lambda o: (o["correct_order"] is None, o["correct_order"] if o["correct_order"] is not None else 0),
    )
    return {"ordered_option_ids": [o["id"] for o in ordered]}
