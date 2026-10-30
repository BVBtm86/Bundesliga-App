export type NetworkEvent = {
  id: number;
  teamId: number;
  playerId?: number;
  recipientId?: number;
  category?: string;
  minute?: number;
  second?: number;
  period?: number | string;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  passSuccessful?: boolean;
};

export type PassingNetworkEdge = {
  from: number;
  to: number;
  count: number;
  confirmed: number;
  estimated: number;
};

export type ResolvedPassAction = { from:number; to:number; fromX?:number; fromY?:number; toX?:number; toY?:number; confirmed:boolean };

export type PassingNetworkResult = {
  edges: PassingNetworkEdge[];
  totalCompleted: number;
  resolvedCompleted: number;
  unresolvedCompleted: number;
  resolvedActions: ResolvedPassAction[];
};

const valid = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const seconds = (event: NetworkEvent) =>
  typeof event.minute === "number" ? event.minute * 60 + (event.second ?? 0) : null;

/**
 * Resolves only conservative next-action relationships. The source data has no
 * recipient field, so inferred edges are intentionally marked estimated. Explicit source recipients, when present, are marked confirmed.
 */
export function buildPassingNetwork(events: NetworkEvent[], teamId: number): PassingNetworkResult {
  const ordered = [...events].sort((a, b) => a.id - b.id);
  const passes = ordered.filter(
    event => event.teamId === teamId && event.category === "passing" &&
      event.passSuccessful === true && valid(event.playerId),
  );
  const edges = new Map<string, PassingNetworkEdge>();
  let resolvedCompleted = 0;
  const resolvedActions: ResolvedPassAction[] = [];

  for (const pass of passes) {
    const passTime = seconds(pass);
    let recipient: NetworkEvent | undefined;
    let relationshipConfirmed = false;
    if (valid(pass.recipientId)) {
      recipient = ordered.find(candidate => candidate.teamId === teamId && candidate.playerId === pass.recipientId);
      relationshipConfirmed = Boolean(recipient);
    }
    if (!recipient) for (const candidate of ordered) {
      if (candidate.id <= pass.id) continue;
      if (candidate.period !== pass.period) break;
      if (candidate.teamId !== teamId) break;
      if (!valid(candidate.playerId) || candidate.playerId === pass.playerId) continue;
      if (!valid(candidate.x) || !valid(candidate.y)) continue;
      const dt = passTime === null || seconds(candidate) === null ? 0 : (seconds(candidate)! - passTime);
      if (dt < 0 || dt > 10) break;
      if (!valid(pass.endX) || !valid(pass.endY)) continue;
      const distance = Math.hypot(candidate.x! - pass.endX!, candidate.y! - pass.endY!);
      if (distance <= 12) {
        recipient = candidate;
        break;
      }
      if (dt > 5) break;
    }
    if (!recipient) continue;
    resolvedCompleted++;
    const recipientX = valid(recipient.x) ? recipient.x : pass.endX;
    const recipientY = valid(recipient.y) ? recipient.y : pass.endY;
    resolvedActions.push({from:pass.playerId!,to:recipient.playerId!,fromX:pass.x,fromY:pass.y,toX:recipientX,toY:recipientY,confirmed:relationshipConfirmed});
    const key = `${pass.playerId}:${recipient.playerId}`;
    const edge = edges.get(key) ?? { from: pass.playerId!, to: recipient.playerId!, count: 0, confirmed: 0, estimated: 0 };
    edge.count++;
    if (relationshipConfirmed) edge.confirmed++; else edge.estimated++;
    edges.set(key, edge);
  }

  return {
    edges: [...edges.values()],
    totalCompleted: passes.length,
    resolvedCompleted,
    unresolvedCompleted: passes.length - resolvedCompleted,
    resolvedActions,
  };
}
