from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core import get_settings
from app.db.database import init_db

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="FastAPI backend for the AI English speaking tutor MVP.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/")
def root() -> dict:
    return {
        "status": "success",
        "data": {
            "service": "ai-tutor-mvp-backend",
            "version": settings.app_version,
            "environment": settings.app_env,
            "docs": "/docs",
            "health": "/health",
            "providers": "/api/v1/system/providers",
        },
        "message": "AI tutor backend is running.",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "success",
        "data": {
            "service": "ai-tutor-mvp-backend",
            "version": settings.app_version,
            "environment": settings.app_env,
        },
        "message": "healthy",
    }


app.include_router(api_router, prefix="/api/v1")

# Compatibility for already-deployed frontend bundles that were built with the
# Railway domain but without the /api/v1 suffix.
app.include_router(api_router)
