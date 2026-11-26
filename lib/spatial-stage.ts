export function spatialStageRows<T extends {season?:string;game_id:number;game_date?:unknown;home_goals?:unknown;away_goals?:unknown}>(rows:T[],season:string,comparisonSeason:string) {
 const completed=rows.filter(row=>Number.isInteger(row.home_goals)&&Number.isInteger(row.away_goals)&&Number(row.home_goals)>=0&&Number(row.away_goals)>=0);
 const primary=completed.filter(row=>row.season===season),comparison=completed.filter(row=>row.season===comparisonSeason);
 const stage=Math.min(primary.length,comparison.length);
 const time=(value:unknown)=>value instanceof Date?value.getTime():Date.parse(String(value??""));
 return primary.sort((a,b)=>(time(a.game_date)-time(b.game_date)||a.game_id-b.game_id)).slice(0,stage);
}
