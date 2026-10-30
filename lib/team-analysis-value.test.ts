import assert from "node:assert/strict";
import test from "node:test";
import { toPercent, weightedPercent } from "../components/team-analysis-value";

test("percentage normalization converts fractions once and preserves percentages", () => {
  assert.equal(toPercent(0.532), 53.2);
  assert.equal(toPercent(53.2), 53.2);
  assert.equal(toPercent(0), 0);
  assert.equal(toPercent(null), null);
});

test("weighted percentage uses aggregate numerator and denominator", () => {
  assert.equal(weightedPercent(80, 100), 80);
  assert.equal(weightedPercent(1, 0), null);
  assert.equal(weightedPercent(null, 10), null);
});
