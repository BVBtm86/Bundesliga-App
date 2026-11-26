import assert from "node:assert/strict";
import test from "node:test";
import { classifyTacticalPass, summarizeTacticalPassing, type ImportedPassEvent } from "./tactical-passing";

const pass: ImportedPassEvent = {
  game_id: 1910902, event_idx: 1, team_id: 44, player_id: 88, player: "Player 88", period: "FirstHalf",
  x: 45, y: 50, end_x: 68, end_y: 50, pass_completed: true
};

test("progression uses net distance to the opponent goal and a configurable threshold", () => {
  assert.deepEqual(classifyTacticalPass(pass), {
    direction: "forward", completed: true, originZone: 14, finalThirdEntry: true, progressive: true
  });
  assert.equal(classifyTacticalPass(pass, 30)?.progressive, false);
  assert.equal(classifyTacticalPass({ ...pass, end_x: 45, end_y: 48 })?.direction, "lateral");
  assert.equal(classifyTacticalPass({ ...pass, end_x: 40 })?.direction, "backward");
  assert.equal(classifyTacticalPass({ ...pass, end_x: 46, end_y: 0 })?.progressive, false);
});

test("pitch zones keep the right and top boundary within the grid and reject invalid coordinates", () => {
  assert.equal(classifyTacticalPass({ ...pass, x: 100, y: 100 })?.originZone, 23);
  assert.equal(classifyTacticalPass({ ...pass, end_x: null }), null);
  assert.equal(classifyTacticalPass({ ...pass, y: -0.1 }), null);
  assert.equal(classifyTacticalPass({ ...pass, x: Number.NaN }), null);
});

test("passing aggregates preserve unknown outcomes, deduplicate and exclude other teams and periods", () => {
  const summary = summarizeTacticalPassing([
    pass, pass,
    { ...pass, event_idx: 2, pass_completed: null },
    { ...pass, event_idx: 3, period: "SecondHalf", pass_completed: false },
    { ...pass, event_idx: 4, team_id: 42 },
    { ...pass, event_idx: 5, end_y: null }
  ], 44, "fh");
  assert.deepEqual(summary?.direction.forward, { attempts: 2, completed: 1, knownOutcomes: 1 });
  assert.equal(summary?.finalThirdEntries, 2);
  assert.equal(summary?.rejectedPasses, 1);
  assert.deepEqual(summary?.players[88], {
    name: "Player 88", attempts: 3, knownOutcomes: 2, completed: 2, progressive: 2, forward: 2, entries: 2
  });
  assert.equal(summarizeTacticalPassing([], 44, "ft"), null);
});
