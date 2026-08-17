from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import datasets, health, message
from app.schemas.health import HealthResponse

app = FastAPI(
    title="COMSOL AI Explorer API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(message.router, prefix="/api")
app.include_router(datasets.router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def root_health_check() -> HealthResponse:
    return HealthResponse(status="ok")
