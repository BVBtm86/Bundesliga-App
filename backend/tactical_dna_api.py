"""Read persisted Tactical DNA match contributions and aggregate a filtered season."""
import os
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Query, Request
from pymongo import MongoClient
from pymongo.errors import PyMongoError

COLLECTION = "game_tactical_dna_app"
VERSION = 1
MINIMUM_SEASON = "2009-2010"
RATIO_METRICS = {
    "passCompletion", "forwardPassShare", "longPassShare", "shotAccuracy", "goalConversion"
}


@asynccontextmanager
async def lifespan(app):
    with MongoClient(
        os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27018/"),
        serverSelectionTimeoutMS=5000,
    ) as client:
        app.state.matches = client[os.environ.get("MONGODB_DB", "WhoScored")][COLLECTION]
        yield


app = FastAPI(title="Bundesliga Tactical DNA", lifespan=lifespan)


@app.get("/tactical-dna/seasons")
def seasons(request: Request):
    try:
        covered = request.app.state.matches.distinct("season", {
            "version": VERSION,
            "completeFullTimeCoverage": True,
        })
    except PyMongoError as error:
        raise HTTPException(503, "Tactical DNA statistics are temporarily unavailable.") from error
    return {"version": VERSION, "seasons": sorted(covered, reverse=True)}


@app.get("/tactical-dna/metrics")
def metrics(
    request: Request,
    season: Annotated[str, Query(pattern=r"^\d{4}-\d{4}$")],
    start: Annotated[int, Query(ge=1)] = 1,
    end: Annotated[int, Query(ge=1)] = 34,
    period: Literal["ft", "fh", "sh"] = "ft",
    venue: Literal["all", "home", "away"] = "all",
    side: Literal["team", "opponent"] = "team",
):
    first_year, second_year = map(int, season.split("-"))
    if season < MINIMUM_SEASON or second_year != first_year + 1:
        raise HTTPException(422, "Choose a Bundesliga season from 2009/2010 onward.")
    if end < start:
        raise HTTPException(422, "The final matchday must be at or after the first matchday.")

    criteria = {"version": VERSION, "season": season, "matchday": {"$gte": start, "$lte": end}}
    teams = {}
    minutes_per_match = 90 if period == "ft" else 45
    try:
        for match in request.app.state.matches.find(criteria, {"_id": False, "records": True}):
            for row in match["records"]:
                if row["period"] != period or (venue != "all" and venue != row["venue"]):
                    continue
                team = teams.setdefault(row["teamId"], {"matches": 0, "metrics": {}})
                team["matches"] += 1
                if side == "team":
                    collect_passing(team, row.get("passing"), row["team"].get("passAttempts"), minutes_per_match, row.get("lineupMinutes"))
                for key, contribution in row[side].items():
                    metric = team["metrics"].setdefault(key, {"numerator": 0, "denominator": 0, "matches": 0})
                    metric["numerator"] += contribution["numerator"]
                    metric["denominator"] += contribution["denominator"]
                    metric["matches"] += 1
    except PyMongoError as error:
        raise HTTPException(503, "Tactical DNA statistics are temporarily unavailable.") from error

    return {
        "version": VERSION,
        "scope": {"season": season, "from": start, "to": end, "period": period, "venue": venue, "side": side},
        "teams": [
            {
                "teamId": team_id,
                "matches": team["matches"],
                "passing": present_passing(team.get("passing")),
                "metrics": {
                    key: {
                        "value": (
                            metric["numerator"] / metric["denominator"] * (100 if key in RATIO_METRICS else 1)
                            if metric["denominator"] > 0 else None
                        ),
                        "matches": metric["matches"],
                    }
                    for key, metric in team["metrics"].items()
                },
            }
            for team_id, team in sorted(teams.items())
        ]
    }


def collect_passing(team, event_summary, team_attempts, minutes, lineup_minutes):
    if event_summary is None:
        return
    summary = team.setdefault("passing", {
        "matches": 0, "usablePasses": 0, "rejectedPasses": 0,
        "direction": {}, "zones": {}, "players": {}, "finalThirdEntries": 0,
        "completeMatches": 0, "completeMinutes": 0, "progressiveAttempts": 0,
        "completeEntries": 0,
    })
    summary["matches"] += 1
    for key in ("usablePasses", "rejectedPasses", "finalThirdEntries"):
        summary[key] += event_summary[key]
    for group in ("direction", "zones"):
        for key, counts in event_summary[group].items():
            target = summary[group].setdefault(key, {"attempts": 0, "completed": 0, "knownOutcomes": 0})
            for name, value in counts.items():
                target[name] += value
    for player_id in set(event_summary.get("players", {})) | set(lineup_minutes or {}):
        player = event_summary.get("players", {}).get(player_id)
        target = summary["players"].setdefault(player_id, {
            "name": None, "attempts": 0, "completed": 0, "knownOutcomes": 0,
            "progressive": 0, "forward": 0, "entries": 0, "eventMatches": 0,
            "minutes": 0, "matchesWithMinutes": 0,
        })
        if player:
            if player["name"]:
                target["name"] = player["name"]
            target["eventMatches"] += 1
            for key in ("attempts", "completed", "knownOutcomes", "progressive", "forward", "entries"):
                target[key] += player[key]
        if lineup_minutes and player_id in lineup_minutes:
            target["minutes"] += lineup_minutes[player_id]
            target["matchesWithMinutes"] += 1
    # Nominal playing-time rates require event counts to match the imported
    # attempts and every counted attempt to have valid start/end coordinates.
    if (team_attempts and not event_summary["rejectedPasses"]
            and event_summary["usablePasses"] == team_attempts["numerator"]):
        summary["completeMatches"] += 1
        summary["completeMinutes"] += minutes
        summary["completeEntries"] += event_summary["finalThirdEntries"]
        summary["progressiveAttempts"] += event_summary["progressive"]["attempts"]


def present_passing(summary):
    if summary is None:
        return None
    complete_matches = summary["completeMatches"]
    complete_minutes = summary["completeMinutes"]
    return {
        **summary,
        "players": [
            {
                "id": int(player_id), **player,
                "minutes": player["minutes"] if player["matchesWithMinutes"] else None,
                "completion": player["completed"] / player["knownOutcomes"] * 100 if player["knownOutcomes"] else None,
            }
            for player_id, player in summary["players"].items() if player["eventMatches"]
        ],
        "finalThirdEntriesPerMatch": summary["completeEntries"] / complete_matches if complete_matches else None,
        "progressivePassesPer90": summary["progressiveAttempts"] / complete_minutes * 90 if complete_minutes else None,
    }
