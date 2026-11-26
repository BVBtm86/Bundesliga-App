import assert from "node:assert/strict";
const origin = process.env.TACTICAL_DNA_API_ORIGIN ?? "http://127.0.0.1:8000";
const get = async (path) => {
  const reply = await fetch(origin + path);
  assert.equal(reply.status, 200);
  return reply.json();
};
const { seasons } = await get("/tactical-dna/seasons");
assert.equal(seasons.at(-1), "2009-2010");
assert.deepEqual(seasons, [...seasons].sort().reverse());
const fixturePath = "/tactical-dna/metrics?season=2025-2026&start=34&end=34&venue=away";
const response = await get(fixturePath);
const dortmund = response.teams.find(row => row.teamId === 44);
assert.deepEqual(dortmund.metrics.passAttempts, { value: 533, matches: 1 });
assert.deepEqual(dortmund.metrics.passCompletion, { value: 442 / 533 * 100, matches: 1 });
assert.equal(dortmund.passing.usablePasses + dortmund.passing.rejectedPasses, 533);
assert.equal(Object.values(dortmund.passing.direction).reduce((sum, direction) => sum + direction.attempts, 0), dortmund.passing.usablePasses);
assert.equal(Object.values(dortmund.passing.zones).reduce((sum, zone) => sum + zone.attempts, 0), dortmund.passing.usablePasses);
assert.ok(dortmund.passing.players.length > 0);
assert.equal(dortmund.passing.players.reduce((sum, player) => sum + player.attempts, 0), 533);
assert.ok(dortmund.passing.players.some(player => player.minutes !== null));
const opposite = await get(fixturePath + "&side=opponent");
assert.equal(opposite.teams.find(row => row.teamId === 44).metrics.passAttempts.value, 561);
const half = await get("/tactical-dna/metrics?season=2009-2010&period=fh");
assert.equal(half.teams.length, 18);
assert.ok(half.teams.flatMap(team => team.passing?.players ?? []).every(player => player.minutes === null));
for (const suffix of ["season=2008-2009", "season=2025-2026&start=10&end=1"]) {
  assert.equal((await fetch(origin + "/tactical-dna/metrics?" + suffix)).status, 422);
}
const timings = [];
for (let index = 0; index < 7; index++) {
  const started = performance.now();
  const full = await get("/tactical-dna/metrics?season=2025-2026");
  assert.equal(full.teams.length, 18);
  timings.push(Math.round(performance.now() - started));
}
console.log(JSON.stringify({ seasons: seasons.length, first: seasons.at(-1), last: seasons[0], fullSeasonResponseMs: timings }));
