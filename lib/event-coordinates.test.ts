import test from "node:test";
import assert from "node:assert/strict";
import { oriented } from "./event-coordinates";

const event = { id: 1, teamId: 10, x: 20, y: 15, endX: 80, endY: 35, goal: false, onTarget: false, blocked: false };

test("inverts Y for home coordinates and preserves home X", () => {
  assert.deepEqual(oriented(event, 10), { x: 20, y: 85, endX: 80, endY: 65 });
});

test("flips away X while preserving away Y for both pass endpoints", () => {
  assert.deepEqual(oriented({ ...event, teamId: 20 }, 10), { x: 80, y: 15, endX: 20, endY: 35 });
});

test("keeps valid zero coordinates and does not mutate raw event data", () => {
  const raw = { ...event, teamId: 20, x: 0, y: 0, endX: 0, endY: 0 };
  const snapshot = { ...raw };
  assert.deepEqual(oriented(raw, 10), { x: 100, y: 0, endX: 100, endY: 0 });
  assert.deepEqual(raw, snapshot);
});
