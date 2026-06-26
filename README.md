# Bundesliga App

Professional Bundesliga analytics app built from the WhoScored MongoDB dataset.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind, ECharts/D3-ready
- Backend: FastAPI, Python
- Database: MongoDB

## Current Focus

The current slice is the Bundesliga standings page:

- MongoDB connection
- FastAPI standings endpoint
- Next.js standings page
- Latest-season detection
- Total, home, and away standings
- Hinrunde/Ruckrunde filters
- Match-minute table filters
- Team logos from `available_teams`

## Data Source

Local MongoDB:

- Database: `WhoScored`
- Main collections:
  - `game_schedule`
  - `game_team_stats`
  - `available_teams`

## Run The App In Development

Use one command from the project root:

```bash
python run_dev.py
```

Then open:

```text
http://127.0.0.1:3000/standings
```

This starts both servers:

```text
Backend:  http://127.0.0.1:8001
Frontend: http://127.0.0.1:3000/standings
```

Press `Ctrl+C` in the terminal to stop both.

## Run The Backend API Only

```bash
/opt/homebrew/Caskroom/miniconda/base/envs/sports_analytics/bin/python -m pip install -r backend/requirements.txt
/opt/homebrew/Caskroom/miniconda/base/envs/sports_analytics/bin/python app.py
```

Backend URL:

```text
http://127.0.0.1:8001
```

Standings endpoint:

```text
http://127.0.0.1:8001/api/standings
```

In development, FastAPI and Next.js run as two processes. In the browser, use the Next.js app:

```text
http://127.0.0.1:3000/standings
```

Next.js proxies `/api/*` requests to FastAPI, so the frontend can call:

```text
http://127.0.0.1:3000/api/standings
```

## Run The Next.js Frontend Only

```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1
```

Then open:

```text
http://localhost:3000/standings
```
