from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from kahucik_api.auth.sessions import require_user
from kahucik_api.db import get_db
from kahucik_api.models.entities import User
from kahucik_api.schemas.common import Page
from kahucik_api.schemas.quiz import QuizCreate, QuizOut, QuizSummary, QuizUpdate
from kahucik_api.services import quiz_service

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


@router.get("", response_model=Page[QuizSummary])
async def list_my_quizzes(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
    limit: int = Query(12, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> Page[QuizSummary]:
    quizzes, total = await quiz_service.list_quizzes(
        db, user.id, limit=limit, offset=offset
    )
    return Page(
        items=[
            QuizSummary(
                id=q.id,
                title=q.title,
                description=q.description,
                status=q.status.value,
                question_count=len(q.questions),
                updated_at=q.updated_at,
            )
            for q in quizzes
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=QuizOut)
async def create(
    body: QuizCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
) -> QuizOut:
    quiz = await quiz_service.create_quiz(db, user.id, body)
    await db.commit()
    quiz = await quiz_service.get_owned_quiz(db, quiz.id, user.id)
    return QuizOut.model_validate(quiz)


@router.get("/{quiz_id}", response_model=QuizOut)
async def get_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
) -> QuizOut:
    quiz = await quiz_service.get_owned_quiz(db, quiz_id, user.id)
    return QuizOut.model_validate(quiz)


@router.put("/{quiz_id}", response_model=QuizOut)
async def update(
    quiz_id: UUID,
    body: QuizUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
) -> QuizOut:
    quiz = await quiz_service.get_owned_quiz(db, quiz_id, user.id)
    quiz = await quiz_service.update_quiz(db, quiz, body)
    await db.commit()
    quiz = await quiz_service.get_owned_quiz(db, quiz_id, user.id)
    return QuizOut.model_validate(quiz)


@router.post("/{quiz_id}/publish", response_model=QuizOut)
async def publish(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
) -> QuizOut:
    quiz = await quiz_service.get_owned_quiz(db, quiz_id, user.id)
    quiz = await quiz_service.publish_quiz(db, quiz)
    await db.commit()
    return QuizOut.model_validate(quiz)


@router.post("/{quiz_id}/unpublish", response_model=QuizOut)
async def unpublish(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
) -> QuizOut:
    quiz = await quiz_service.get_owned_quiz(db, quiz_id, user.id)
    quiz = await quiz_service.unpublish_quiz(db, quiz)
    await db.commit()
    return QuizOut.model_validate(quiz)


@router.post("/{quiz_id}/archive", response_model=QuizOut)
async def archive(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
) -> QuizOut:
    quiz = await quiz_service.get_owned_quiz(db, quiz_id, user.id)
    quiz = await quiz_service.archive_quiz(db, quiz)
    await db.commit()
    return QuizOut.model_validate(quiz)


@router.post("/{quiz_id}/duplicate", response_model=QuizOut)
async def duplicate(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
) -> QuizOut:
    quiz = await quiz_service.get_owned_quiz(db, quiz_id, user.id)
    clone = await quiz_service.duplicate_quiz(db, quiz, user.id)
    await db.commit()
    return QuizOut.model_validate(clone)
