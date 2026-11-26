import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { Dashboard } from "../lib/types";
import { aggregateTacticalScope, buildTacticalTeamMatches, TACTICAL_FEATURES, type TacticalFeature } from "../lib/tactical-dna";
import { ratioParts } from "../components/team-analysis-value";

async function main() {
  const origin = process.env.TACTICAL_DNA_APP_ORIGIN ?? "http://127.0.0.1:3000";
  for (const season of ["2009-2010", "2025-2026"]) {
    const response = await fetch(new URL(`/api/dashboard?teamAnalysis=1&season=${season}`, origin));
    assert.equal(response.status, 200);
    const dashboard: Dashboard = await response.json();
    const statsByMatch = new Map<number, Dashboard["stats"]>();
    for (const row of dashboard.stats) {
      const group = statsByMatch.get(row.gameId) ?? [];
      group.push(row);
      statsByMatch.set(row.gameId, group);
    }
    const fixtures = dashboard.matches.filter(match => match.finished && match.homeGoals !== null && match.awayGoals !== null);
    const scope = { season, from: 1, to: 34, venue: "all", period: "ft" } as const;
    const started = performance.now();
    const records = fixtures.flatMap(match => buildTacticalTeamMatches(match, statsByMatch.get(match.id) ?? []));
    const metricKeys = Object.keys(TACTICAL_FEATURES) as TacticalFeature[];
    for (const metric of metricKeys) aggregateTacticalScope(records, scope, metric);
    const engineMs = performance.now() - started;
    const teamCompletion = aggregateTacticalScope(records, scope, "passCompletion");
    for (const team of dashboard.teams) {
      const paired = fixtures.filter(match => match.homeId === team.id || match.awayId === team.id)
        .flatMap(match => {
          const stats = statsByMatch.get(match.id)?.find(row => row.teamId === team.id);
          const parts = ratioParts(stats?.periods?.ft, undefined, "passAccuracy");
          return parts ? [parts] : [];
        });
      const attempts = paired.reduce((sum, row) => sum + row.denominator, 0);
      const completions = paired.reduce((sum, row) => sum + row.numerator, 0);
      const expected = attempts ? completions / attempts * 100 : null;
      assert.equal(teamCompletion.get(team.id)?.value ?? null, expected, `${season}, team ${team.id}: pass completion`);
    }
    if (season === "2025-2026") {
      const match = fixtures.find(candidate => candidate.id === 1910902);
      assert.ok(match, "Regression match must be available");
      assert.equal(aggregateTacticalScope(records, { ...scope, from: match.week }, "passAttempts").get(44)?.value, 533);
    }
    console.log(JSON.stringify({ season, fixtures: fixtures.length, records: records.length, metrics: metricKeys.length, teamsWithPassCoverage: [...teamCompletion.values()].filter(metric => metric.value !== null).length, engineMs: Number(engineMs.toFixed(1)) }));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
