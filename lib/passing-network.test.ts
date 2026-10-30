import test from "node:test";
import assert from "node:assert/strict";
import { buildPassingNetwork } from "./passing-network";

test("resolves a conservative next same-team receiver and marks it estimated", () => {
  const result = buildPassingNetwork([
    { id: 1, teamId: 1, playerId: 10, category: "passing", period: "FirstHalf", minute: 1, second: 0, x: 20, y: 20, endX: 30, endY: 30, passSuccessful: true },
    { id: 2, teamId: 1, playerId: 11, category: "touches", period: "FirstHalf", minute: 1, second: 2, x: 31, y: 29 },
  ], 1);
  assert.deepEqual(result.edges, [{ from: 10, to: 11, count: 1, confirmed: 0, estimated: 1 }]);
  assert.equal(result.resolvedCompleted, 1);
  assert.deepEqual(result.resolvedActions, [{ from: 10, to: 11, fromX: 20, fromY: 20, toX: 31, toY: 29, confirmed: false }]);
});

test("does not infer through an intervening opponent event or for unsuccessful passes", () => {
  const result = buildPassingNetwork([
    { id: 1, teamId: 1, playerId: 10, category: "passing", period: "FirstHalf", minute: 1, second: 0, endX: 30, endY: 30, passSuccessful: true },
    { id: 2, teamId: 2, playerId: 20, category: "touches", period: "FirstHalf", minute: 1, second: 1, x: 30, y: 30 },
    { id: 3, teamId: 1, playerId: 11, category: "touches", period: "FirstHalf", minute: 1, second: 2, x: 30, y: 30 },
    { id: 4, teamId: 1, playerId: 10, category: "passing", period: "FirstHalf", minute: 1, second: 4, endX: 40, endY: 40, passSuccessful: false },
  ], 1);
  assert.equal(result.resolvedCompleted, 0);
  assert.equal(result.edges.length, 0);
});


test("prefers explicit recipient relationships and marks them confirmed", () => {
  const result = buildPassingNetwork([
    { id: 1, teamId: 1, playerId: 10, recipientId: 11, category: "passing", minute: 1, endX: 40, endY: 40, passSuccessful: true },
    { id: 2, teamId: 1, playerId: 11, category: "touches", minute: 1, x: 80, y: 80 },
  ], 1);
  assert.deepEqual(result.edges, [{ from: 10, to: 11, count: 1, confirmed: 1, estimated: 0 }]);
});
