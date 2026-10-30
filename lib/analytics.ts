import type { Match, MatchStats, Team, VenueFilter, StandingsTiebreaker, SeasonPointsAdjustment, SeasonRecordAdjustment } from "./types";

export type LeagueTrendMetric = "goals" | "shots" | "shotsOnTarget" | "corners" | "passCompletion" | "yellowCards" | "fouls";
export type LeagueTrendPoint = { week:number; played:number; scheduled:number; value:number | null };

export function completed(matches: Match[]) {
  return matches.filter(m => m.finished && Number.isInteger(m.homeGoals) && Number.isInteger(m.awayGoals)
    && m.homeGoals! >= 0 && m.awayGoals! >= 0);
}

const DEFAULT_TIEBREAKERS: StandingsTiebreaker[] = ["points", "goal_difference", "goals_scored"];

export type StandingsAdjustments = {
  points_adjustments?: SeasonPointsAdjustment[];
  record_adjustments?: SeasonRecordAdjustment[];
};

function normalizedRule(rule: string) {
  return rule.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

type MiniStats = { points: number; gf: number; ga: number; awayGoals: number; ratio: number };

function miniTable(ids: Set<number>, matches: Match[], pointsForWin: number, pointsForDraw: number) {
  const table = new Map<number, MiniStats>();
  for (const id of ids) table.set(id, { points: 0, gf: 0, ga: 0, awayGoals: 0, ratio: 0 });
  for (const match of matches) {
    if (!ids.has(match.homeId) || !ids.has(match.awayId)) continue;
    const home = table.get(match.homeId)!; const away = table.get(match.awayId)!;
    home.gf += match.homeGoals!; home.ga += match.awayGoals!; home.awayGoals += 0;
    away.gf += match.awayGoals!; away.ga += match.homeGoals!; away.awayGoals += match.awayGoals!;
    if (match.homeGoals! > match.awayGoals!) home.points += pointsForWin;
    else if (match.homeGoals! < match.awayGoals!) away.points += pointsForWin;
    else { home.points += pointsForDraw; away.points += pointsForDraw; }
  }
  for (const row of table.values()) row.ratio = row.ga === 0 ? (row.gf > 0 ? Number.POSITIVE_INFINITY : 0) : row.gf / row.ga;
  return table;
}

/**
 * Rank a season in memory using the exact ordered rules from season_config.
 * Head-to-head rules are evaluated against the currently tied mini-table, never
 * against league-wide totals. `head_to_head_results` means the points earned
 * in that mini-table (the historical result comparison), while the following
 * head-to-head rules further separate any remaining tie.
 */
export function rankStandings(matches: Match[], venue:VenueFilter="all", roster:Match[]=[], pointsForWin = 3, tiebreakers: StandingsTiebreaker[] = DEFAULT_TIEBREAKERS, pointsForDraw = 1, adjustments?: StandingsAdjustments): Team[] {
  const teams = new Map<number, Team>();
  for (const m of roster) for (const home of [true,false]) {
    const id=home?m.homeId:m.awayId;
    if(!teams.has(id))teams.set(id,{id,name:home?m.home:m.away,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0,form:[]});
  }
  for (const m of [...completed(matches)].sort((a,b) => a.date.localeCompare(b.date) || a.id-b.id)) {
    for (const home of [true, false]) {
      if((venue==="home"&&!home)||(venue==="away"&&home))continue;
      const id = home ? m.homeId : m.awayId;
      let t = teams.get(id);
      if (!t) {
        t = {id, name: home ? m.home : m.away, played:0, won:0, drawn:0, lost:0,
          gf:0, ga:0, points:0, form:[]};
        teams.set(id,t);
      }
      const gf = (home ? m.homeGoals : m.awayGoals)!;
      const ga = (home ? m.awayGoals : m.homeGoals)!;
      const result = gf > ga ? "W" : gf === ga ? "D" : "L";
      t.played++; t.gf += gf; t.ga += ga;
      t.points += result === "W" ? pointsForWin : result === "D" ? pointsForDraw : 0;
      if (result === "W") t.won++;
      else if (result === "D") t.drawn++;
      else t.lost++;
      t.form = [...t.form.slice(-4), result];
    }
  }
  const pointsAdjustments = new Map((adjustments?.points_adjustments ?? []).map(item => [item.teamId, item.points]));
  const recordAdjustments = new Map((adjustments?.record_adjustments ?? []).map(item => [item.teamId, item]));
  for (const team of teams.values()) {
    const recordAdjustment = recordAdjustments.get(team.id);
    const isExpunged = recordAdjustment && [recordAdjustment.type, recordAdjustment.reason].filter(Boolean).some(value => {
      const rule = normalizedRule(String(value));
      return rule.includes("expung") || rule.includes("annul") || rule.includes("void") || rule.includes("nullif") || rule.includes("cancel");
    });
    team.earned_points = team.points;
    if (isExpunged) {
      team.played = 0; team.won = 0; team.drawn = 0; team.lost = 0; team.gf = 0; team.ga = 0; team.points = 0;
      team.record_adjustment = recordAdjustment?.type ?? "expunged";
      team.earned_points = 0;
    }
    const adjustment = pointsAdjustments.get(team.id) ?? 0;
    team.points_adjustment = adjustment;
    team.official_points = team.earned_points + adjustment;
    team.points = team.official_points;
  }
  const filtered = [...completed(matches)].filter(m => venue === "all" || (venue === "home" ? true : true));
  const rules = (tiebreakers.length ? tiebreakers : DEFAULT_TIEBREAKERS).map(normalizedRule);
  const values = new Map<number, Team>(teams);
  const globalValue = (team: Team, rule: string): number => {
    if (rule === "points") return team.points;
    if (rule === "goal_difference" || rule === "goaldifference") return team.gf - team.ga;
    if (rule === "goals_scored" || rule === "goals_for" || rule === "gf") return team.gf;
    if (rule === "away_goals_scored" || rule === "away_goals") return filtered.reduce((sum, m) => sum + (m.awayId === team.id ? m.awayGoals! : 0), 0);
    if (rule === "goal_ratio" || rule === "goals_ratio") return team.ga === 0 ? (team.gf > 0 ? Number.POSITIVE_INFINITY : 0) : team.gf / team.ga;
    return 0;
  };
  const orderByName = (ids: number[]) => ids.slice().sort((a,b) => (values.get(a)?.name ?? "").localeCompare(values.get(b)?.name ?? ""));
  const rankGroup = (ids: number[], ruleIndex: number): number[] => {
    if (ids.length <= 1) return ids;
    if (ruleIndex >= rules.length) {
      for (const id of ids) values.get(id)!.rankingStatus = "tied";
      return orderByName(ids);
    }
    const rule = rules[ruleIndex];
    if (rule === "playoff" || rule === "play_off") {
      for (const id of ids) values.get(id)!.rankingStatus = "playoff_required";
      return orderByName(ids);
    }
    const h2h = rule.startsWith("head_to_head") || rule === "head_to_head_results";
    const mini = h2h ? miniTable(new Set(ids), filtered, pointsForWin, pointsForDraw) : null;
    const score = (id: number) => {
      if (mini) {
        const row = mini.get(id)!;
        if (rule === "head_to_head_points" || rule === "head_to_head_results" || rule === "head_to_head") return row.points;
        if (rule === "head_to_head_goal_difference" || rule === "head_to_head_goals_difference") return row.gf - row.ga;
        if (rule === "head_to_head_away_goals_scored" || rule === "head_to_head_away_goals") return row.awayGoals;
      }
      return globalValue(values.get(id)!, rule);
    };
    const buckets = new Map<string, number[]>();
    for (const id of ids) { const value = score(id); const key = Number.isFinite(value) ? String(value) : value > 0 ? "Infinity" : "-Infinity"; buckets.set(key, [...(buckets.get(key) ?? []), id]); }
    const ordered = [...buckets.entries()].sort((a,b) => Number(b[0]) - Number(a[0]));
    return ordered.flatMap(([, group]) => rankGroup(group, ruleIndex + 1));
  };
  const ranked = rankGroup([...values.keys()], 0);
  return ranked.map(id => values.get(id)!);
}

/** Backwards-compatible entry point used by existing screens. */
export function standings(matches: Match[], venue:VenueFilter="all", roster:Match[]=[], pointsForWin = 3, tiebreakers?: StandingsTiebreaker[], pointsForDraw = 1, adjustments?: StandingsAdjustments): Team[] {
  return rankStandings(matches, venue, roster, pointsForWin, tiebreakers, pointsForDraw, adjustments);
}

export function goalSummary(matches: Match[],venue:VenueFilter="all") {
  const games = completed(matches);
  const goals = games.reduce((sum,m) => sum+(venue==="home"?m.homeGoals!:venue==="away"?m.awayGoals!:m.homeGoals!+m.awayGoals!),0);
  return {played: games.length, goals, average: games.length ? goals/games.length : 0};
}

export function goalTrend(matches: Match[],venue:VenueFilter="all") {
  const groups = new Map<number, Match[]>();
  for (const m of completed(matches)) groups.set(m.week,[...(groups.get(m.week) ?? []),m]);
  return [...groups].sort(([a],[b]) => a-b).map(([week,games]) => ({
    week, ...goalSummary(games,venue)
  }));
}

/** League-wide matchday series. Every fixture is counted once; team records are
 * only combined for the metric being measured. */
export function leagueTrend(matches: Match[], stats: MatchStats[], metric: LeagueTrendMetric): LeagueTrendPoint[] {
  const rows = new Map(stats.map(row => [`${row.gameId}:${row.teamId}`, row]));
  const groups = new Map<number, Match[]>();
  for (const match of matches) if (match.week > 0) groups.set(match.week, [...(groups.get(match.week) ?? []), match]);
  return [...groups].sort(([a],[b]) => a-b).map(([week, fixtures]) => {
    const played = completed(fixtures);
    let numerator = 0, denominator = 0, available = 0;
    for (const fixture of played) {
      if (metric === "goals") { numerator += fixture.homeGoals! + fixture.awayGoals!; available++; continue; }
      for (const teamId of [fixture.homeId, fixture.awayId]) {
        const period = rows.get(`${fixture.id}:${teamId}`)?.periods?.ft;
        if (metric === "shots" && typeof period?.shots === "number") { numerator += period.shots; available++; }
        if (metric === "shotsOnTarget" && typeof period?.onTarget === "number") { numerator += period.onTarget; available++; }
        if (metric === "corners" && typeof period?.corners === "number") { numerator += period.corners; available++; }
        if (metric === "yellowCards" && typeof period?.yellowCards === "number") { numerator += period.yellowCards; available++; }
        if (metric === "fouls" && typeof period?.foulsCommitted === "number") { numerator += period.foulsCommitted; available++; }
        if (metric === "passCompletion" && typeof period?.completedPasses === "number" && typeof period?.passes === "number") { numerator += period.completedPasses; denominator += period.passes; available++; }
      }
    }
    const value = metric === "passCompletion" ? (denominator > 0 ? numerator / denominator * 100 : null) : (played.length > 0 && available === played.length * (metric === "goals" ? 1 : 2) ? numerator / played.length : null);
    return {week, played:played.length, scheduled:fixtures.length - played.length, value};
  }).filter(point => point.played > 0);
}

