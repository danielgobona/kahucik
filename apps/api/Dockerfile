FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
COPY README.md* ./
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic
RUN uv sync --frozen --no-dev

FROM python:3.14-slim-bookworm AS runtime
RUN useradd --create-home --uid 10001 appuser
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    MEDIA_LOCAL_PATH=/data/media
COPY --from=builder /app /app
RUN mkdir -p /data/media && chown -R appuser:appuser /app /data
USER appuser
EXPOSE 8000
CMD ["uvicorn", "kahucik_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
