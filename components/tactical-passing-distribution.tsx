"use client";

import { useState } from "react";
import { PASS_GRID, PASS_PROGRESSION_METRES, type PassCounts } from "@/lib/tactical-passing";
import TacticalPassingPlayers, { type PassingPlayer } from "./tactical-passing-players";
import TacticalPitch from "./tactical-pitch";

export type PassingDistribution = {
  matches: number;
  players: PassingPlayer[];
  usablePasses: number;
  rejectedPasses: number;
  completeMatches: number;
  direction: Record<"forward" | "backward" | "lateral", PassCounts>;
  zones: Partial<Record<number, PassCounts>>;
  finalThirdEntriesPerMatch: number | null;
  progressivePassesPer90: number | null;
};
type Mode = "attempts" | "completed" | "rate";

const directions = [["forward", "Forward"], ["backward", "Backward"], ["lateral", "Lateral"]] as const;

function value(counts: PassCounts, mode: Mode): number | null {
  if (mode === "attempts") return counts.attempts;
  if (mode === "completed") return counts.knownOutcomes ? counts.completed : null;
  return counts.knownOutcomes ? counts.completed / counts.knownOutcomes * 100 : null;
}

export default function TacticalPassingDistribution({ passing, locale }: { passing: PassingDistribution; locale: string }) {
  const [mode, setMode] = useState<Mode>("attempts");
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const format = (raw: number | null, suffix = "") => raw === null ? "—" :
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(raw) + suffix;
  const max = mode === "rate" ? 100 : Math.max(1, ...directions.map(([key]) => value(passing.direction[key], mode) ?? 0));
  const zone = selectedZone === null ? null : passing.zones[selectedZone];
  return <div className="tactical-passing-detail">
    <div className="team-analysis-advanced-grid">
      <article className="panel team-analysis-finding">
        <strong>Final-third entries per match</strong>
        <span>{format(passing.finalThirdEntriesPerMatch)}</span>
        <p>Passes crossing into the attacking third from another zone. {passing.completeMatches} completed matches with full spatial pass coverage.</p>
      </article>
      <article className="panel team-analysis-finding">
        <strong>Progressive pass attempts per 90</strong>
        <span>{format(passing.progressivePassesPer90)}</span>
        <p>Passes that reduce distance to the centre of the opponent’s goal by at least {PASS_PROGRESSION_METRES} m. Rates use nominal playing time and {passing.completeMatches} completed matches with full spatial pass coverage.</p>
      </article>
    </div>
    <section className="panel team-analysis-advanced-block">
      <div className="panel-heading">
        <div>
          <h3>Passing direction</h3>
          <p>{passing.matches} completed matches. Includes {passing.usablePasses} passes with valid coordinates. {passing.rejectedPasses} had invalid or missing coordinates.</p>
        </div>
        <label>View <select value={mode} onChange={event => setMode(event.target.value as Mode)}>
          <option value="attempts">Attempted passes</option>
          <option value="completed">Successful passes</option>
          <option value="rate">Completion percentage</option>
        </select></label>
      </div>
      <div className="team-analysis-evolution-list">
        {directions.map(([key, label]) => {
          const count = value(passing.direction[key], mode);
          return <div key={key}><span>{label}</span><b>{format(count, mode === "rate" ? "%" : "")}</b><small />
            <i aria-hidden="true"><em style={{ width: `${(count ?? 0) / max * 100}%` }} /></i>
          </div>;
        })}
      </div>
      <p>Directions use the change in attacking-axis position. Completion percentages use attempts with a recorded outcome.</p>
    </section>
    <section className="panel team-analysis-advanced-block">
      <div className="panel-heading"><div>
        <h3>Passing accuracy by pitch zone</h3>
        <p>Pass origins on a six-by-four grid. Attacking direction points right. Select a zone to see its attempts, completions, and accuracy.</p>
      </div></div>
      <div className="tactical-passing-pitch">
        <TacticalPitch />
        <div className="tactical-passing-zones" style={{ gridTemplateColumns: `repeat(${PASS_GRID.columns}, 1fr)` }}>
          {Array.from({ length: PASS_GRID.columns * PASS_GRID.rows }, (_, index) => {
            // Match Report displays provider y=100 at the top of a home-oriented pitch.
            const key = (PASS_GRID.rows - 1 - Math.floor(index / PASS_GRID.columns)) * PASS_GRID.columns + index % PASS_GRID.columns;
            const counts = passing.zones[key];
            return <button type="button" key={key} aria-pressed={selectedZone === key}
              aria-label={`Zone ${index + 1}, ${counts?.attempts ?? 0} attempts`} onClick={() => setSelectedZone(key)}>
              {counts ? format(value(counts, "rate"), "%") : "—"}
            </button>;
          })}
        </div>
      </div>
      {selectedZone !== null && <p role="status">
        {zone ? `${zone.attempts} attempts · ${format(value(zone, "completed"))} completed · ${format(value(zone, "rate"), "%")} completion · ${zone.knownOutcomes} recorded outcomes`
          : "No pass origins were recorded in this zone."}
      </p>}
    </section>
    {passing.players.length > 0 && <TacticalPassingPlayers players={passing.players} locale={locale} />}
  </div>;
}
