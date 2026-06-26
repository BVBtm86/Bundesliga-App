from __future__ import annotations

from typing import Any

from app.core.config import CollectionSettings
from app.db.mongo import MongoDatabase


class StandingsService:
    def __init__(self, database: MongoDatabase, collections: CollectionSettings) -> None:
        self.database = database
        self.collections = collections

    def standings_page(
        self,
        season: str | None = None,
        table_type: str = "Total",
        round_filter: str = "all",
        matchweek_filter: str = "latest",
        minute_filter: str = "ft",
    ) -> dict[str, Any]:
        selected_season = season or self.latest_season()
        selected_type = table_type if table_type in {"Total", "Home", "Away"} else "Total"
        selected_round = round_filter if round_filter in _round_filters() else "all"
        selected_matchweek = self._normalize_matchweek_filter(selected_season, selected_round, matchweek_filter)
        # selected_minute = _normalize_minute_filter(minute_filter)

        return {
            "database": self.database.database.name,
            "season": selected_season,
            "table_type": selected_type,
            "round_filter": selected_round,
            "matchweek_filter": selected_matchweek,
            # "minute_filter": selected_minute,
            "minute_filter": minute_filter,
            "filters": {
                "seasons": self.seasons(),
                "table_types": ["Total", "Home", "Away"],
                "round_filters": _round_filters(),
                "matchweek_filters": self.matchweek_filters(selected_season, selected_round),
                "minute_filters": _minute_filters(),
            },
            "table": self.standings(selected_season, selected_type, selected_round, selected_matchweek, minute_filter),
        }

    def seasons(self) -> list[str]:
        pipeline = [
            {"$match": {"season": {"$type": "string"}}},
            {"$group": {"_id": "$season"}},
            {"$sort": {"_id": 1}},
        ]
        return [row["_id"] for row in self.database.collection(self.collections.schedule).aggregate(pipeline)]

    def latest_season(self) -> str | None:
        seasons = self.seasons()
        return seasons[-1] if seasons else None

    def matchweek_filters(self, season: str | None, round_filter: str = "all") -> dict[str, str]:
        query = _season_match(season)
        weeks = sorted(
            week
            for week in self.database.collection(self.collections.team_stats).distinct("week", query)
            if isinstance(week, int)
        )
        start_week, end_week = _round_week_bounds(round_filter)
        if start_week is not None:
            weeks = [week for week in weeks if week >= start_week]
        if end_week is not None:
            weeks = [week for week in weeks if week <= end_week]
        return {str(week): str(week) for week in weeks}

    def standings(
        self,
        season: str | None,
        table_type: str = "Total",
        round_filter: str = "all",
        matchweek_filter: str = "latest",
        minute_filter: str = "ft",
    ) -> list[dict[str, Any]]:
        query = _season_match(season)
        if table_type == "Home":
            query["game_venue"] = "home"
        elif table_type == "Away":
            query["game_venue"] = "away"

        week_filter = _build_week_filter(round_filter, matchweek_filter)
        if week_filter:
            query["week"] = week_filter

        stats_path = f"stats.{minute_filter}.goals"
        opp_stats_path = f"opp_stats.{minute_filter}.goals"
        rows = self.database.collection(self.collections.team_stats).find(
            query,
            {
                "_id": 0,
                "team_id": 1,
                "team_name": 1,
                "game_date": 1,
                stats_path: 1,
                opp_stats_path: 1,
            },
        )

        teams: dict[int, dict[str, Any]] = {}
        dated_results: dict[int, list[dict[str, Any]]] = {}
        assets = self._team_assets()

        for row in rows:
            team_id = row["team_id"]
            team_assets = assets.get(team_id, {})
            goals_for = int(row.get("stats", {}).get(minute_filter, {}).get("goals") or 0)
            goals_against = int(row.get("opp_stats", {}).get(minute_filter, {}).get("goals") or 0)
            result, points = _result_and_points(goals_for, goals_against)

            team = teams.setdefault(
                team_id,
                {
                    "team_id": team_id,
                    "team_name": row["team_name"],
                    "display_name": team_assets.get("team_name") or row["team_name"],
                    "team_logo": team_assets.get("team_logo"),
                    "played": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "goals_for": 0,
                    "goals_against": 0,
                    "goal_difference": 0,
                    "points": 0,
                },
            )
            team["played"] += 1
            team["wins"] += int(result == "W")
            team["draws"] += int(result == "D")
            team["losses"] += int(result == "L")
            team["goals_for"] += goals_for
            team["goals_against"] += goals_against
            team["goal_difference"] = team["goals_for"] - team["goals_against"]
            team["points"] += points
            dated_results.setdefault(team_id, []).append(
                {
                    "date": row.get("game_date"),
                    "result": result,
                    "goals_for": goals_for,
                    "goals_against": goals_against,
                }
            )

        table = sorted(
            teams.values(),
            key=lambda team: (
                team["points"],
                team["goal_difference"],
                team["goals_for"],
                team["wins"],
                team["team_name"],
            ),
            reverse=True,
        )

        for rank, team in enumerate(table, start=1):
            form = sorted(dated_results.get(team["team_id"], []), key=lambda item: item["date"] or "", reverse=True)
            team["rank"] = rank
            team["form_matches"] = [
                {
                    "result": match["result"],
                    "goals_for": match["goals_for"],
                    "goals_against": match["goals_against"],
                }
                for match in form
            ]
            team["form_history"] = [match["result"] for match in form]
            team["form"] = team["form_history"][:5]
            team["zone"] = _table_zone(rank, len(table))

        return table

    def _team_assets(self) -> dict[int, dict[str, Any]]:
        rows = self.database.collection(self.collections.available_teams).find(
            {},
            {
                "_id": 0,
                "ws_team_id": 1,
                "team_name": 1,
                "team_logo": 1,
            },
        )
        return {row["ws_team_id"]: row for row in rows if row.get("ws_team_id") is not None}

    def _normalize_matchweek_filter(self, season: str | None, round_filter: str, matchweek_filter: str) -> str:
        filters = self.matchweek_filters(season, round_filter)
        if matchweek_filter in filters:
            return matchweek_filter

        available_weeks = list(filters)
        return available_weeks[-1] if available_weeks else "latest"


def _season_match(season: str | None) -> dict[str, Any]:
    return {"season": season} if season else {}


def _result_and_points(goals_for: int, goals_against: int) -> tuple[str, int]:
    if goals_for > goals_against:
        return "W", 3
    if goals_for < goals_against:
        return "L", 0
    return "D", 1


def _table_zone(rank: int, table_size: int) -> str:
    if rank == 1:
        return "champion"
    if rank <= 4:
        return "champions_league"
    if rank <= 6:
        return "europe"
    if rank == max(table_size - 2, 1):
        return "playoff"
    if rank >= max(table_size - 1, 1):
        return "relegation"
    return "midtable"


def _round_filters() -> dict[str, str]:
    return {
        "all": "All",
        "tur": "First half of the season",
        "retur": "Second half of the season",
    }


def _round_week_bounds(round_filter: str) -> tuple[int | None, int | None]:
    if round_filter == "tur":
        return 1, 17
    if round_filter == "retur":
        return 18, 34
    return None, None


def _build_week_filter(round_filter: str, matchweek_filter: str) -> dict[str, int]:
    start_week, end_week = _round_week_bounds(round_filter)
    if matchweek_filter.isdigit():
        selected_week = int(matchweek_filter)
        end_week = min(end_week, selected_week) if end_week is not None else selected_week

    week_filter: dict[str, int] = {}
    if start_week is not None:
        week_filter["$gte"] = start_week
    if end_week is not None:
        week_filter["$lte"] = end_week
    return week_filter


def _minute_filters() -> dict[str, str]:
    return {
        "ft": "Full time",
        "fh": "First half",
        "sh": "Second half",
        "m_1_15": "Minutes 1-15",
        "m_16_30": "Minutes 16-30",
        "m_31_45": "Minutes 31-45+",
        "m_46_60": "Minutes 46-60",
        "m_61_75": "Minutes 61-75",
        "m_76_90": "Minutes 76-90+",
        "m_1_30": "Minutes 1-30",
        "m_31_60": "Minutes 31-60",
        "m_61_90": "Minutes 61-90+",
    }


# def _normalize_minute_filter(minute_filter: str) -> str:
#     aliases = {
#         "m_75_90": "m_76_90",
#     }
#     normalized = aliases.get(minute_filter, minute_filter)
#     return normalized if normalized in _minute_filters() else "ft"
