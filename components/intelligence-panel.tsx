import type { ReactNode } from "react";

export type IntelligenceStatus = "available" | "unavailable" | "stale" | "error";
export type IntelligenceEvidence = { id: string; label: string; value?: number | string; unit?: string };
export type IntelligenceSection = { id: "match-overview" | "tactical-matchup" | "key-factors" | "prediction-explained"; title: string; narrative: string; evidence?: IntelligenceEvidence[] };
export type IntelligencePayload = {
  context: "match-preview" | "match-report" | "team-analysis" | "player-analysis";
  entityIds: { matchId?: number; teamId?: number; playerId?: number };
  dataCutoff: string;
  pipelineVersion: string;
  generatedAt: string;
  status: IntelligenceStatus;
  sections: IntelligenceSection[];
  coverageLimitations?: string[];
};

export default function IntelligencePanel({ title, message, icon }: { title: string; message: string; icon?: ReactNode }) {
  return <section className="intelligence-panel" aria-label={title}>
    <div className="intelligence-unavailable-icon" aria-hidden="true">{icon}</div>
    <span className="eyebrow">{title.toUpperCase()}</span>
    <h3>{title}</h3>
    <p>{message}</p>
  </section>;
}
