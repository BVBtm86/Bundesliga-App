from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.navigation import router as navigation_router
from app.api.routes.standings import router as standings_router


app = FastAPI(
    title="Bundesliga App API",
    version="0.1.0",
    description="Professional Bundesliga analytics API backed by WhoScored MongoDB data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(standings_router, prefix="/api")
app.include_router(navigation_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
