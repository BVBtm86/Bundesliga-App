# Bundesliga Intelligence

A responsive Next.js analytics dashboard backed by the separate Bundesliga MongoDB instance.

The app provides modern and historical Bundesliga analysis using imported WhoScored data.

## Run

Use the installed Node.js 24 environment and the existing local MongoDB container.

```powershell
docker start bundesliga-mongo
npm install
npm run dev
```

Open http://127.0.0.1:3000. The app defaults to MongoDB at
`mongodb://127.0.0.1:27018/`, database `WhoScored`.
Copy `.env.example` to `.env.local` to change this. Database access stays server-side and read-only.
Refresh the dashboard as imports progress.

## Current features

- Season and matchday browsing with club search.
- All-club season standings with MP, W, D, L, goal difference and points; the Teams tab adds GF, GA and form.
- Compact club histories containing every imported played fixture in the chosen season phase and venue.
- Goals, goals per game, reported attendance and W-D-L summaries.

## Additional features

- Historical season summaries, achievements, and European qualification history.
- Historical competition ordering including European Cup, Champions League, Cup Winners' Cup, Fairs Cup, UEFA Cup, Europa League, and Conference League.
- Match reports with lineups, player statistics, events, shots, and formations.
- Team comparisons, performance charts, and sequence visualizations.
- Team and stadium logos read from the MongoDB `available_teams` collection.
- English, German, Spanish, and Romanian interface translations.
- Responsive desktop and mobile layouts.
- Full-width scoring trends and goal-distribution charts.
- Stadium icons, venue names, attendance and match-stat comparisons.
- No predictions, odds analysis or over/under panels.

## Filters and meanings

Match period offers full match, first/second half, stored 15-minute windows (1-15, 16-30, 31-45,
46-60, 61-75, 76-90) and stored 30-minute windows (1-30, 31-60, 61-90).
These use the imported aggregation boundaries, not inferred arbitrary time ranges.

Season phase selects the whole season, matchdays 1-17 or matchdays 18-34.
The matchday selector stays within that phase. Club histories use the full selected phase.

Venue selects all, home or away records. In league goal summaries it selects total, home-team
or away-team goals. In club histories it filters fixtures by that club's home/away role;
combined match-goal totals and the club's own W-D-L are shown.

Standings cover the complete selected season phase, independent of the fixture-browser matchday.
All clubs stay listed. Non-full-time tables describe results inside that period and are labelled
accordingly; their points are not official full-time league points.
The chart covers the selected season phase.

Missing period scores stay unavailable and are excluded from goal averages and period standings.
Attendance is always a full-match figure; averages include reported zero attendance and exclude
unknown values. Coverage counts are shown.

## Checks

```powershell
npm test
npm run typecheck
npm run build
```

With the app running on port 3000 and Google Chrome installed:

```powershell
npm run test:e2e
```

Browser checks cover desktop and phone screen sizes. To view the app on a phone on your private
network, run `npm run dev -- --hostname 0.0.0.0` and browse to your PC's LAN IP on port 3000.

## Assets

Club logos and stadium icons are read from the `available_teams` MongoDB collection.
The app does not require copied logo or stadium asset folders in Git.
The Bundesliga logo is sourced from https://www.bundesliga.com/assets/logo/bundesliga_neg.svg
(DFL / Bundesliga). The compact emblem uses the same artwork with its viewBox limited to the player mark.


Upcoming and results: importing the full schedule retains unplayed fixtures. The Upcoming page uses the earliest unplayed fixture date and is available only when unfinished fixtures exist. Results defaults to the latest played fixture date. Both views allow choosing another matchday; refreshing retains a valid manual selection. Archived seasons open Results. Scheduled fixtures do not contribute to standings or goal summaries.


Pages now have their own URLs: /overview, /upcoming, /results, /standings, /teams and /goals. Upcoming is available only when the selected season contains unfinished fixtures; archived-season visits fall back to Results. Results opens on the latest completed matchday. Standings has independent inclusive matchday-range filters, combined with season phase, venue and period filters, and shows all season clubs unless a club search is entered. Navigation retains the selected season and shared filters.

## Tactical DNA descriptive analytics

The first implementation serves passing summaries from the derived
`game_tactical_dna_app` collection. Match records are keyed by fixture and
calculation version and retain separate team/opponent contributions for full
matches and each half. The [feature registry](lib/tactical-dna.ts) documents each
metric's source fields, units, formula, version, and coverage rule. A paired
ratio uses only matches where both source counts are recorded. Its denominator
is the sum of attempts, and a zero denominator returns an unavailable value.

With Python 3.11 or newer, set up and run the local read service from the app
root. The Next.js route connects to port 8000 by default. Set
`TACTICAL_DNA_API_ORIGIN` in the Next.js environment if using another address.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn --app-dir backend tactical_dna_api:app --host 127.0.0.1 --port 8000
```

Both the service and the builder use `MONGODB_URI` and `MONGODB_DB`, with the
same local defaults as the dashboard. Run the builder after finished matches
are imported. Its default is a dry run. `--write` writes to the Tactical DNA
collection. Re-run an individual fixture with `--match=<game_id>` after late
or corrected source statistics arrive.

```sh
node --env-file-if-exists=.env.local --import tsx scripts/build-tactical-dna.ts --write
node --env-file-if-exists=.env.local --import tsx scripts/build-tactical-dna.ts --write --match=1910902
node --import tsx --test lib/tactical-dna.test.ts
node --import tsx scripts/check-tactical-dna.ts
node scripts/check-tactical-dna-api.mjs
```

`GET /tactical-dna/seasons` returns materialized coverage. The metrics endpoint,
`GET /tactical-dna/metrics`, accepts `season`, `start`, `end`, `period`,
`venue`, and `side`. It returns match counts for the scope and for each
reported metric. The last season may be in progress.
