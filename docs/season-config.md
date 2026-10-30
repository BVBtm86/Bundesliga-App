# `season_config`

`season_config` is the single source for season rules, data coverage and verified historical outcomes. The initialization command is idempotent:

```bash
npm run ensure:season-config
```

It creates missing season documents with `$setOnInsert` and never overwrites manually verified summaries.

```json
{
  "competition": "Bundesliga",
  "season": "1994-1995",
  "start_year": 1994,
  "end_year": 1995,
  "team_count": 18,
  "matchdays": 34,
  "rules": { "pointsForWin": 2, "pointsForDraw": 1 },
  "standings_tiebreakers": ["points", "goal_ratio"],
  "data_availability": {
    "historical": true,
    "modern": false,
    "supportedFeatures": ["standings", "season_summary"]
  },
  "summary": {
    "championTeamId": 123,
    "outcomes": [
      {
        "type": "qualification",
        "competitionId": "uefa_cup",
        "label": "UEFA Cup",
        "teamIds": [123, 456]
      },
      {
        "type": "relegation_playoff",
        "competitionId": "bundesliga_relegation_playoff",
        "label": "Relegation playoff",
        "teamIds": [789]
      },
      { "type": "relegated", "label": "Relegated", "teamIds": [321] },
      { "type": "promoted", "label": "Promoted", "teamIds": [654] }
    ]
  }
}
```

The dashboard API reads these records and exposes them as typed `seasonConfigs`; European qualification is rendered only when an explicit classification exists.

`standings_tiebreakers` is an ordered list consumed by the shared in-memory ranking engine. Supported values include `points`, `goal_ratio`, `goal_difference`, `goals_scored`, `head_to_head_points`, `head_to_head_results`, `head_to_head_goal_difference`, `head_to_head_away_goals`, `away_goals_scored`, and `playoff`. Head-to-head values are calculated from a mini-table containing only the currently tied clubs. A final `playoff` rule leaves the group marked `playoff_required` until an actual result is available.
