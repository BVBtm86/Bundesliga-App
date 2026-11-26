import { attackingChannel, physicalPitchThird } from "./positional-analysis";
export type DistributionMode="territory"|"channels";
export type DistributionBasis="full"|"stage"|"perMatch";
export type ZoneCounts=[number,number,number];
export const TERRITORY_CATEGORIES=["passing","shots","dribbles","touches"];
export const POSITIVE_PASS="successful|complete",POSITIVE_DRIBBLE="successful|won",NEGATIVE_OUTCOME="unsuccessful|incomplete|failed|lost";
export type PositionalEvent={category?:string;x?:number;y?:number;passSuccessful?:boolean;outcome?:string};
export function positionalPassOutcome(event:PositionalEvent):boolean|undefined {
 if(typeof event.passSuccessful==="boolean")return event.passSuccessful;
 const text=event.outcome??"";
 if(new RegExp(NEGATIVE_OUTCOME,"i").test(text))return false;
 return new RegExp(POSITIVE_PASS,"i").test(text)?true:undefined;
}
export function attackingEvent(event:PositionalEvent){
 return event.category==="shots"||event.category==="passing"&&positionalPassOutcome(event)===true||event.category==="dribbles"&&new RegExp(POSITIVE_DRIBBLE,"i").test(event.outcome??"")&&!new RegExp(NEGATIVE_OUTCOME,"i").test(event.outcome??"");
}
export function validSpatialPoint(x:unknown,y:unknown):x is number {return typeof x==="number"&&typeof y==="number"&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=100&&y>=0&&y<=100;}
export function aggregatePositionalEvents<T extends PositionalEvent>(events:T[],point:(event:T)=>{x?:number;y?:number}=event=>({x:event.x,y:event.y})){
 const channels:ZoneCounts=[0,0,0],thirds:ZoneCounts=[0,0,0],shots:ZoneCounts=[0,0,0];
 for(const event of events){const p=point(event);if(!validSpatialPoint(p.x,p.y))continue;
  if(attackingEvent(event))channels[physicalPitchThird(p.y!)]++;
  if(event.category==="shots")shots[physicalPitchThird(p.y!)]++;
  if(TERRITORY_CATEGORIES.includes(event.category??""))thirds[physicalPitchThird(p.x!)]++;
 }
 return {channels,thirds,shots,attackingTotal:channels.reduce((a,b)=>a+b,0),territorialTotal:thirds.reduce((a,b)=>a+b,0),shotsTotal:shots.reduce((a,b)=>a+b,0)};
}
/** Provider coordinates already attack toward x=100. Against uses the selected club's perspective. */
export function distributionZone(x:number,y:number,mode:DistributionMode,against=false){
 return mode==="territory"?physicalPitchThird(against?100-x:x):against?physicalPitchThird(y):attackingChannel(y);
}
export const zoneLabels=(mode:DistributionMode)=>mode==="territory"?["Defensive third","Middle third","Attacking third"]:["Left channel","Central channel","Right channel"];
export const zoneColours=["#6389aa","#8f83b5","#54a89c"];
export function zonePercentages(counts:ZoneCounts):[number,number,number]|null {const total=counts.reduce((a,b)=>a+b,0);return total>0?counts.map(value=>100*value/total) as ZoneCounts:null;}
export const addZones=(a:ZoneCounts,b:ZoneCounts)=>a.map((value,index)=>value+b[index]) as ZoneCounts;
export type DistributionFixture={id:number;season:string;week:number;date:string;homeId:number;awayId:number;home:string;away:string;finished:boolean;homeGoals:number|null;awayGoals:number|null;cancelled?:boolean};
export type DistributionSeasonMeta={season:string;complete:boolean;teams:{id:number;name:string;logo?:string;played:number}[];fixtures:DistributionFixture[]};
export function distributionMatches(fixtures:DistributionFixture[],team:number,venue:"all"|"home"|"away",from=1,to=34){
 return fixtures.filter(match=>match.finished&&match.homeGoals!==null&&match.awayGoals!==null&&match.week>=from&&match.week<=to&&((venue!=="away"&&match.homeId===team)||(venue!=="home"&&match.awayId===team))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id-b.id);
}
export type DistributionStatus="complete"|"partial"|"unavailable"|"insufficient"|"ongoing"|"no-events"|"absent";
export type SpatialDistribution={season:string;team:number;name:string;logo?:string;ongoing:boolean;status:DistributionStatus;included:number;available:number;covered:number;counts:{territory:ZoneCounts;channels:ZoneCounts};league?:{counts:{territory:ZoneCounts;channels:ZoneCounts};clubs:number;matches:number;events:number}};
export type SpatialDistributionResponse={samples:SpatialDistribution[];stage:number|null;basis:DistributionBasis;perspective:string;methodology:string};
export const SPATIAL_METHODOLOGY="Spatial distributions are based on recorded event locations, not possession time or continuous player tracking.";
export function distributionValue(sample:SpatialDistribution|undefined,mode:DistributionMode,zone:number){return sample?.status==="complete"?zonePercentages(sample.counts[mode])?.[zone]??null:null;}
