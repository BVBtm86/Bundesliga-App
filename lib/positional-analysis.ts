const clampZone = (value: number) => Math.min(2, Math.max(0, Math.floor(value / 100 * 3)));

/** Classifies a coordinate that is already in the shared physical pitch space. */
export function physicalPitchThird(displayX: number) {
  return clampZone(displayX);
}

/** Team-relative attacking channel; raw lateral coordinates are inverted consistently. */
export function attackingChannel(rawY: number) {
  return clampZone(100 - rawY);
}

/** Display order for lateral channels, from the top of a pitch to the bottom. */
export function attackingChannelDisplayOrder(attacksLeftToRight: boolean): [number, number, number] {
  return attacksLeftToRight ? [0, 1, 2] : [2, 1, 0];
}

/** Team-relative third, with each team attacking left to right. */
export function teamTerritoryThird(rawX: number, isHome: boolean) {
  const physical = physicalPitchThird(rawX);
  return isHome ? physical : 2 - physical;
}
