export function leagueIndex(value: number | null | undefined, average: number | null | undefined) {
  if (value == null || average == null || !Number.isFinite(value) || !Number.isFinite(average) || average <= 0 || value < 0) return null;
  return 100 * (value / average);
}

export function relativeDeviation(value: number | null | undefined, baseline: number | null | undefined) {
  if (value == null || baseline == null || !Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return null;
  const result = 100 * ((value - baseline) / baseline);
  return Number.isFinite(result) ? result : null;
}

export function symmetricDeviationLimit(values: readonly (number | null)[]) {
  return Math.max(25, Math.ceil(Math.max(0, ...values.map(value => Math.abs(value ?? 0))) / 25) * 25);
}
