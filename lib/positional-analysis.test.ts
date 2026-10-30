import test from "node:test";
import assert from "node:assert/strict";
import { attackingChannel, attackingChannelDisplayOrder, physicalPitchThird, teamTerritoryThird } from "./positional-analysis";

test("attacking channels use a consistent team-relative lateral perspective", () => {
  assert.equal(attackingChannel(10), 2);
  assert.equal(attackingChannel(90), 0);
});

test("channel cards follow the team's attacking direction", () => {
  assert.deepEqual(attackingChannelDisplayOrder(true), [0, 1, 2]);
  assert.deepEqual(attackingChannelDisplayOrder(false), [2, 1, 0]);
});

test("physical thirds classify shared display coordinates without a second flip", () => {
  assert.equal(physicalPitchThird(0), 0);
  assert.equal(physicalPitchThird(50), 1);
  assert.equal(physicalPitchThird(100), 2);
});

test("team-relative thirds can be derived once from physical display coordinates", () => {
  assert.equal(teamTerritoryThird(20, true), 0);
  assert.equal(teamTerritoryThird(20, false), 2);
  assert.equal(teamTerritoryThird(80, false), 0);
});
