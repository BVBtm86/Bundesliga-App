"use client";

import { useEffect, useMemo, useState } from "react";
import { AdvancedTable } from "@/components/standings/AdvancedTable";
import { FormTable } from "@/components/standings/FormTable";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { formPoints, getStandings, goalDifference, StandingTeam, StandingsPayload, TableType, ViewKey } from "@/lib/standings";

const tabs: { key: ViewKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "advanced", label: "Advanced" },
  { key: "form", label: "Form Tables" },
];

export function StandingsPage() {
  const [payload, setPayload] = useState<StandingsPayload | null>(null);
  const [season, setSeason] = useState<string | undefined>();
  const [tableType, setTableType] = useState<TableType>("Total");
  const [roundFilter, setRoundFilter] = useState("all");
  const [matchweekFilter, setMatchweekFilter] = useState("latest");
  const [minuteFilter, setMinuteFilter] = useState("ft");
  const [activeTab, setActiveTab] = useState<ViewKey>("overview");
  const [formWindow, setFormWindow] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    getStandings({ season, tableType, roundFilter, matchweekFilter, minuteFilter })
      .then((data) => {
        if (!isCurrent) return;
        setPayload(data);
        setSeason(data.season);
        setTableType(data.table_type);
        setRoundFilter(data.round_filter);
        setMatchweekFilter(data.matchweek_filter);
        setMinuteFilter(data.minute_filter);
      })
      .catch((caught: unknown) => {
        if (!isCurrent) return;
        setError(caught instanceof Error ? caught.message : "Could not load standings.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [season, tableType, roundFilter, matchweekFilter, minuteFilter]);

  const table = useMemo(() => payload?.table || [], [payload]);
  const formWindowOptions = useMemo(() => buildFormWindowOptions(table), [table]);
  const metrics = useMemo(() => buildMetrics(table, activeTab, formWindow), [activeTab, formWindow, table]);

  useEffect(() => {
    if (!formWindowOptions.includes(formWindow)) {
      setFormWindow(formWindowOptions[formWindowOptions.length - 1] || 5);
    }
  }, [formWindow, formWindowOptions]);

  return (
    <main className="min-w-0 px-7 py-7">
      <section className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-red-500">Bundesliga App</p>
          <h1 className="mt-1 text-[34px] font-bold leading-none tracking-[-0.01em] text-slate-950">Standings</h1>
        </div>
      </section>

      <section className="mb-6 grid max-w-6xl grid-cols-1 gap-3 md:grid-cols-[170px_1fr_210px_210px]" aria-label="Standings filters">
        <FilterSelect
          label="Season"
          value={season || ""}
          onChange={setSeason}
          options={(payload?.filters.seasons || []).map((item) => ({ value: item, label: item }))}
        />
        <FilterSelect
          label="Season Stage"
          value={roundFilter}
          onChange={setRoundFilter}
          options={Object.entries(payload?.filters.round_filters || { all: "All" }).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          label="Matchweek"
          value={matchweekFilter}
          onChange={setMatchweekFilter}
          options={Object.entries(payload?.filters.matchweek_filters || {}).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          label="Game Period"
          value={minuteFilter}
          onChange={setMinuteFilter}
          options={Object.entries(payload?.filters.minute_filters || { ft: "Full time" }).map(([value, label]) => ({ value, label }))}
        />
      </section>

      <nav className="mb-5 flex gap-7 border-b border-slate-200" aria-label="Standings sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              "relative min-h-11 text-sm font-semibold transition",
              activeTab === tab.key ? "text-slate-950 after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-red-600" : "text-slate-500 hover:text-slate-950",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
      ) : null}

      {isLoading && !payload ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600">Loading standings...</div>
      ) : null}

      {payload ? (
        <>
          <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
            <VenueSegments tableType={tableType} onTableTypeChange={setTableType} />
            {activeTab === "overview" ? <Legend /> : null}
            {activeTab === "form" ? (
              <FormWindowSelect value={formWindow} options={formWindowOptions} onChange={setFormWindow} />
            ) : null}
          </section>

          <MetricsStrip metrics={metrics} />

          {activeTab === "overview" ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              <StandingsTable teams={table} />
            </section>
          ) : null}

          {activeTab === "advanced" ? <AdvancedTable teams={table} /> : null}
          {activeTab === "form" ? <FormTable teams={table} windowSize={formWindow} /> : null}
        </>
      ) : null}
    </main>
  );
}

type VenueSegmentsProps = {
  tableType: TableType;
  onTableTypeChange: (value: TableType) => void;
};

function VenueSegments({ tableType, onTableTypeChange }: VenueSegmentsProps) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {(["Total", "Home", "Away"] as TableType[]).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onTableTypeChange(type)}
          className={[
            "min-h-10 min-w-24 px-4 text-sm font-semibold transition",
            tableType === type ? "bg-red-600 text-white" : "text-slate-600 hover:bg-white hover:text-slate-950",
          ].join(" ")}
        >
          {type === "Total" ? "Overall" : type}
        </button>
      ))}
    </div>
  );
}

type FormWindowSelectProps = {
  value: number;
  options: number[];
  onChange: (value: number) => void;
};

function FormWindowSelect({ value, options, onChange }: FormWindowSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950"
      aria-label="Form window"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          Last {option} Matches
        </option>
      ))}
    </select>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-red-500/70"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500">
      <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-amber-400" /> Champion</span>
      <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-emerald-500" /> Champions League</span>
      <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-blue-500" /> Europe</span>
      <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-amber-400" /> Playoff</span>
      <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-red-500" /> Relegation</span>
    </div>
  );
}

type SummaryMetric = {
  label: string;
  value: string;
  context: string;
};

function MetricsStrip({ metrics }: { metrics: SummaryMetric[] }) {
  if (!metrics.length) return null;

  return (
    <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Table summary">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{metric.label}</p>
          <p className="mt-2 truncate text-xl font-bold text-slate-950">{metric.value}</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{metric.context}</p>
        </article>
      ))}
    </section>
  );
}

function buildMetrics(teams: StandingTeam[], activeTab: ViewKey, formWindow: number): SummaryMetric[] {
  if (!teams.length) return [];

  if (activeTab === "form") {
    const formRows = teams
      .map((team) => {
        const matches = (team.form_matches || []).slice(0, formWindow);
        const form = matches.length ? matches.map((match) => match.result) : (team.form_history || team.form || []).slice(0, formWindow);
        const goalsFor = matches.reduce((sum, match) => sum + match.goals_for, 0);
        const goalsAgainst = matches.reduce((sum, match) => sum + match.goals_against, 0);
        return {
          team,
          points: formPoints(form),
          goalsFor,
          goalsAgainst,
          goalDifference: goalsFor - goalsAgainst,
          wins: form.filter((result) => result === "W").length,
        };
      })
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
    const best = formRows[0];
    const sharpest = [...formRows].sort((a, b) => b.goalsFor - a.goalsFor || b.goalDifference - a.goalDifference)[0];
    const tightest = [...formRows].sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.points - a.points)[0];

    return [
      { label: `Best Last ${formWindow}`, value: best.team.display_name || best.team.team_name, context: `${best.points} pts, ${goalDifference(best.goalDifference)} GD` },
      { label: "Most Goals", value: sharpest.team.display_name || sharpest.team.team_name, context: `${sharpest.goalsFor}-${sharpest.goalsAgainst}` },
      { label: "Best Defense", value: tightest.team.display_name || tightest.team.team_name, context: `${tightest.goalsAgainst} conceded` },
    ];
  }

  const leader = teams[0];
  const bestAttack = [...teams].sort((a, b) => b.goals_for - a.goals_for || b.points - a.points)[0];
  const bestDefense = [...teams].sort((a, b) => a.goals_against - b.goals_against || b.points - a.points)[0];

  if (activeTab === "advanced") {
    return [
      { label: "Current Leader", value: leader.display_name || leader.team_name, context: `${leader.points} pts` },
      { label: "Best Attack", value: bestAttack.display_name || bestAttack.team_name, context: `${bestAttack.goals_for} goals for` },
      { label: "Best Defense", value: bestDefense.display_name || bestDefense.team_name, context: `${bestDefense.goals_against} goals against` },
    ];
  }

  return [
    { label: "Leader", value: leader.display_name || leader.team_name, context: `${leader.points} pts, ${goalDifference(leader.goal_difference)} GD` },
    { label: "Best Attack", value: bestAttack.display_name || bestAttack.team_name, context: `${bestAttack.goals_for} goals for` },
    { label: "Best Defense", value: bestDefense.display_name || bestDefense.team_name, context: `${bestDefense.goals_against} goals against` },
  ];
}

function buildFormWindowOptions(teams: StandingTeam[]): number[] {
  const maxAvailableMatches = Math.max(
    0,
    ...teams.map((team) => team.form_matches?.length || team.form_history?.length || team.played || 0),
  );
  const options = [5];
  if (maxAvailableMatches >= 10) options.push(10);
  if (maxAvailableMatches >= 15) options.push(15);
  return options;
}
