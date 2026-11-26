import assert from "node:assert/strict";
import test from "node:test";
import { aggregateTacticalScope, buildTacticalTeamMatches, tacticalLeaguePosition, type TacticalScope } from "./tactical-dna";
import type { Match, MatchStats, PeriodStats } from "./types";

const scope: TacticalScope = { season: "2025-2026", from: 1, to: 34, venue: "all", period: "ft" };

function fixture(id: number, week: number, season = scope.season): Match {
  return {
    id, season, week, date: "", venue: "", homeId: 42, awayId: 44,
    home: "Frankfurt", away: "Dortmund", homeGoals: 0, awayGoals: 2,
    finished: true, status: "finished", attendance: null
  };
}

function stats(gameId: number, teamId: number, ft: Partial<PeriodStats>, fh?: Partial<PeriodStats>): MatchStats {
  const base = { goals: null, shots: null, onTarget: null, possession: null, passes: null, passCompletion: null };
  return {
    ...base, gameId, teamId,
    periods: { ft: { ...base, ...ft }, ...(fh ? { fh: { ...base, ...fh } } : {}) }
  };
}

test("match 1910902 agrees with the imported passing figures used by Performance", () => {
  // These fixture values come from the two game_team_stats_app full-time records.
  const match = fixture(1910902, 34);
  const records = buildTacticalTeamMatches(match, [
    stats(match.id, 42, { passes: 561, completedPasses: 471, forwardPasses: 329 }),
    stats(match.id, 44, { passes: 533, completedPasses: 442, forwardPasses: 324 })
  ]);
  assert.deepEqual(aggregateTacticalScope(records, scope, "passAttempts").get(44), { value: 533, matches: 1 });
  assert.deepEqual(aggregateTacticalScope(records, scope, "passCompletion").get(44), { value: 442 / 533 * 100, matches: 1 });
  assert.deepEqual(aggregateTacticalScope(records, scope, "passCompletion", "opponent").get(44), { value: 471 / 561 * 100, matches: 1 });
});

test("ratios use paired counts and filters apply before aggregation", () => {
  const first = buildTacticalTeamMatches(fixture(1, 12), [
    stats(1, 42, { passes: 100, completedPasses: 90 }, { passes: 40, completedPasses: 30 })
  ]);
  const second = buildTacticalTeamMatches(fixture(2, 13), [
    stats(2, 42, { passes: 20, completedPasses: 0 })
  ]);
  const incomplete = buildTacticalTeamMatches(fixture(3, 14), [stats(3, 42, { passes: 500 })]);
  const otherSeason = buildTacticalTeamMatches(fixture(4, 13, "2024-2025"), [stats(4, 42, { passes: 500, completedPasses: 500 })]);
  const records = [...first, ...first, ...second, ...incomplete, ...otherSeason];
  assert.deepEqual(aggregateTacticalScope(records, scope, "passCompletion").get(42), { value: 75, matches: 2 });
  assert.deepEqual(aggregateTacticalScope(records, { ...scope, from: 13, to: 14 }, "passCompletion").get(42), { value: 0, matches: 1 });
  assert.deepEqual(aggregateTacticalScope(records, { ...scope, period: "fh", venue: "home" }, "passCompletion").get(42), { value: 75, matches: 1 });
  assert.equal(aggregateTacticalScope(records, { ...scope, period: "fh", venue: "away" }, "passCompletion").has(42), false);
  assert.deepEqual(aggregateTacticalScope(records, { ...scope, period: "sh" }, "passCompletion").get(42), { value: null, matches: 0 });
});

test("pre-cutoff and unfinished matches produce no records", () => {
  assert.deepEqual(buildTacticalTeamMatches(fixture(1, 1, "2008-2009"), []), []);
  assert.deepEqual(buildTacticalTeamMatches({ ...fixture(1, 1), finished: false }, []), []);
  assert.equal(buildTacticalTeamMatches(fixture(1, 1, "2009-2010"), []).length, 6);
});

test("league positions share ranks on ties and exclude missing values", () => {
  const metrics = new Map([
    [1, { value: 70, matches: 2 }], [2, { value: 50, matches: 2 }],
    [3, { value: 50, matches: 1 }], [4, { value: null, matches: 0 }]
  ]);
  assert.deepEqual(tacticalLeaguePosition(metrics, 2), { average: 170 / 3, rank: 2, percentile: 1 / 3 * 100, eligibleTeams: 3 });
  assert.equal(tacticalLeaguePosition(metrics, 4).rank, null);
});
