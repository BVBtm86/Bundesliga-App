import type { SpatialLineup, FormationUsage } from "./season-spatial-lineup";
import type { SpatialShot } from "./spatial-shots";
import type { PassingNetworkEdge } from "./passing-network";

export type SpatialPoint = { x: number; y: number };

// Match Report Gaussian bandwidth on a 0–100 pitch.
export function spatialDensity(points: readonly SpatialPoint[], columns = 40, rows = 26): number[] {
  const bandwidthSquared = 2 * 6.5 ** 2;
  return Array.from({length: columns * rows}, (_, index) => {
    const x = (index % columns + .5) * 100 / columns;
    const y = (Math.floor(index / columns) + .5) * 100 / rows;
    return points.reduce((sum, point) => sum + Math.exp(-((x - point.x) ** 2 + (y - point.y) ** 2) / bandwidthSquared), 0);
  });
}

// Provider points are attacking-relative for both teams and halves. Rotate the
// pitch to portrait with the opponent goal at the top and preserve channel handedness.
export function portraitEventPoint(x: unknown, y: unknown): SpatialPoint | null {
  if (typeof x !== "number" || typeof y !== "number" || !(x >= 0 && x <= 100 && y >= 0 && y <= 100)) return null;
  return { x: 100 - y, y: 100 - x };
}

export const spatialCategoryPriority=[["pass", "passing"], ["shot", "shots"], ["dribble", "dribbles"], ["tackle", "tackles"], ["interception", "interceptions"], ["clearance", "clearances"], ["offside", "offside"], ["aerial", "aerial"], ["error", "error"], ["save", "save"], ["claim", "claim"], ["punch", "punch"], ["recovery", "recoveries"], ["foul", "fouls"], ["loss", "losses"], ["touch", "touches"]] as const;
export const spatialCategory=(row:{categories?:unknown})=>{const values=Array.isArray(row.categories)?row.categories:[];return spatialCategoryPriority.find(([raw])=>values.includes(raw))?.[1]??"other";};
export const heatColor=(value:number)=>{const stops=[[27,143,120],[159,207,63],[245,197,66],[240,122,33],[217,47,50]];const t=Math.max(0,Math.min(1,value));const scaled=t*(stops.length-1);const index=Math.min(stops.length-2,Math.floor(scaled));const fraction=scaled-index;const a=stops[index],b=stops[index+1];return `rgb(${Math.round(a[0]+(b[0]-a[0])*fraction)}, ${Math.round(a[1]+(b[1]-a[1])*fraction)}, ${Math.round(a[2]+(b[2]-a[2])*fraction)})`};

export const eventHeatmapGrid=(portrait=false)=>portrait?{columns:26,rows:40}:{columns:40,rows:26};

export function eventHeatmapDensity(points:readonly SpatialPoint[],portrait=false){
  const {columns,rows}=eventHeatmapGrid(portrait);
  return spatialDensity(points,columns,rows);
}
export const spatialModes = ["events", "shots", "lineup", "average", "network", "passing", "progressive", "defending"] as const;
export const defensiveCategories = ["recoveries", "interceptions", "tackles", "clearances"] as const;
export const eventCategories = ["all", "touches", "passing", "progressive", "defensive", "shots", "dribbles", ...defensiveCategories, "aerial", "fouls", "losses", "offside", "error", "save", "claim", "punch", "other", "final-third"] as const;
export const shotOutcomes = ["all", "goal", "on target", "off target", "blocked", "woodwork", "own goal", "unclassified"] as const;

export function sharedComparisonDensity(points: readonly SpatialPoint[], matches: number): number[] {
  if (!matches) return [];
  return eventHeatmapDensity(points,true).map(value=>value/matches);
}

export type SpatialMarker = SpatialPoint & { key: string; label: string; number?: number; outcome?: string;
  matchId?: number; player?: string; minute?: number; position?: string; eventCount?: number; starts?:number; minutes?:number; passOutcomes?:{known:number;completed:number} };
export type SpatialFixture = { id: number; week: number; opponent: string; venue: "home" | "away" };
export type SpatialComparisonData = {
  matches: SpatialFixture[];
  selectedMatch: number | null;
  eligible: number;
  covered: number;
  invalid: number;
  count: number;
  density: number[];
  markers: SpatialMarker[];
  shots?:SpatialShot[];
  edges?: PassingNetworkEdge[];
  lineup?: SpatialLineup;
  formationDistribution?: {matches:number;rows:FormationUsage[]};
};

/** Both inputs are already normalized using the same option and portrait grid. */
export function spatialDensityDifference(baseline:readonly number[],comparison:readonly number[]) {
  const {columns,rows}=eventHeatmapGrid(true);
  if(baseline.length!==columns*rows||comparison.length!==baseline.length||
    !baseline.every(Number.isFinite)||!comparison.every(Number.isFinite)) return null;
  const values=comparison.map((value,index)=>value-baseline[index]);
  return {values,max:Math.max(...values.map(value=>Math.abs(value)))};
}
