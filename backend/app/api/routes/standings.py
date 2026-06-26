from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.analytics.standings import StandingsService
from app.core.config import load_settings
from app.db.mongo import MongoDatabase


router = APIRouter(prefix="/standings", tags=["standings"])


def get_standings_service() -> StandingsService:
    settings = load_settings()
    database = MongoDatabase(settings.mongodb.uri, settings.mongodb.database)
    return StandingsService(database, settings.collections)


@router.get("")
def standings(
    service: Annotated[StandingsService, Depends(get_standings_service)],
    season: Annotated[str | None, Query()] = None,
    table_type: Annotated[str, Query()] = "Total",
    round_filter: Annotated[str, Query()] = "all",
    matchweek_filter: Annotated[str, Query()] = "latest",
    minute_filter: Annotated[str, Query()] = "ft",
) -> dict[str, Any]:
    return service.standings_page(
        season=season,
        table_type=table_type,
        round_filter=round_filter,
        matchweek_filter=matchweek_filter,
        minute_filter=minute_filter,
    )
