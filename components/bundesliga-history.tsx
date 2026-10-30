"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Map as MapIcon, Trophy } from "lucide-react";
import { standings } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";
import type { Dashboard, Match } from "@/lib/types";

type Props = { data: Dashboard };
type GeoFeature = { properties: { gen?: string; ars?: string; ibz?: number; bez?: string }; geometry: { type: "MultiPolygon" | "Polygon"; coordinates: number[][][][] | number[][][] } };
type GeoJson = { features: GeoFeature[] };
type Club = { id: number; name: string; city: string; state: string; stadium?: string; x: number; y: number; anchorX: number; anchorY: number; logo?: string; opacity?: number };
type HistoricalRecord = { id: number; name: string; seasons: number; firstSeason: string; lastSeason: string; played: number; won: number; drawn: number; lost: number; diff: number; goalsFor: number; goalsAgainst: number; runnersUp: number; europeanQualifications: number; currentStreak: number; points: number; top3: number; top5: number; top10: number; relegated: number; best: number; worst: number; titles: number; average: number | null; logo?: string };
type HistoricalSortKey = keyof Pick<HistoricalRecord, "titles" | "seasons" | "firstSeason" | "lastSeason" | "played" | "won" | "drawn" | "lost" | "goalsFor" | "goalsAgainst" | "diff" | "points" | "average" | "runnersUp" | "europeanQualifications" | "currentStreak" | "top3" | "top5" | "top10" | "relegated" | "best" | "worst">;
type HistoricalRecordView = "overview" | "attacking" | "achievements" | "european";
type StateParticipation = { id: number; name: string; seasons: number };
const europeanCompetitionOrder = ["European Cup", "UEFA Champions League", "UEFA Cup Winners' Cup", "Inter-Cities Fairs Cup", "UEFA Cup", "UEFA Europa League", "UEFA Conference League", "UEFA Intertoto Cup"];
const europeanCompetitionAcronyms: Record<string, string> = { "European Cup": "EC", "UEFA Champions League": "UCL", "UEFA Cup Winners' Cup": "CWC", "Inter-Cities Fairs Cup": "ICFC", "UEFA Cup": "UC", "UEFA Europa League": "UEL", "UEFA Conference League": "UECL", "UEFA Intertoto Cup": "UIC" };
const europeanCompetitionCanonical = (value: string) => { const key = normalize(value); if (key === "europeancup") return "European Cup"; if (key === "championsleague" || key === "uefachampionsleague") return "UEFA Champions League"; if (key === "cupwinnerscup" || key === "uefacupwinnerscup") return "UEFA Cup Winners' Cup"; if (key === "intercitiesfairscup") return "Inter-Cities Fairs Cup"; if (key === "uefacup") return "UEFA Cup"; if (key === "europaleague" || key === "uefaeuropaleague") return "UEFA Europa League"; if (key === "conferenceleague" || key === "uefaconferenceleague") return "UEFA Conference League"; if (key === "intertotocup" || key === "uefaintertotocup") return "UEFA Intertoto Cup"; return value; };

export const cityCoordinates: Record<string, [number, number, string, string]> = {
  bayernmunich:[11.5755,48.1374,"Munich","Bavaria"], borussiadortmund:[7.46,51.51,"Dortmund","North Rhine-Westphalia"], schalke04:[7.07,51.55,"Gelsenkirchen","North Rhine-Westphalia"], borussiamonchengladbach:[6.44,51.18,"MÃ¶nchengladbach","North Rhine-Westphalia"], eintrachtfrankfurt:[8.68,50.11,"Frankfurt","Hesse"], werderbremen:[8.80,53.08,"Bremen","Bremen"], hamburger:[9.99,53.55,"Hamburg","Hamburg"], hamburgersv:[9.99,53.55,"Hamburg","Hamburg"], herthaberlin:[13.4050,52.5200,"Berlin","Berlin"], unionberlin:[13.4050,52.5200,"Berlin","Berlin"], rbleipzig:[12.37,51.34,"Leipzig","Saxony"], bayer04leverkusen:[6.99,51.03,"Leverkusen","North Rhine-Westphalia"], scfreiburg:[7.85,48.00,"Freiburg","Baden-WÃ¼rttemberg"], vfbstuttgart:[9.18,48.78,"Stuttgart","Baden-WÃ¼rttemberg"], hoffenheim:[8.73,49.25,"Sinsheim","Baden-WÃ¼rttemberg"], tsghoffenheim:[8.73,49.25,"Sinsheim","Baden-WÃ¼rttemberg"], vflwolfsburg:[10.79,52.42,"Wolfsburg","Lower Saxony"], fcaugsburg:[10.90,48.37,"Augsburg","Bavaria"], mainz05:[8.27,49.99,"Mainz","Rhineland-Palatinate"], fsvmainz05:[8.27,49.99,"Mainz","Rhineland-Palatinate"], fcstpauli:[9.97,53.55,"Hamburg","Hamburg"], bochum:[7.22,51.48,"Bochum","North Rhine-Westphalia"], vflbochum:[7.22,51.48,"Bochum","North Rhine-Westphalia"], fckoeln:[6.96,50.94,"Cologne","North Rhine-Westphalia"], fckoln:[6.96,50.94,"Cologne","North Rhine-Westphalia"], hannover96:[9.73,52.37,"Hannover","Lower Saxony"], nuernberg:[11.08,49.45,"Nuremberg","Bavaria"], "1fcnurnberg":[11.08,49.45,"Nuremberg","Bavaria"], kaiserslautern:[7.77,49.44,"Kaiserslautern","Rhineland-Palatinate"], arminiabielefeld:[8.53,52.03,"Bielefeld","North Rhine-Westphalia"], augsburg:[10.90,48.37,"Augsburg","Bavaria"], bayerleverkusen:[6.99,51.03,"Leverkusen","North Rhine-Westphalia"], borussiamgladbach:[6.44,51.18,"MÃ¶nchengladbach","North Rhine-Westphalia"], fcheideheim:[10.67,48.68,"Heidenheim","Baden-WÃ¼rttemberg"], freiburg:[7.85,48.00,"Freiburg","Baden-WÃ¼rttemberg"], stpauli:[9.97,53.55,"Hamburg","Hamburg"], wolfsburg:[10.79,52.42,"Wolfsburg","Lower Saxony"], darmstadt:[8.65,49.87,"Darmstadt","Hesse"], svdarmstadt9:[8.65,49.87,"Darmstadt","Hesse"], paderborn:[8.75,51.72,"Paderborn","North Rhine-Westphalia"], scpaderborn07:[8.75,51.72,"Paderborn","North Rhine-Westphalia"], braunschweig:[10.52,52.27,"Braunschweig","Lower Saxony"], eintrachtbraunschweig:[10.52,52.27,"Braunschweig","Lower Saxony"], fortunaduesseldorf:[6.77,51.23,"DÃ¼sseldorf","North Rhine-Westphalia"], greutherfurth:[10.99,49.48,"FÃ¼rth","Bavaria"], heidenheim:[10.67,48.68,"Heidenheim","Baden-WÃ¼rttemberg"], fcheidenheim:[10.67,48.68,"Heidenheim","Baden-WÃ¼rttemberg"], holsteinkiel:[10.12,54.32,"Kiel","Schleswig-Holstein"], elversberg:[6.99,49.30,"Elversberg","Saarland"]
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const stateKey = (value: string) => { const key = normalize(value); const aliases: Record<string, string> = { bayern: "Bavaria", badenwurttemberg: "Baden-WÃ¼rttemberg", "badenwurttembergbodensee": "Baden-WÃ¼rttemberg", niedersachsen: "Lower Saxony", nordrheinwestfalen: "North Rhine-Westphalia", hessen: "Hesse", rheinlandpfalz: "Rhineland-Palatinate", saarland: "Saarland", berlin: "Berlin", brandenburg: "Brandenburg", mecklenburgvorpommern: "Mecklenburg-Vorpommern", sachsenanhalt: "Saxony-Anhalt", sachsen: "Saxony", schleswigholstein: "Schleswig-Holstein", thuringen: "Thuringia", bremen: "Bremen", hamburg: "Hamburg" }; return aliases[key] ?? value; };
const finished = (m: Match) => m.finished && m.homeGoals !== null && m.awayGoals !== null;
const formatSeasonShort = (value: string) => value.length >= 9 ? `${value.slice(0, 4)}/${value.slice(-2)}` : value;
const project = (lon: number, lat: number) => {
  const a = 6378137;
  const eccentricitySquared = 0.00669438;
  const eccentricityPrimeSquared = eccentricitySquared / (1 - eccentricitySquared);
  const scale = 0.9996;
  const latitude = (lat * Math.PI) / 180;
  const longitude = (lon * Math.PI) / 180;
  const origin = (9 * Math.PI) / 180;
  const sin = Math.sin(latitude);
  const cos = Math.cos(latitude);
  const tan = Math.tan(latitude);
  const n = a / Math.sqrt(1 - eccentricitySquared * sin * sin);
  const t = tan * tan;
  const c = eccentricityPrimeSquared * cos * cos;
  const aa = cos * (longitude - origin);
  const m = a * ((1 - eccentricitySquared / 4 - (3 * eccentricitySquared ** 2) / 64) * latitude
    - (3 * eccentricitySquared / 8 + (3 * eccentricitySquared ** 2) / 32) * Math.sin(2 * latitude)
    + (15 * eccentricitySquared ** 2 / 256) * Math.sin(4 * latitude));
  const easting = 500000 + scale * n * (aa + ((1 - t + c) * aa ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * eccentricityPrimeSquared) * aa ** 5) / 120);
  const northing = scale * (m + n * tan * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24));
  return { x: 350 + (easting - 600750) * 0.00055, y: 245 - (northing - 5671000) * 0.00055 };
};
const geometryRings = (feature: GeoFeature) => feature.geometry.type === "Polygon" ? feature.geometry.coordinates as number[][][] : (feature.geometry.coordinates as number[][][][]).flatMap(polygon => polygon);
const geometryPath = (feature: GeoFeature) => geometryRings(feature).map(ring => `M ${ring.map(([x, y]) => `${350 + (x - 600750) * 0.00055},${245 - (y - 5671000) * 0.00055}`).join(" L ")} Z`).join(" ");
const pathPoints = (ring: number[][]) => ring.map(([x, y]) => `${350 + (x - 600750) * 0.00055},${245 - (y - 5671000) * 0.00055}`).join(" ");
const pointInRing = (x: number, y: number, ring: number[][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i += 1) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};
const featureContains = (feature: GeoFeature, x: number, y: number) => geometryRings(feature).some(ring => pointInRing(x, y, ring.map(([lon, lat]) => [350 + (lon - 600750) * 0.00055, 245 - (lat - 5671000) * 0.00055])));
const stateFill = (count: number, allTime: boolean) => {
  if (!count) return "#374450";
  if (allTime) {
    if (count <= 2) return "#6f3045";
    if (count <= 4) return "#9a4058";
    if (count <= 6) return "#7b2f47";
    if (count <= 9) return "#68263f";
    return "#4a2034";
  }
  if (count <= 2) return "#6f3045";
  if (count === 3) return "#a94b63";
  return "#5a2638";
};
const layoutClubs = (base: Club[], minDistance = 30) => {
  const placed: Club[] = [];
  return base.map((club, index) => {
    let x = club.anchorX;
    let y = club.anchorY;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const clear = placed.every(other => Math.hypot(x - other.x, y - other.y) >= minDistance);
      if (clear) break;
      const angle = ((index + attempt) * 137.508 * Math.PI) / 180;
      const radius = 16 + Math.floor(attempt / 6) * 7;
      x = club.anchorX + Math.cos(angle) * radius;
      y = club.anchorY + Math.sin(angle) * radius;
    }
    const next = { ...club, x, y };
    placed.push(next);
    return next;
  });
};
const layoutSameCityClubs = (base: Club[]) => {
  const groups = new Map<string, Club[]>();
  for (const club of base) {
    const key = club.city ? `${normalize(club.city)}:${normalize(club.state)}` : `${club.anchorX.toFixed(2)}:${club.anchorY.toFixed(2)}`;
    groups.set(key, [...(groups.get(key) ?? []), club]);
  }
  return [...groups.values()].flatMap(group => {
    if (group.length < 2) return group;
    const spacing = 28;
    const start = -((group.length - 1) * spacing) / 2;
    return group.map((club, index) => ({ ...club, x: club.anchorX + start + index * spacing, y: club.anchorY, opacity: .62 }));
  });
};

export default function BundesligaHistory({ data }: Props) {
  const { t } = useI18n();
  const [geo, setGeo] = useState<GeoJson | null>(null); const [index, setIndex] = useState(0); const [individualIndex, setIndividualIndex] = useState(0); const [allSeasons, setAllSeasons] = useState(false); const [allFromIndex, setAllFromIndex] = useState(0); const [allToIndex, setAllToIndex] = useState(0); const [hoveredState, setHoveredState] = useState<string | null>(null); const [selectedState, setSelectedState] = useState<string | null>(null); const stateLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const [recordSort, setRecordSort] = useState<HistoricalSortKey>("points"); const [recordDescending, setRecordDescending] = useState(true); const [recordView, setRecordView] = useState<HistoricalRecordView>("overview"); const [recordQuery, setRecordQuery] = useState("");
  const seasons = useMemo(() => [...data.seasons].sort((a, b) => Number(a.slice(0, 4)) - Number(b.slice(0, 4))), [data.seasons]); const season = seasons[index] ?? data.season;
  useEffect(() => { fetch("/history-vg1000.json").then(r => r.json()).then(setGeo).catch(() => setGeo(null)); }, []);
  useEffect(() => { if (!seasons.length) return; const latest = seasons.length - 1; setIndex(latest); setIndividualIndex(latest); setAllFromIndex(0); setAllToIndex(latest); }, [seasons.length]);
  const allSeasonNames = useMemo(() => seasons.filter((_, seasonIndex) => seasonIndex >= Math.min(allFromIndex, allToIndex) && seasonIndex <= Math.max(allFromIndex, allToIndex)), [allFromIndex, allToIndex, seasons]);
  const allTimeLabel = allSeasonNames.length ? `${formatSeasonShort(allSeasonNames[0])}â€“${formatSeasonShort(allSeasonNames[allSeasonNames.length - 1])}` : t("dash.allTime");
  const activeState = selectedState ?? hoveredState;
  const matches = useMemo(() => allSeasons ? data.historicalMatches.filter(match => allSeasonNames.includes(match.season ?? "") && finished(match)) : data.historicalMatches.filter(m => m.season === season && finished(m)), [allSeasonNames, allSeasons, data.historicalMatches, season]);
  const teamLocations = useMemo(() => new Map((data.teamLocations ?? []).map(location => [location.id, location])), [data.teamLocations]);
  const stateFeatures = useMemo(() => { const unique = new Map<string, GeoFeature>(); for (const feature of geo?.features ?? []) { const code = feature.properties.ars ?? feature.properties.gen ?? "unknown"; if (!unique.has(code)) unique.set(code, feature); } return [...unique.values()].slice(0, 16).sort((a, b) => (a.properties.gen === "Berlin" ? 1 : 0) - (b.properties.gen === "Berlin" ? 1 : 0)); }, [geo]);
  const participants = useMemo(() => { const map = new Map<number, { id: number; name: string }>(); for (const m of matches) for (const [id, name] of [[m.homeId, m.home], [m.awayId, m.away]] as const) map.set(id, { id, name }); return [...map.values()]; }, [matches]);
  const seasonGoalStats = useMemo(() => {
    const totalGoals = matches.reduce((total, match) => total + match.homeGoals! + match.awayGoals!, 0);
    const highestScoring = matches.reduce<Match | null>((best, match) => !best || match.homeGoals! + match.awayGoals! > best.homeGoals! + best.awayGoals! ? match : best, null);
    const largestHomeWin = matches.filter(match => match.homeGoals! > match.awayGoals!).reduce<Match | null>((best, match) => !best || match.homeGoals! - match.awayGoals! > best.homeGoals! - best.awayGoals! ? match : best, null);
    const largestAwayWin = matches.filter(match => match.awayGoals! > match.homeGoals!).reduce<Match | null>((best, match) => !best || match.awayGoals! - match.homeGoals! > best.awayGoals! - best.homeGoals! ? match : best, null);
    return { totalGoals, averageGoals: matches.length ? totalGoals / matches.length : 0, highestScoring, largestHomeWin, largestAwayWin };
  }, [matches]);
  const recordMatch = (match: Match | null) => match ? <span className="history-record-match" title={`${match.home} ${match.homeGoals}-${match.awayGoals} ${match.away}`}><span><img src={data.logos[match.home]} alt={match.home} /></span><b>{match.homeGoals}-{match.awayGoals}</b><span><img src={data.logos[match.away]} alt={match.away} /></span></span> : <span>—</span>;
  const clubState = (id: number, name: string) => { const location = teamLocations.get(id); const known = cityCoordinates[normalize(name)]; if (known?.[3] === "Berlin") return "Berlin"; if (location?.city && normalize(location.city) === "berlin") return "Berlin"; return stateKey(known?.[3] ?? location?.state ?? ""); };
  const participationSeasons = allSeasons ? allSeasonNames : [season];
  const stateParticipation = useMemo(() => { const byState = new Map<string, Map<number, StateParticipation>>(); for (const seasonName of participationSeasons) { const seasonClubs = new Map<number, string>(); for (const match of data.historicalMatches) { if (match.season !== seasonName || !finished(match)) continue; seasonClubs.set(match.homeId, match.home); seasonClubs.set(match.awayId, match.away); } for (const [id, name] of seasonClubs) { const state = clubState(id, name); if (!state) continue; const clubsForState = byState.get(state) ?? new Map<number, StateParticipation>(); const current = clubsForState.get(id) ?? { id, name, seasons: 0 }; current.seasons += 1; current.name = name; clubsForState.set(id, current); byState.set(state, clubsForState); } } return new Map([...byState].map(([state, clubs]) => [state, [...clubs.values()].sort((a, b) => b.seasons - a.seasons || a.name.localeCompare(b.name))])); }, [participationSeasons, data.historicalMatches, teamLocations]);
  const seasonNeighbors = useMemo(() => { if (allSeasons) return { relegated: [] as string[], promoted: [] as string[] }; const currentIndex = seasons.indexOf(season); const nextSeason = seasons[currentIndex + 1]; const previousSeason = seasons[currentIndex - 1]; const clubsIn = (name: string | undefined) => new Map(data.historicalMatches.filter(m => m.season === name && finished(m)).flatMap(m => [[m.homeId, m.home], [m.awayId, m.away]] as [number, string][])); const current = new Map(participants.map(club => [club.id, club.name])); const next = clubsIn(nextSeason); const previous = clubsIn(previousSeason); return { relegated: nextSeason ? [...current.entries()].filter(([id]) => !next.has(id)).map(([, name]) => name) : [], promoted: previousSeason ? [...current.entries()].filter(([id]) => !previous.has(id)).map(([, name]) => name) : [] }; }, [allSeasons, data.historicalMatches, participants, season, seasons]);
  const mappedClubs = useMemo<Club[]>(() => participants.flatMap(entry => {
    const location = teamLocations.get(entry.id);
    const latitude = location?.latitude;
    const longitude = location?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") return [];
    const p = project(longitude, latitude);
    const resolvedState = clubState(entry.id, entry.name);
    const geographicState = resolvedState || stateFeatures.find(feature => featureContains(feature, p.x, p.y))?.properties.gen;
    return [{
      id: entry.id,
      name: entry.name,
      city: location?.city || "",
      state: stateKey(geographicState || location?.state || ""),
      stadium: location?.stadium || data.stadiums[entry.name],
      x: p.x,
      y: p.y,
      anchorX: p.x,
      anchorY: p.y,
      logo: data.logos[entry.name] || location?.logo
    }];
  }), [data.logos, data.stadiums, participants, stateFeatures, teamLocations]);
  const unresolved = useMemo(() => participants.filter(entry => {
    const location = teamLocations.get(entry.id);
    return !(typeof location?.latitude === "number" && typeof location?.longitude === "number");
  }), [participants, teamLocations]);
  const clubs = useMemo<Club[]>(() => layoutClubs(mappedClubs), [mappedClubs]);
  const visibleClubs = useMemo(() => layoutSameCityClubs(mappedClubs), [mappedClubs]);
  const seasonConfigFor = (seasonName: string) => data.seasonConfigs?.find(config => config.season === seasonName); const pointsForSeason = (seasonName: string) => seasonConfigFor(seasonName)?.rules?.pointsForWin ?? 3; const table = useMemo(() => standings(matches, "all", [], pointsForSeason(season), seasonConfigFor(season)?.standingsTiebreakers, seasonConfigFor(season)?.rules?.pointsForDraw ?? 1, seasonConfigFor(season)), [matches, data.seasonConfigs, season]); const seasonConfig = useMemo(() => !allSeasons ? data.seasonConfigs?.find(config => config.season === season) : undefined, [allSeasons, data.seasonConfigs, season]); const seasonOutcomes = seasonConfig?.summary?.outcomes ?? seasonConfig?.outcomes ?? []; const configuredChampionId = seasonConfig?.summary?.championTeamId ?? seasonOutcomes.find(outcome => outcome.type === "champion")?.teamIds[0]; const champion = !allSeasons && configuredChampionId !== undefined ? table.find(row => row.id === configuredChampionId) : null; const championshipRanking = useMemo(() => { const counts = new Map<string, { name: string; titles: number; seasons: string[] }>(); const scopedSeasons = allSeasons ? allSeasonNames : seasons; for (const seasonName of scopedSeasons) { const seasonMatches = data.historicalMatches.filter(m => m.season === seasonName && finished(m)); const seasonTable = standings(seasonMatches, "all", [], pointsForSeason(seasonName), seasonConfigFor(seasonName)?.standingsTiebreakers, seasonConfigFor(seasonName)?.rules?.pointsForDraw ?? 1, seasonConfigFor(seasonName)); const expectedMatches = seasonTable.length * (seasonTable.length - 1); if (seasonTable.length < 2 || seasonMatches.length < expectedMatches) continue; const winner = seasonTable[0]; if (!winner) continue; const entry = counts.get(winner.name) ?? { name: winner.name, titles: 0, seasons: [] }; entry.titles += 1; entry.seasons.push(seasonName); counts.set(winner.name, entry); } return [...counts.values()].sort((a, b) => b.titles - a.titles || (a.seasons[0] ?? "").localeCompare(b.seasons[0] ?? "") || a.name.localeCompare(b.name)); }, [allSeasonNames, allSeasons, data.historicalMatches, seasons]);
  const historicalTeamStats = useMemo(() => { type Record = { id: number; name: string; seasons: number; firstSeason: string; lastSeason: string; played: number; won: number; drawn: number; lost: number; diff: number; goalsFor: number; goalsAgainst: number; runnersUp: number; europeanQualifications: number; currentStreak: number; points: number; top3: number; top5: number; top10: number; relegated: number; best: number; worst: number; titles: number; average: number | null; logo?: string }; const records = new Map<number, Record>(); const scopedSeasons = allSeasons ? allSeasonNames : seasons; const chronological = [...scopedSeasons].sort(); const seasonTables = new Map<string, Map<number, number>>(); const seasonComplete = new Map<string, boolean>(); for (const seasonName of chronological) { const rows = standings(data.historicalMatches.filter(m => m.season === seasonName && finished(m)), "all", [], pointsForSeason(seasonName), seasonConfigFor(seasonName)?.standingsTiebreakers, seasonConfigFor(seasonName)?.rules?.pointsForDraw ?? 1, seasonConfigFor(seasonName)); const positions = new Map(rows.map((row, position) => [row.id, position + 1])); const seasonQualifications = new Set((seasonConfigFor(seasonName)?.summary?.outcomes ?? []).filter(outcome => outcome.type === "qualification").flatMap(outcome => outcome.teamIds)); seasonTables.set(seasonName, positions); seasonComplete.set(seasonName, rows.length > 1 && data.historicalMatches.filter(m => m.season === seasonName && finished(m)).length >= rows.length * (rows.length - 1)); for (const row of rows) { const current = records.get(row.id) ?? { id: row.id, name: row.name, seasons: 0, firstSeason: "", lastSeason: "", played: 0, won: 0, drawn: 0, lost: 0, diff: 0, goalsFor: 0, goalsAgainst: 0, runnersUp: 0, europeanQualifications: 0, currentStreak: 0, points: 0, top3: 0, top5: 0, top10: 0, relegated: 0, best: Number.POSITIVE_INFINITY, worst: 0, titles: 0, average: null }; const position = positions.get(row.id) ?? 0; current.seasons += 1; if (!current.firstSeason) current.firstSeason = seasonName; current.lastSeason = seasonName; current.played += row.played; current.won += row.won; current.drawn += row.drawn; current.lost += row.lost; current.goalsFor += row.gf; current.goalsAgainst += row.ga; current.diff += row.gf - row.ga; current.runnersUp += position === 2 ? 1 : 0; current.europeanQualifications += seasonQualifications.has(row.id) ? 1 : 0; current.points += row.won * 3 + row.drawn; current.top3 += position > 0 && position <= 3 ? 1 : 0; current.top5 += position > 0 && position <= 5 ? 1 : 0; current.top10 += position > 0 && position <= 10 ? 1 : 0; current.best = Math.min(current.best, position); current.worst = Math.max(current.worst, position); records.set(row.id, current); } } for (const record of records.values()) { let streak = 0; for (let i = chronological.length - 1; i >= 0; i -= 1) { const seasonName = chronological[i]; const seasonRows = seasonTables.get(seasonName) ?? new Map(); if (!seasonRows.has(record.id)) break; const relegatedIds = new Set((seasonConfigFor(seasonName)?.summary?.outcomes ?? []).filter(outcome => outcome.type === "relegated").flatMap(outcome => outcome.teamIds)); if (relegatedIds.has(record.id)) break; streak += 1; } record.currentStreak = streak; } for (let i = 0; i < chronological.length - 1; i += 1) { const current = seasonTables.get(chronological[i]) ?? new Map(); const following = seasonTables.get(chronological[i + 1]) ?? new Map(); if (!seasonComplete.get(chronological[i]) || !seasonComplete.get(chronological[i + 1])) continue; for (const [id] of current) if (!following.has(id)) { const record = records.get(id); if (record) record.relegated += 1; } } const titleCounts = new Map(championshipRanking.map(entry => [entry.name, entry.titles])); return [...records.values()].map(record => ({ ...record, titles: titleCounts.get(record.name) ?? 0, average: record.played ? record.points / record.played : null, logo: data.logos[record.name] })).sort((a, b) => b.points - a.points || b.diff - a.diff || a.name.localeCompare(b.name)); }, [allSeasonNames, allSeasons, championshipRanking, data.historicalMatches, data.seasonConfigs, seasons]);
  const sortedHistoricalTeamStats = useMemo(() => [...historicalTeamStats].sort((a, b) => { const left = a[recordSort] ?? 0; const right = b[recordSort] ?? 0; const comparison = typeof left === "string" && typeof right === "string" ? left.localeCompare(right) : Number(left) - Number(right); return recordDescending ? -comparison : comparison; }).filter(row => row.name.toLocaleLowerCase().includes(recordQuery.toLocaleLowerCase())), [historicalTeamStats, recordDescending, recordSort, recordQuery]);
  const stateCounts = useMemo(() => new Map([...stateParticipation].map(([state, entries]) => [state, entries.length])), [stateParticipation]); const stateClubs = useMemo(() => new Map([...stateParticipation].map(([state, entries]) => [state, entries.map(entry => entry.name)])), [stateParticipation]);
  const stateLegend = allSeasons ? [{ label: "0", className: "zero" }, { label: "1â€“2", className: "low" }, { label: "3â€“4", className: "medium" }, { label: "5â€“6", className: "high" }, { label: "7â€“9", className: "very-high" }, { label: "10+", className: "highest" }] : [{ label: "0", className: "zero" }, { label: "1â€“2", className: "low" }, { label: "3", className: "medium" }, { label: "4+", className: "highest" }];
  const move = (next: number) => { if (allSeasons) return; const nextIndex = Math.max(0, Math.min(seasons.length - 1, next)); setIndex(nextIndex); setIndividualIndex(nextIndex); };
  const toggleAllSeasons = (enabled: boolean) => { if (enabled) { setIndividualIndex(index); setAllSeasons(true); } else { setAllSeasons(false); setIndex(individualIndex); } };
  const toggleRecordSort = (key: HistoricalSortKey) => { if (recordSort === key) setRecordDescending(value => !value); else { setRecordSort(key); setRecordDescending(key !== "best" && key !== "firstSeason" && key !== "worst"); } };
  const stateEntries = activeState ? stateParticipation.get(stateKey(activeState)) ?? [] : [];
  const importedQualifications = seasonConfig?.summary?.european_qualifications ?? [];
  const importedRelegated = seasonConfig?.summary?.relegated ?? [];
  const championName = champion?.name ?? seasonConfig?.summary?.champion;
  const orderedQualifications = importedQualifications.map(item => {
    const normalized = normalize(item.competition);
    const colorCompetition = normalized === "europeancup" ? "championsleague" : normalized === "intercitiesfairscup" || normalized === "uefacup" ? "europaleague" : normalized;
    return { ...item, colorCompetition };
  }).sort((a, b) => {
    const order = ["championsleague", "cupwinnerscup", "europaleague", "conferenceleague", "intercitiesfairscup", "uefacup", "intertotocup"];
    return (order.indexOf(a.colorCompetition) < 0 ? 99 : order.indexOf(a.colorCompetition)) - (order.indexOf(b.colorCompetition) < 0 ? 99 : order.indexOf(b.colorCompetition));
  });
  const europeanQualificationRecords = useMemo(() => {
    const records = new Map<string, { name: string; total: number; seasons: Set<string>; competitions: Record<string, number> }>();
    for (const config of data.seasonConfigs ?? []) {
      if (!allSeasonNames.includes(config.season)) continue;
      for (const qualification of config.summary?.european_qualifications ?? []) {
        const competition = europeanCompetitionCanonical(qualification.competition);
        for (const team of qualification.teams) {
          const key = normalize(team);
          const record = records.get(key) ?? { name: team, total: 0, seasons: new Set<string>(), competitions: {} };
          record.name = team;
          record.seasons.add(config.season);
          record.total += 1;
          record.competitions[competition] = (record.competitions[competition] ?? 0) + 1;
          records.set(key, record);
        }
      }
    }
    return [...records.values()].map(record => {
      const recordKey = normalize(record.name);
      const matchingHistory = historicalTeamStats.find(item => { const historyKey = normalize(item.name); return historyKey === recordKey || historyKey.endsWith(recordKey) || recordKey.endsWith(historyKey); });
      return { ...record, seasons: matchingHistory?.seasons ?? record.seasons.size };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [allSeasonNames, data.seasonConfigs, historicalTeamStats]);
  const europeanCompetitionNames = europeanCompetitionOrder;
  const enterState = (name: string) => { if (stateLeaveTimer.current) clearTimeout(stateLeaveTimer.current); setHoveredState(name); };
  const leaveState = () => { stateLeaveTimer.current = setTimeout(() => { if (!selectedState) setHoveredState(null); }, 140); };
  const recordColumns: Record<HistoricalRecordView, Array<{ key: HistoricalSortKey; label: string; title: string; value: (row: HistoricalRecord) => string | number | null }>> = {
    overview: [
      { key: "seasons", label: "S", title: "Seasons played", value: row => row.seasons },
      { key: "firstSeason", label: "FS", title: "First Bundesliga season", value: row => formatSeasonShort(row.firstSeason) },
      { key: "lastSeason", label: "LS", title: "Last Bundesliga season", value: row => formatSeasonShort(row.lastSeason) },
      { key: "played", label: "MP", title: "Matches played", value: row => row.played },
      { key: "won", label: "W", title: "Wins", value: row => row.won },
      { key: "drawn", label: "D", title: "Draws", value: row => row.drawn },
      { key: "lost", label: "L", title: "Losses", value: row => row.lost },
      { key: "goalsFor", label: "GF", title: "Goals for", value: row => row.goalsFor },
      { key: "goalsAgainst", label: "GA", title: "Goals against", value: row => row.goalsAgainst },
      { key: "diff", label: "+/-", title: "Goal difference", value: row => row.diff > 0 ? `+${row.diff}` : row.diff },
      { key: "points", label: "Pts", title: "Points (standardized to three points per win)", value: row => row.points },
      { key: "average", label: "PPG", title: "Points per game", value: row => row.average === null ? null : row.average.toFixed(2) },
    ],
    attacking: [
      { key: "goalsFor", label: "GF", title: "Goals for", value: row => row.goalsFor },
      { key: "goalsAgainst", label: "GA", title: "Goals against", value: row => row.goalsAgainst },
      { key: "diff", label: "GD", title: "Goal difference", value: row => row.diff > 0 ? `+${row.diff}` : row.diff },
    ],
    achievements: [
      { key: "seasons", label: "S", title: "Seasons played", value: row => row.seasons },
      { key: "titles", label: "C", title: "Bundesliga championships", value: row => row.titles },
      { key: "runnersUp", label: "RU", title: "Runner-up finishes", value: row => row.runnersUp },
      { key: "currentStreak", label: "NR", title: "Seasons without relegation through the latest selected season", value: row => row.currentStreak },
      { key: "top3", label: "T3", title: "Top-three finishes", value: row => row.top3 },
      { key: "top5", label: "T5", title: "Top-five finishes", value: row => row.top5 },
      { key: "top10", label: "T10", title: "Top-ten finishes", value: row => row.top10 },
      { key: "relegated", label: "Rel", title: "Relegations", value: row => row.relegated },
      { key: "best", label: "Best", title: "Best finish", value: row => row.best === Number.POSITIVE_INFINITY ? null : row.best },
      { key: "worst", label: "Worst", title: "Worst finish", value: row => row.worst || null },
    ],
    european: [],
  };
  const activeRecordColumns = recordColumns[recordView];
  const europeanQualificationTable = <div className="history-alltime-table history-records-european" role="region" aria-label="European qualifications"><div className="history-alltime-row history-alltime-head"><span title="Rank">#</span><span>Club</span><span>Total EU</span><span>Breakdown</span></div>{europeanQualificationRecords.filter(row => row.name.toLocaleLowerCase().includes(recordQuery.toLocaleLowerCase())).map((row, rowIndex) => <div className="history-alltime-row" key={row.name}><span className="history-record-rank">{rowIndex + 1}</span><strong title={row.name} aria-label={row.name}><span className="history-record-club">{data.logos[row.name] && <img src={data.logos[row.name]} alt={row.name} />}</span></strong><span>{row.total}</span><span>{europeanCompetitionNames.filter(competition => row.competitions[competition]).map(competition => `${europeanCompetitionAcronyms[competition] ?? competition}: ${row.competitions[competition]}`).join(" · ")}</span></div>)}</div>;
  const europeanQualificationMatrix = <div className="history-alltime-table history-records-european" role="region" aria-label="European qualifications"><div className="history-alltime-row history-alltime-head"><span title="Rank">#</span><span title="Club name">Club</span><span title="Number of seasons with at least one qualification">S</span><span title="Total number of European qualification entries">EU</span>{europeanCompetitionOrder.map(competition => <span key={competition} title={competition}>{europeanCompetitionAcronyms[competition]}</span>)}</div>{europeanQualificationRecords.filter(row => row.name.toLocaleLowerCase().includes(recordQuery.toLocaleLowerCase())).map((row, rowIndex) => <div className="history-alltime-row" key={row.name}><span className="history-record-rank">{rowIndex + 1}</span><strong title={row.name} aria-label={row.name}><span className="history-record-club">{data.logos[row.name] && <img src={data.logos[row.name]} alt={row.name} />}</span>{row.name}</strong><span>{row.seasons}</span><span>{row.total}</span>{europeanCompetitionOrder.map(competition => <span key={competition}>{row.competitions[competition] ?? 0}</span>)}</div>)}</div>;
  const recordViewLabel = (view: HistoricalRecordView) => {
    const key = view === "overview" ? "dash.recordsOverview" : view === "achievements" ? "dash.recordsAchievements" : "dash.europeanQualifications";
    const translated = t(key);
    return view === "european" ? "Europe" : translated === key ? (view === "overview" ? "Overview" : "Achievements") : translated;
  };





















  return <main className="history-page">
    <section className="history-controls">
      <div className="history-mode-switch" role="tablist" aria-label={t("dash.historyMode")}><button type="button" role="tab" aria-selected={!allSeasons} className={!allSeasons ? "active" : ""} onClick={() => toggleAllSeasons(false)}>{t("dash.individualSeason")}</button><button type="button" role="tab" aria-selected={allSeasons} className={allSeasons ? "active" : ""} onClick={() => toggleAllSeasons(true)}>{t("dash.allTime")}</button></div>
      {!allSeasons && <>
        <button type="button" disabled={index <= 0} onClick={() => move(index - 1)} aria-label={t("dash.previousSeason")}><ChevronLeft size={16}/></button>
        <select value={index} onChange={e => move(Number(e.target.value))}>{seasons.map((value, i) => <option key={value} value={i}>{value.replace("-", " /")}</option>)}</select>
        <button type="button" disabled={index >= seasons.length - 1} onClick={() => move(index + 1)} aria-label={t("dash.nextSeason")}><ChevronRight size={16}/></button>
        <button type="button" onClick={() => move(seasons.length - 1)}>{t("dash.latestSeason")}</button>
      </>}
      {allSeasons && <>
        <label className="history-range-control"><span>{t("dash.fromSeason")}</span><select value={allFromIndex} onChange={e => { const next = Number(e.target.value); setAllFromIndex(next); if (next > allToIndex) setAllToIndex(next); }}>{seasons.map((value, i) => <option key={`from-${value}`} value={i}>{formatSeasonShort(value)}</option>)}</select></label>
        <label className="history-range-control"><span>{t("dash.toSeason")}</span><select value={allToIndex} onChange={e => { const next = Number(e.target.value); setAllToIndex(next); if (next < allFromIndex) setAllFromIndex(next); }}>{seasons.map((value, i) => <option key={`to-${value}`} value={i}>{formatSeasonShort(value)}</option>)}</select></label>
      </>}
    </section>
    <section className="history-layout">
      <div className="panel history-map-card">
        <div className="panel-heading"><div><span className="eyebrow">{allSeasons ? allTimeLabel : season.replace("-", " /")}</span><h2>{t("dash.historicalAtlas")}</h2></div><MapIcon size={20} className="muted"/></div>
        <div className="history-map-wrap">
          <svg viewBox="0 0 700 490" role="img" aria-label="Germany divided into federal states">
            <g>{stateFeatures.map((feature, i) => { const name = feature.properties.gen ?? `State ${i + 1}`; const count = stateCounts.get(stateKey(name)) ?? 0; return <g key={`${name}-${i}`} onMouseEnter={() => enterState(name)} onMouseLeave={leaveState} onClick={() => setSelectedState(current => current === name ? null : name)}><path className="history-state" d={geometryPath(feature)} fillRule="evenodd" style={{ fill: stateFill(count, allSeasons), fillOpacity: count ? 1 : .72 }} /><title>{name}: {count}</title></g>})}</g>
            <g className="history-club-connectors">{visibleClubs.filter(club => club.x !== club.anchorX || club.y !== club.anchorY).map(club => <line key={club.id} x1={club.anchorX} y1={club.anchorY} x2={club.x} y2={club.y} />)}</g>
            <g>{visibleClubs.map(club => <g key={club.id} className="history-club" transform={`translate(${club.x} ${club.y})`} tabIndex={0} aria-label={club.name}><title>{club.name}{club.city ? ` Â· ${club.city}` : ""}{club.stadium ? ` Â· ${club.stadium}` : ""}{club.state ? ` Â· ${club.state}` : ""}</title>{club.logo && <image href={club.logo} x="-13" y="-13" width="26" height="26" opacity={club.opacity ?? 1} preserveAspectRatio="xMidYMid meet" />}</g>)}</g>
          </svg>
          {activeState && (allSeasons ? <div className="history-state-tooltip history-state-tooltip-chart" onMouseEnter={() => { if (stateLeaveTimer.current) clearTimeout(stateLeaveTimer.current); enterState(activeState); }} onMouseLeave={() => { if (!selectedState) setHoveredState(null); }}><strong>{activeState}</strong><span>{allTimeLabel} Â· {stateEntries.length} {t("dash.clubs")}</span><div className="history-state-bars">{stateEntries.map(entry => <div className="history-state-bar-row" key={entry.id}><span>{entry.name}</span><i><b style={{ width: `${Math.max(8, (entry.seasons / Math.max(1, stateEntries[0]?.seasons ?? 1)) * 100)}%` }} /></i><em>{entry.seasons}</em></div>)}</div></div> : <div className="history-state-tooltip" onMouseEnter={() => { if (stateLeaveTimer.current) clearTimeout(stateLeaveTimer.current); enterState(activeState); }} onMouseLeave={() => { if (!selectedState) setHoveredState(null); }}><strong>{activeState}</strong><span>{season.replace("-", " /")} Â· {stateEntries.length} {t("dash.clubs")}</span><small>{stateClubs.get(stateKey(activeState))?.join(", ")}</small></div>)}
          <div className={`history-legend ${allSeasons ? "history-legend-alltime" : "history-legend-season"}`}><strong>{t("dash.bundesligaClubsByState")}</strong>{stateLegend.map(item => <span key={item.className}><i className={item.className}/>{item.label}</span>)}</div>
        </div>
      </div>
      <aside className="panel history-summary">
        <div className="panel-heading"><div><span className="eyebrow">{allSeasons ? allTimeLabel : season.replace("-", " /")}</span><h2>{allSeasons ? t("dash.allTimeOverview") : t("dash.seasonSummary")}</h2></div></div>
        {allSeasons ? <>
          <div className="history-kpis"><span>{t("dash.clubs")}<b>{new Set(matches.flatMap(m => [m.homeId, m.awayId])).size}</b></span><span>{t("dash.seasons")}<b>{allSeasonNames.length}</b></span></div>
          <h3 className="history-section-title">{t("dash.champions")}</h3><div className="history-ranking history-champions">{championshipRanking.map(entry => <div className="history-champion-entry" key={entry.name}><div className="history-champion-heading"><span className="history-champion-club">{data.logos[entry.name] && <img src={data.logos[entry.name]} alt="" />}</span><strong>{entry.name}</strong><b title={entry.seasons.map(formatSeasonShort).join(", ")} aria-label={`${entry.titles} championships`}><Trophy size={16}/><span>{entry.titles}</span></b></div></div>)}</div>
        </> : <>
          <div className="history-kpis history-season-kpis"><span>Total games<b>{matches.length}</b></span><span>Total goals<b>{seasonGoalStats.totalGoals}</b></span><span>Average goals per game<b>{seasonGoalStats.averageGoals.toFixed(2)}</b></span></div>
          <div className="history-record-cards"><div className="history-record-card"><span>Largest home win</span>{recordMatch(seasonGoalStats.largestHomeWin)}</div><div className="history-record-card"><span>Largest away win</span>{recordMatch(seasonGoalStats.largestAwayWin)}</div></div>
          {championName && <div className="history-champion-block"><span className="history-summary-label">{t("dash.championLabel")}</span><p className="history-champion"><Trophy size={15}/> {championName}</p></div>}
          {importedQualifications.length > 0 && <div className="history-outcome-groups"><strong>{t("dash.europeanQualifications")}</strong>{orderedQualifications.map(item => <div className={`history-outcome-group competition-${item.colorCompetition}`} key={item.competition}><span>{item.competition}</span><em>{item.teams.join(", ")}</em></div>)}</div>}
          {importedRelegated.length > 0 && <div className="history-outcome-groups history-relegated-groups"><div className="history-outcome-group competition-relegated"><span>{t("dash.relegated")}</span><em>{importedRelegated.join(", ")}</em></div></div>}
        </>}
      </aside>
    </section>
        {allSeasons && <section className="panel history-alltime-wide">
      <div className="history-records-heading"><div><h3 className="history-section-title">{t("dash.historicalRecords")}</h3><p className="history-records-caption">{t("dash.allTimeModeDescription")}</p></div><label className="history-record-search"><span className="sr-only">{t("dash.club")}</span><input value={recordQuery} onChange={e => setRecordQuery(e.target.value)} placeholder={t("dash.searchClubs")} /></label></div>
      <div className="history-record-tabs" role="tablist" aria-label="Historical records views">
        {(["overview", "achievements", "european"] as HistoricalRecordView[]).map(view => <button key={view} type="button" role="tab" aria-selected={recordView === view} className={recordView === view ? "active" : ""} onClick={() => setRecordView(view)}>{recordViewLabel(view)}</button>)}
      </div>
      {recordView !== "european" && <div className={`history-alltime-table history-records-${recordView}`} role="region" aria-label={t("dash.historicalRecords")}>
        <div className="history-alltime-row history-alltime-head"><span title="Rank">#</span><span title={t("dash.clubs")}>Club</span>{activeRecordColumns.map(column => <button key={column.key} title={column.title} type="button" onClick={() => toggleRecordSort(column.key)}>{column.label}</button>)}</div>
        {sortedHistoricalTeamStats.map((row, rowIndex) => <div className="history-alltime-row" key={row.id}><span className="history-record-rank">{rowIndex + 1}</span><strong><span className="history-record-club">{row.logo && <img src={row.logo} alt="" />}</span>{row.name}</strong>{activeRecordColumns.map(column => { const value = column.value(row); const className = column.key === "diff" ? row.diff > 0 ? "positive" : row.diff < 0 ? "negative" : "" : ""; return <span key={column.key} className={className}>{value ?? "—"}</span>; })}</div>)}
      </div>} {recordView === "european" && europeanQualificationMatrix}
    </section>}
    <footer className="history-source">{`${t("dash.boundarySource")}, EPSG:25832, downloaded from the official BKG WFS. ${t("dash.clubLocationsPending")}${unresolved.length ? ` \u2014 unresolved: ${unresolved.map(entry => entry.name).join(", ")}` : ""}.`}</footer>
  </main>;
}
