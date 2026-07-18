def main() -> None:
    import uvicorn

    from kahucik_api.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "kahucik_api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
    )
