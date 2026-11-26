"use client";

import { useState } from "react";
import type { PlayerPassing } from "@/lib/tactical-passing";

type PassingPlayer = PlayerPassing & {
  id: number;
  completion: number | null;
  minutes: number | null;
  eventMatches: number;
  matchesWithMinutes: number;
};

const columns = [
  ["attempts", "Attempts"], ["completed", "Completed"], ["completion", "Completion"],
  ["progressive", "Progressive"], ["forward", "Forward"], ["entries", "Final-third entries"],
  ["minutes", "Minutes"]
] as const;

export default function TacticalPassingPlayers({ players, locale }: { players: PassingPlayer[]; locale: string }) {
  const [sort, setSort] = useState<{ key: typeof columns[number][0]; descending: boolean }>({ key: "attempts", descending: true });
  const metric = (player: PassingPlayer, key: typeof columns[number][0]) =>
    key === "completed" && !player.knownOutcomes ? null : player[key];
  const sorted = [...players].sort((left, right) => {
    const a = metric(left, sort.key);
    const b = metric(right, sort.key);
    if (a === b) return (left.name ?? "").localeCompare(right.name ?? "") || left.id - right.id;
    if (a === null) return 1;
    if (b === null) return -1;
    return sort.descending ? b - a : a - b;
  });
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return <section className="panel team-analysis-advanced-block">
    <div className="panel-heading"><div>
      <h3>Player passing contribution</h3>
      <p>Completion uses attempts with a recorded outcome. Progression and direction use valid coordinates. Lineups supply minutes for full-match selections.</p>
    </div></div>
    <div className="tactical-passing-players">
      <table>
        <thead><tr><th scope="col">Player</th>{columns.map(([key, label]) => <th scope="col" key={key}
          aria-sort={sort.key === key ? sort.descending ? "descending" : "ascending" : undefined}>
          <button type="button" onClick={() => setSort(previous => ({
            key, descending: previous.key === key ? !previous.descending : true
          }))}>{label}{sort.key === key && (sort.descending ? " ↓" : " ↑")}</button>
        </th>)}</tr></thead>
        <tbody>{sorted.map(player => <tr key={player.id}>
          <th scope="row">{player.name || `Player ${player.id}`}<small>{player.eventMatches} matches with pass events</small></th>
          {columns.map(([key]) => {
            const number = metric(player, key);
            return <td key={key}>{number === null ? "—" : formatter.format(number) + (key === "completion" ? "%" : "")}
              {key === "minutes" && number !== null && <small>{player.matchesWithMinutes} lineup records</small>}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export type { PassingPlayer };
