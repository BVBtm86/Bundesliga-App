export type SpatialCoordinateEvent = {
  teamId: number;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
};

/**
 * Converts raw WhoScored coordinates to the Event Explorer display space.
 *
 * The verified convention is deliberately asymmetric: home Y is inverted,
 * away X is inverted, and away Y is preserved. Both pass endpoints use the
 * same transform. Raw database coordinates are never mutated.
 */
export function oriented(event: SpatialCoordinateEvent, homeId: number) {
  const away = event.teamId !== homeId;
  const x = (value?: number) =>
    typeof value === "number" ? (away ? 100 - value : value) : undefined;
  const y = (value?: number) =>
    typeof value === "number" ? (away ? value : 100 - value) : undefined;

  return {
    x: x(event.x),
    y: y(event.y),
    endX: x(event.endX),
    endY: y(event.endY),
  };
}
