from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.config import load_settings
from app.db.mongo import MongoDatabase


router = APIRouter(prefix="/navigation", tags=["navigation"])


def get_database() -> tuple[MongoDatabase, str]:
    settings = load_settings()
    return MongoDatabase(settings.mongodb.uri, settings.mongodb.database), settings.collections.schedule


@router.get("")
def navigation(database_settings: Annotated[tuple[MongoDatabase, str], Depends(get_database)]) -> dict[str, Any]:
    database, schedule_collection = database_settings
    upcoming_count = database.collection(schedule_collection).count_documents(
        {
            "$or": [
                {"game_status": {"$ne": "finished"}},
                {"game_date": {"$gt": datetime.now()}},
            ]
        }
    )

    return {"has_upcoming_matches": upcoming_count > 0}
