import assert from "node:assert/strict";
import test from "node:test";
import { buildHistoricalPositions } from "./historical-positions";
import type { Match } from "./types";

const match = (id: number, homeId: number, awayId: number, homeGoals: number, awayGoals: number): Match => ({
  id, season: "1963-1964", date: "1963-08-24T14:30:00.000Z", week: 1, homeId, awayId, home: `Team ${homeId}`, away: `Team ${awayId}`,
  homeGoals, awayGoals, finished: true, status: "finished", venue: "", attendance: null,
});

test("historical positions use the configured two-points-for-a-win rule", () => {
  const matches = [
    match(1, 1, 2, 1, 0), match(2, 2, 1, 0, 0),
    match(3, 1, 3, 0, 1), match(4, 3, 1, 0, 0),
    match(5, 2, 3, 2, 0), match(6, 3, 2, 1, 0),
  ];
  const positions = buildHistoricalPositions(["1963-1964"], matches, [{
    season: "1963-1964", teamCount: 3, rules: { pointsForWin: 2, pointsForDraw: 1 }, standingsTiebreakers: ["points", "goal_ratio"],
  }]);
  assert.deepEqual(positions.map(row => [row.clubId, row.position]), [[3, 1], [1, 2], [2, 3]]);
  assert.deepEqual(positions.find(row => row.clubId === 3), { season: "1963-1964", clubId: 3, clubName: "Team 3", position: 1, participants: 3, status: "bundesliga", champion: true, points: 5, played: 4, won: 2, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 2, goalDifference: 0 });
  assert.equal(positions.every(row => row.participants === 3), true);
  assert.equal(positions.filter(row => row.champion).length, 1);
});

test("incomplete historical seasons are not silently presented as final standings", () => {
  const positions = buildHistoricalPositions(["1963-1964"], [match(1, 1, 2, 1, 0)], [{ season: "1963-1964", teamCount: 2 }]);
  assert.deepEqual(positions, []);
});
