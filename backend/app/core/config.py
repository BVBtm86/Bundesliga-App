from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class MongoSettings:
    uri: str
    database: str


@dataclass(frozen=True)
class CollectionSettings:
    available_teams: str
    schedule: str
    team_stats: str


@dataclass(frozen=True)
class AnalyticsSettings:
    default_season: str


@dataclass(frozen=True)
class Settings:
    mongodb: MongoSettings
    collections: CollectionSettings
    analytics: AnalyticsSettings


def load_settings(path: Path | None = None) -> Settings:
    config_path = path or ROOT / "config.yaml"
    raw = _read_yaml(config_path)
    return Settings(
        mongodb=MongoSettings(
            uri=raw.get("mongodb", {}).get("uri", "mongodb://localhost:27017"),
            database=raw.get("mongodb", {}).get("database", "WhoScored"),
        ),
        collections=CollectionSettings(
            available_teams=raw.get("collections", {}).get("available_teams", "available_teams"),
            schedule=raw.get("collections", {}).get("schedule", "game_schedule"),
            team_stats=raw.get("collections", {}).get("team_stats", "game_team_stats"),
        ),
        analytics=AnalyticsSettings(
            default_season=str(raw.get("analytics", {}).get("default_season", "latest")),
        ),
    )


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
