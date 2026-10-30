"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPinned, Pause, Play, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { standings } from "@/lib/analytics";
import type { Dashboard, Match } from "@/lib/types";

type Props = { data: Dashboard; onTeamSelect?: (teamId: number, season: string) => void };
type Club = { id: number; name: string; x: number; y: number; city: string; state: string; logo?: string; seasons: number };

// Verified city coordinates for clubs represented by the imported Bundesliga archive.
// Unknown historical clubs remain visible in the season summary but are not placed on the map.
const cityCoordinates: Record<string, [number, number, string, string]> = {
  bayernmunich:[11.58,48.14,"Munich","Bavaria"], borussiadortmund:[7.46,51.51,"Dortmund","North Rhine-Westphalia"], schalke04:[7.07,51.55,"Gelsenkirchen","North Rhine-Westphalia"],
  borussiamonchengladbach:[6.44,51.18,"Mönchengladbach","North Rhine-Westphalia"], eintrachtfrankfurt:[8.68,50.11,"Frankfurt","Hesse"], werderbremen:[8.80,53.08,"Bremen","Bremen"],
  hamburger:[9.99,53.55,"Hamburg","Hamburg"], hamburgersv:[9.99,53.55,"Hamburg","Hamburg"], herthaberlin:[13.40,52.52,"Berlin","Berlin"], unionberlin:[13.43,52.46,"Berlin","Berlin"],
  rbleipzig:[12.37,51.34,"Leipzig","Saxony"], bayer04leverkusen:[6.99,51.03,"Leverkusen","North Rhine-Westphalia"], scfreiburg:[7.85,48.00,"Freiburg","Baden-Württemberg"],
  vfbstuttgart:[9.18,48.78,"Stuttgart","Baden-Württemberg"], hoffenheim:[8.73,49.25,"Sinsheim","Baden-Württemberg"], tsghoffenheim:[8.73,49.25,"Sinsheim","Baden-Württemberg"],
  vflwolfsburg:[10.79,52.42,"Wolfsburg","Lower Saxony"], fcaugsburg:[10.90,48.37,"Augsburg","Bavaria"], mainz05:[8.27,49.99,"Mainz","Rhineland-Palatinate"],
  fsvmainz05:[8.27,49.99,"Mainz","Rhineland-Palatinate"], fcstpauli:[9.97,53.55,"Hamburg","Hamburg"], bochum:[7.22,51.48,"Bochum","North Rhine-Westphalia"],
  vflbochum:[7.22,51.48,"Bochum","North Rhine-Westphalia"], fckoeln:[6.96,50.94,"Cologne","North Rhine-Westphalia"], fckoln:[6.96,50.94,"Cologne","North Rhine-Westphalia"],
  hannover96:[9.73,52.37,"Hannover","Lower Saxony"], nuernberg:[11.08,49.45,"Nuremberg","Bavaria"], "1fcnurnberg":[11.08,49.45,"Nuremberg","Bavaria"],
  kaiserslautern:[7.77,49.44,"Kaiserslautern","Rhineland-Palatinate"], arminiabielefeld:[8.53,52.03,"Bielefeld","North Rhine-Westphalia"], darmstadt:[8.65,49.87,"Darmstadt","Hesse"],
  svdarmstadt9:[8.65,49.87,"Darmstadt","Hesse"], paderborn:[8.75,51.72,"Paderborn","North Rhine-Westphalia"], scpaderborn07:[8.75,51.72,"Paderborn","North Rhine-Westphalia"],
  braunschweig:[10.52,52.27,"Braunschweig","Lower Saxony"], eintrachtbraunschweig:[10.52,52.27,"Braunschweig","Lower Saxony"], fortunaduesseldorf:[6.77,51.23,"Düsseldorf","North Rhine-Westphalia"],
  greutherfurth:[10.99,49.48,"Fürth","Bavaria"], heidenheim:[10.67,48.68,"Heidenheim","Baden-Württemberg"], fcheidenheim:[10.67,48.68,"Heidenheim","Baden-Württemberg"],
  holsteinkiel:[10.12,54.32,"Kiel","Schleswig-Holstein"], elversberg:[6.99,49.30,"Elversberg","Saarland"]
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const keyFor = (name: string) => { const key = normalize(name).replace(/^fc/, ""); return key === "bayer04leverkusen" ? key : key; };
const projection = (lon: number, lat: number) => ({ x: 66 + ((lon - 5.8) / 11.2) * 448, y: 274 - ((lat - 47.2) / 8.5) * 240 });
const finished = (m: Match) => m.finished && m.homeGoals !== null && m.awayGoals !== null;

function Crest({ club, size = 27 }: { club: Club; size?: number }) { return club.logo ? <img src={club.logo} alt="" width={size} height={size} loading="lazy" /> : <span className="historical-map-initials">{club.name.split(/\s+/).map(s => s[0]).join("").slice(0, 3)}</span>; }

export default function HistoricalBundesligaMap({ data, onTeamSelect }: Props) {
  const { t } = useI18n();
  const seasons = data.seasons;
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [allTime, setAllTime] = useState(false);
  const season = seasons[seasonIndex] ?? data.season;
  const seasonMatches = useMemo(() => (allTime ? data.historicalMatches : data.historicalMatches.filter(m => m.season === season || (!m.season && season === data.season))), [allTime, data.historicalMatches, data.season, season]);
  const participants = useMemo(() => { const map = new Map<number, { id: number; name: string; matches: Match[] }>(); for (const m of seasonMatches) for (const [id, name] of [[m.homeId, m.home], [m.awayId, m.away]] as const) { const row = map.get(id) ?? { id, name, matches: [] }; row.matches.push(m); map.set(id, row); } return [...map.values()]; }, [seasonMatches]);
  const clubs = useMemo<Club[]>(() => participants.map(entry => { const coord = cityCoordinates[keyFor(entry.name)]; const p = coord ? projection(coord[0], coord[1]) : null; const seasonsPlayed = new Set(data.historicalMatches.filter(m => m.homeId === entry.id || m.awayId === entry.id).map(m => m.season)).size; return { id: entry.id, name: entry.name, x: p?.x ?? 290, y: p?.y ?? 150, city: coord?.[2] ?? "Location unavailable", state: coord?.[3] ?? "Location unavailable", logo: data.logos[entry.name], seasons: seasonsPlayed }; }).filter(c => allTime || c.x !== 290 || c.y !== 150), [allTime, data.historicalMatches, data.logos, participants]);
  const selectedSeasonConfig = data.seasonConfigs?.find(config => config.season === season);
  const table = useMemo(() => standings(seasonMatches.filter(finished), "all", [], selectedSeasonConfig?.rules?.pointsForWin ?? 3, selectedSeasonConfig?.standingsTiebreakers, selectedSeasonConfig?.rules?.pointsForDraw ?? 1, selectedSeasonConfig), [seasonMatches, selectedSeasonConfig]);
  const selectedClub = clubs.find(c => c.id === selected) ?? null;
  const summaryMatches = seasonMatches.filter(finished); const goals = summaryMatches.reduce((sum, m) => sum + (m.homeGoals ?? 0) + (m.awayGoals ?? 0), 0);
  const champion = table[0]; const states = [...new Set(clubs.map(c => c.state).filter(s => s !== "Location unavailable"))];
  useEffect(() => { if (!playing) return; const id = window.setInterval(() => setSeasonIndex(index => index >= seasons.length - 1 ? 0 : index + 1), 1800); return () => window.clearInterval(id); }, [playing, seasons.length]);
  const moveSeason = (next: number) => { setPlaying(false); setSelected(null); setSeasonIndex(Math.max(0, Math.min(seasons.length - 1, next))); };
  return <section className="panel historical-map-panel"><div className="panel-heading"><div><span className="eyebrow">{t("dash.historicalMapEyebrow")}</span><h2>{t("dash.historicalMapTitle")}</h2><p>{t("dash.historicalMapDescription")}</p></div><MapPinned size={21} className="muted" /></div><div className="historical-map-toolbar"><button type="button" onClick={() => moveSeason(seasonIndex - 1)} aria-label={t("dash.previousSeason")}><ChevronLeft size={15}/></button><select value={seasonIndex} onChange={e => moveSeason(Number(e.target.value))}>{seasons.map((value, index) => <option key={value} value={index}>{value.replace("-", " / ")}</option>)}</select><button type="button" onClick={() => setPlaying(value => !value)} aria-label={playing ? t("dash.pauseHistory") : t("dash.playHistory")}>{playing ? <Pause size={14}/> : <Play size={14}/>}</button><button type="button" onClick={() => moveSeason(seasonIndex + 1)} aria-label={t("dash.nextSeason")}><ChevronRight size={15}/></button><button type="button" className="historical-map-latest" onClick={() => moveSeason(0)}>{t("dash.latestSeason")}</button><label className="historical-map-mode"><input type="checkbox" checked={allTime} onChange={e => { setAllTime(e.target.checked); setPlaying(false); setSelected(null); }} /> {t("dash.allTime")}</label></div><div className="historical-map-layout"><div className="historical-map-canvas"><svg viewBox="0 0 580 330" role="img" aria-label={`${t("dash.historicalMapTitle")} ${season}`}><path className="germany-outline" d="M157 24L227 14L301 28L375 20L448 43L493 86L510 150L489 206L506 262L454 295L385 304L331 292L270 308L212 291L154 303L109 270L79 221L88 169L69 121L102 78Z"/><path className="germany-state-line" d="M157 24L180 105L150 175L212 291M227 14L270 110L270 308M301 28L330 133L331 292M375 20L360 114L385 304M448 43L410 139L454 295M102 78L250 78L448 43M79 221L270 214L489 206"/>{clubs.map(club => <g key={club.id} className={`historical-map-marker ${selected === club.id ? "selected" : ""}`} tabIndex={0} role="button" aria-label={club.name} transform={`translate(${club.x},${club.y})`} onMouseEnter={() => setSelected(club.id)} onFocus={() => setSelected(club.id)} onMouseLeave={() => setSelected(null)} onBlur={() => setSelected(null)} onClick={() => onTeamSelect?.(club.id, season)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onTeamSelect?.(club.id, season); }}><circle r={selected === club.id ? 20 : 16}/><foreignObject x={-14} y={-14} width={28} height={28}><Crest club={club} size={27}/></foreignObject></g>)}</svg></div><aside className="historical-map-summary"><div className="historical-map-summary-heading"><span className="eyebrow">{allTime ? t("dash.allTime") : season.replace("-", " / ")}</span><h3>{selectedClub?.name ?? t("dash.seasonSummary")}</h3></div>{selectedClub ? <div className="historical-map-club-detail"><Crest club={selectedClub} size={42}/><strong>{selectedClub.city}</strong><span>{selectedClub.state}</span><small>{selectedClub.seasons} {t("dash.seasonsPlayed")}</small><button type="button" onClick={() => onTeamSelect?.(selectedClub.id, season)}>{t("teamAnalysis.openAnalysis")}</button></div> : <><div className="historical-map-summary-grid"><span>{t("dash.participatingClubs")}<b>{participants.length}</b></span><span>{t("dash.totalMatches")}<b>{summaryMatches.length}</b></span><span>{t("dash.totalGoals")}<b>{goals}</b></span><span>{t("dash.averageGoals")}<b>{summaryMatches.length ? (goals / summaryMatches.length).toFixed(2) : "—"}</b></span></div><p className="historical-map-champion"><Trophy size={15}/> {champion ? `${t("dash.champions")}: ${champion.name}` : t("dash.noHistoricalSummary")}</p><div className="historical-map-mini-table">{table.slice(0, 8).map((row, index) => <div key={row.id}><span>{index + 1}</span><strong>{row.name}</strong><b>{row.points}</b></div>)}</div></>}</aside></div><div className="historical-map-footer"><span>{t("dash.regionalDistribution")}: {states.length ? states.length : "—"}</span><span>{allTime ? t("dash.allTimeModeDescription") : t("dash.seasonModeDescription")}</span></div></section>;
}

