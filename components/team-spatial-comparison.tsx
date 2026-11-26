"use client";

import { Activity, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Crosshair, Flame, Info, Network, Shirt, Users, Map as MapIcon } from "lucide-react";
import type { SeasonScope } from "@/lib/team-season-comparison";
import type { PassingNetworkEdge } from "@/lib/passing-network";
import { ShotCard, ShotPlot, shotSymbols, goalMouthPoint, isDisplayShot, type DisplayShot, type DisplayShotOutcome, type ShotView } from "./spatial-shot-analysis";
import type { Dashboard } from "@/lib/types";
import {
  eventCategories,
  type SpatialComparisonData, type SpatialMarker
} from "@/lib/spatial-density";
import { spatialDensityDifference } from "@/lib/spatial-density";
import AggregatedSpatialWorkspace from "./aggregated-spatial-workspace";
import { EventHeatmap, EventHeatmapLegend, EventPitchMarkings } from "./event-heatmap";
import PassingPartners from "./passing-partners";
import TacticalPitch from "./tactical-pitch";

const modes = [
  ["lineup", "Starting Lineup", Shirt], ["average", "Average Positions", Users],
  ["network", "Passing Networks", Network], ["shots", "Shot Analysis", Crosshair],
  ["events", "Event Heatmaps", Flame],
  ["distribution", "Positional Analysis", MapIcon]
] as const;
const shotOutcomeOptions=Object.keys(shotSymbols) as DisplayShotOutcome[];
const minimumNetworkPasses=10;
const colors = ["#ff587a", "#80baff"];
type Result = {url:string; data:SpatialComparisonData|null; error:boolean};
type MarkerReference = {side:0|1;url:string;key:string;anchor:SVGElement};
type ConnectionReference = {side:0|1;url:string;from:number;to:number;label:string;anchor:SVGElement};
const densityOptions = {
  match:{label:"Event frequency (per match)",help:"Shows how often events occur in each area per covered match."},
  distribution:{label:"Spatial distribution (%)",help:"Shows each area’s share of the club’s plotted events, independent of event volume."}
};
const capitalize = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
const decimals = new Intl.NumberFormat(undefined, {maximumFractionDigits:2});
const useSpatialData = (url: string|null) => {
  const [loaded, setLoaded] = useState<Result | null>(null);
  useEffect(() => {
    if(!url)return;
    const controller = new AbortController();
    fetch(url, {signal:controller.signal}).then(async response => {
      if (!response.ok) throw new Error("Spatial request failed");
      const data = await response.json() as SpatialComparisonData;
      if (!controller.signal.aborted) setLoaded({url,data,error:false});
    }).catch(() => {
      if (!controller.signal.aborted) setLoaded({url,data:null,error:true});
    });
    return () => controller.abort();
  }, [url]);
  return loaded?.url === url ? loaded : null;
};

function Pitch({title, logo, caption, details, density, children, coverage, side, onClear, shotPlot, shotSurface, showAttack=true}: {
  title:string;logo?:string;caption?:string;details?:string;density?:ReactNode;children:ReactNode;coverage:ReactNode;side:"a"|"b"|"difference";onClear?:()=>void;shotPlot?:ReactNode;shotSurface?:string;showAttack?:boolean
}) {
  const detailsId=useId();
  return <figure className="spatial-comparison-figure" data-side={side}>
    <figcaption aria-describedby={details?detailsId:undefined}>
      {details&&<span className="sr-only" id={detailsId}>{details}</span>}
      <span className="spatial-pitch-club">{logo&&<img src={logo} alt=""/>}<span><strong>{title}</strong>{caption&&<small className="spatial-pitch-caption">{caption}</small>}</span></span>
      {showAttack&&<small>Attack ↑</small>}
    </figcaption>
    <div className={`spatial-comparison-pitch${shotSurface?` ${shotSurface}`:""}${density?" event-heatmap-pitch portrait":""}`}>
      {shotPlot??<>{density}
      {density?<EventPitchMarkings portrait/>:<TacticalPitch portrait/>}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={title + " portrait pitch"}
        onClick={event=>{if(event.target===event.currentTarget)onClear?.();}}>{children}</svg></>}
    </div>
    {coverage}
  </figure>;
}

const portraitRatio=68/105;
const surnames=(name:string)=>name.trim().split(/\s+/).at(-1)??name;

function Markers({data,color,involvement,involvementMax,highlighted,activeKey,selectedKey,cardId,onPreview,onSelect,onClear}: {
  data:SpatialComparisonData;color:string;involvement:Map<number,number>;involvementMax:number;
  highlighted:Set<string>|null;activeKey?:string;selectedKey?:string;cardId:string;
  onPreview:(key:string|null,anchor?:SVGElement)=>void;onSelect:(key:string,anchor:SVGElement)=>void;onClear:()=>void;
}) {
  const nodes=data.markers.map(marker=>({
    marker,radius:3.4*(involvementMax?Math.sqrt(1+1.2*(involvement.get(Number(marker.key))??0)/involvementMax):1)
  }));
  const labels=new Map<string,{text:string;offset:number}>();
  const occupied:{left:number;right:number;top:number;bottom:number}[]=[];
  const ordered=[...nodes].sort((a,b)=>Number(b.marker.key===activeKey)-Number(a.marker.key===activeKey));
  for(const {marker,radius} of ordered){
    if(!marker.player)continue;
    const text=surnames(marker.player);
    const halfWidth=text.length*.91+1;
    const y=marker.y/portraitRatio;
    const offset=radius+1.5;
    const box={left:marker.x-halfWidth,right:marker.x+halfWidth,top:y+offset,bottom:y+offset+3.5};
    const collides=nodes.some(({marker:other,radius:otherRadius})=>{
      const cy=other.y/portraitRatio;
      return other.key!==marker.key&&other.x+otherRadius>box.left&&other.x-otherRadius<box.right&&
        cy+otherRadius>box.top&&cy-otherRadius<box.bottom;
    });
    if(collides||box.left<0||box.right>100||box.bottom>100/portraitRatio||
      occupied.some(item=>item.left<box.right&&item.right>box.left&&item.top<box.bottom&&item.bottom>box.top))continue;
    occupied.push(box);
    labels.set(marker.key,{text,offset});
  }
  return <g>{nodes.map(({marker,radius}) => {
    const label=labels.get(marker.key);
    return <g key={marker.key} transform={`translate(${marker.x} ${marker.y})`}
      className={`spatial-event-marker${marker.key===activeKey?" active":""}${highlighted?(highlighted.has(marker.key)?" connected":" muted"):""}`}
      tabIndex={0} role="button" aria-label={marker.label} aria-pressed={marker.key===selectedKey}
      aria-describedby={marker.key===activeKey?cardId:undefined}
      onPointerEnter={event=>{if(event.pointerType!=="touch")onPreview(marker.key,event.currentTarget);}}
      onPointerLeave={event=>{if(event.pointerType!=="touch")onPreview(null);}}
      onFocus={event=>onPreview(marker.key,event.currentTarget)} onBlur={()=>onPreview(null)}
      onClick={event=>onSelect(marker.key,event.currentTarget)}
      onKeyDown={event=>{
        if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(marker.key,event.currentTarget);}
        if(event.key==="Escape")onClear();
      }}>
      <g transform={`scale(1 ${portraitRatio})`}>
        {(marker.key===activeKey||marker.key===selectedKey)&&<circle r={radius+.72} stroke={color} className="spatial-player-ring" aria-hidden="true"/>}
        <circle r={radius} stroke={color} className="spatial-player-dot"/>
        {marker.number!=null&&<text className="spatial-player-number" textAnchor="middle" dominantBaseline="central">{marker.number}</text>}
        {label&&<text className="spatial-player-surname" textAnchor="middle" dominantBaseline="hanging" y={label.offset}>{label.text}</text>}
      </g>
    </g>;
  })}</g>;
}

function FloatingCard({anchor,children,network,id}: {anchor:SVGElement;children:ReactNode;network?:boolean;id?:string}){
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const place=()=>{
      const card=ref.current;
      if(!card||!anchor.isConnected)return;
      const point=(anchor.querySelector(".spatial-player-dot")??anchor).getBoundingClientRect();
      const pitch=anchor.closest(".spatial-comparison-pitch")?.getBoundingClientRect();
      const {width,height}=card.getBoundingClientRect();
      const maxX=Math.max(8,document.documentElement.clientWidth-width-8);
      const maxY=Math.max(8,window.innerHeight-height-8);
      const right=point.right+8;
      const left=point.left-width-8;
      const pitchRight=Math.min(maxX,(pitch?.right??Infinity)-width);
      const outerLeft=anchor.closest("figure")?.dataset.side==="a";
      const preferred=right<=pitchRight?right:left>=Math.max(8,pitch?.left??0)?left:
        outerLeft&&left>=8?left:right<=maxX?right:left;
      const top=Math.max(8,pitch?.top??0);
      const bottom=Math.min(maxY,(pitch?.bottom??Infinity)-height);
      card.style.left=`${Math.min(maxX,Math.max(8,preferred))}px`;
      card.style.top=`${bottom>=top?Math.min(bottom,Math.max(top,point.top-12)):Math.min(maxY,Math.max(8,point.top-12))}px`;
      card.style.visibility="visible";
    };
    place();
    window.addEventListener("resize",place);
    window.addEventListener("scroll",place,true);
    return ()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
  },[anchor,children]);
  return createPortal(<div className={`spatial-hover-card${network?" network":""}`} ref={ref}
    role="tooltip" id={id} aria-label="Spatial details">{children}</div>,document.body);
}

function PlayerCard({marker,sample,mode}: {marker:SpatialMarker;sample:SpatialComparisonData;mode:typeof modes[number][0]}){
  const id=Number(marker.key);
  const sent=sample.edges?.filter(edge=>edge.from===id)??[];
  const received=sample.edges?.filter(edge=>edge.to===id)??[];
  const passes=(edges:PassingNetworkEdge[])=>decimals.format(edges.reduce((total,edge)=>total+edge.count,0));
  const rankingMax=Math.max(1,...sent.map(edge=>edge.count),...received.map(edge=>edge.count));
  const completion=marker.passOutcomes?.known?
    `${decimals.format(100*marker.passOutcomes.completed/marker.passOutcomes.known)}%`:"—";
  return <>
    <header><h3>{marker.player}</h3><p>{[marker.number!=null?`#${marker.number}`:null,marker.position].filter(Boolean).join(" · ")}</p></header>
    {mode==="network"?<>
      <dl>
        <div><dt>Minutes</dt><dd>{decimals.format(marker.minutes??0)}</dd></div>
        <div title="Average across the matches this player started in this role"><dt>Minutes per game</dt><dd>{marker.starts&&marker.minutes!=null?decimals.format(marker.minutes/marker.starts):"—"}</dd></div>
        <div><dt>Pass completion</dt><dd>{completion}</dd></div>
      </dl>
      <p className="spatial-hover-scope">Completion uses all recorded attempts with a known outcome.</p>
      <dl>
        <div><dt>Completed passes</dt><dd>{passes(sent)}</dd></div>
        <div><dt>Passes received</dt><dd>{passes(received)}</dd></div>
      </dl>
      <div className="spatial-passing-partner-grid">
        <PassingPartners heading="Top five recipients" edges={sent} playerName={playerId=>sample.markers.find(marker=>marker.key===String(playerId))?.player} direction="sent" max={rankingMax}/>
        <PassingPartners heading="Top five passers" edges={received} playerName={playerId=>sample.markers.find(marker=>marker.key===String(playerId))?.player} direction="received" max={rankingMax}/>
      </div>
    </>:<dl>
      <div><dt>Starts</dt><dd>{marker.starts}</dd></div>
      <div><dt>Minutes</dt><dd>{decimals.format(marker.minutes??0)}</dd></div>
      {mode==="lineup"&&<div><dt>Matches started</dt><dd>{sample.eligible?`${decimals.format(100*(marker.starts??0)/sample.eligible)}%`:"—"}</dd></div>}
      {mode==="average"&&<div><dt>Actions</dt><dd>{decimals.format(marker.eventCount??0)}</dd></div>}
    </dl>}
  </>;
}

function CoverageNotice({result,mode}: {result:Result|null;mode:typeof modes[number][0]}) {
  if(!result)return <p role="status">Loading spatial data…</p>;
  if(result.error)return <p role="alert">Spatial data could not be loaded.</p>;
  const sample=result.data!;
  const lineup=sample.lineup;
  let warning:string|undefined;
  if(!sample.eligible)warning="No matches for these filters.";
  else if(mode==="events"||mode==="shots"){
    if(sample.covered<sample.eligible)warning="Spatial event data is missing for some matches.";
    else if(!sample.count)warning="No events for these filters.";
  }else if(!lineup?.selectedPlayers)warning="Lineup data is insufficient to place an XI for this formation.";
  else if(sample.markers.length<lineup.selectedPlayers)warning="Some players have no recorded positions for these filters.";
  else if(lineup.formationMatches<sample.eligible)warning="Starting formations are missing for some matches.";
  return warning?<p role="status">{warning}</p>:null;
}

function coverageDetails(sample:SpatialComparisonData,showPasses:boolean){
  const lineup=sample.lineup;
  const formationMatches=lineup?.formationMatches??0;
  const formationCount=lineup?.formationCount??0;
  const confirmed=sample.edges?.reduce((total,edge)=>total+edge.confirmed,0)??0;
  const inferred=sample.edges?.reduce((total,edge)=>total+edge.estimated,0)??0;
  return [
    formationMatches?`Formation used in ${formationCount}/${formationMatches} matches with recorded formations`:null,
    lineup?.lineupCount!=null?`The XI started together ${lineup.lineupCount} times`:null,
    `${sample.covered}/${lineup?.scopedMatches??sample.eligible} matches covered`,
    `${decimals.format(sample.count)} plotted events`,
    sample.invalid?`${sample.invalid} invalid locations excluded`:null,
    showPasses?`${decimals.format(confirmed)} confirmed, ${decimals.format(inferred)} inferred passes between XI players`:null
  ].filter(Boolean).join(" · ");
}

export default function TeamSpatialComparison({data, teams, season, secondSeason, scope, comparisonBasis="perMatch"}: {
  data:Dashboard;teams:[number,number];season:string;secondSeason?:string;scope:SeasonScope;comparisonBasis?:"stage"|"perMatch"
}) {
  const [connection,setConnection]=useState<ConnectionReference>();
  const [connectionPreview,setConnectionPreview]=useState<ConnectionReference>();
  const densityHelpId=useId();
  const [shotView,setShotView]=useState<ShotView>("map");
  const [shotOutcomes,setShotOutcomes]=useState<Set<DisplayShotOutcome>>(()=>new Set(shotOutcomeOptions));
  const [shotHover,setShotHover]=useState<{shot:DisplayShot;anchor:SVGElement;side:0|1;url:string}>();
  const [shotPin,setShotPin]=useState<typeof shotHover>();
  const shotHelpId=useId();
  const playerCardId=useId();
  const visualizationId=useId();
  const [distribution,setDistribution]=useState(false);
  const [mode,setMode] = useState<typeof modes[number][0]>(secondSeason?"distribution":"events");
  const [distributionMode,setDistributionMode]=useState<"territory"|"channels">("territory");
  const [category,setCategory] = useState("all");
  const [selected,setSelected] = useState<MarkerReference|null>(null);
  const [preview,setPreview] = useState<MarkerReference|null>(null);
  const title = (team:number) => {
    const name=data.teams.find(item=>item.id===team)?.name;
    return name ? data.fullTeamNames?.[name]??name : "Team";
  };
  const isDistribution=mode==="distribution";
  const isDensity=mode==="events";
  const isShots=mode==="shots";
  const usesMinutesXI=mode==="average"||mode==="network";
  const url = (team:number, sampleSeason:string) => "/api/team-spatial?" + new URLSearchParams({
    team:String(team),season:sampleSeason,mode,
    ...(usesMinutesXI?{lineup:"minutes"}:{}),
    ...(secondSeason?{basis:comparisonBasis,comparisonSeason:sampleSeason===season?secondSeason:season}:{}),
    category:isDensity?category:"all",from:String(scope.from),to:String(scope.to),venue:scope.venue,period:scope.period
  });
  const resultA = useSpatialData(isDistribution?null:url(teams[0],season));
  const resultB = useSpatialData(isDistribution?null:url(teams[1],secondSeason??season));
  const left = resultA?.data;
  const right = resultB?.data;
  const densityOption=densityOptions[distribution?"distribution":"match"];
  const unit=distribution?"%":"events per match";
  const normalize=(sample:SpatialComparisonData|null|undefined)=>{
    const values=sample?.density??[];
    if(!distribution)return values;
    const total=values.reduce((sum,value)=>sum+value,0);
    return total?values.map(value=>100*value/total):values;
  };
  const leftDensity=normalize(left),rightDensity=normalize(right);
  const max = Math.max(0,...leftDensity,...rightDensity);
  const showDifference=Boolean(secondSeason&&isDensity);
  const difference=showDifference&&left?.covered&&right?.covered&&(!distribution||(left.count>0&&right.count>0))
    ?spatialDensityDifference(leftDensity,rightDensity):null;
  const differenceUnit=distribution?"percentage points":"events per match";
  const differenceHelpId=`${densityHelpId}-difference`;

  const samples=[left,right];
  const involvement=samples.map(sample=>{
    const totals=new Map<number,number>();
    for(const edge of sample?.edges??[]){
      totals.set(edge.from,(totals.get(edge.from)??0)+edge.count);
      totals.set(edge.to,(totals.get(edge.to)??0)+edge.count);
    }
    return totals;
  });
  const involvementMax=Math.max(0,...involvement.flatMap(counts=>[...counts.values()]));
  const edgeMax=Math.max(1,...samples.flatMap(sample=>sample?.edges?.map(edge=>edge.count)??[]));
  const distributions=samples.map(sample=>sample?.lineup?
    {matches:sample.lineup.formationMatches,rows:sample.lineup.distribution}:sample?.formationDistribution);
  const formations=[...new Set(distributions.flatMap(item=>item?.rows.map(row=>row.formation)??[]))];
  const clearDetails=()=>{setConnection(undefined);setConnectionPreview(undefined);setSelected(null);setPreview(null);setShotHover(undefined);setShotPin(undefined);};
  const selectMode=(next:typeof mode)=>{setMode(next);clearDetails();};

  const resolve=(reference:MarkerReference|null)=>{
    if(!reference||reference.url!==(reference.side===0?resultA?.url:resultB?.url))return null;
    const sample=samples[reference.side];
    const marker=sample?.markers.find(item=>item.key===reference.key);
    return marker&&sample?{marker,sample,side:reference.side,anchor:reference.anchor}:null;
  };
  const selectedPlayer=resolve(selected);
  const active=resolve(preview)??selectedPlayer;
  const isCurrentConnection=(reference:ConnectionReference|undefined)=>
    reference?.url===(reference?.side===0?resultA?.url:resultB?.url)?reference:undefined;
  const pinnedConnection=isCurrentConnection(connection);
  const activeConnection=active?undefined:isCurrentConnection(connectionPreview)??pinnedConnection;
  const draw = (side:0|1) => {
    const sample=samples[side];
    if(!sample||isDensity||isShots)return null;
    const visibleEdges=(sample.edges??[]).filter(edge=>edge.count>=minimumNetworkPasses);
    const focusedPlayer=!activeConnection&&active?.side===side?Number(active.marker.key):null;
    const focusedEdge=activeConnection?.side===side?activeConnection:undefined;
    const related=(from:number,to:number)=>focusedEdge?
      focusedEdge.from===from&&focusedEdge.to===to:focusedPlayer===from||focusedPlayer===to;
    const highlighted=focusedEdge?new Set([String(focusedEdge.from),String(focusedEdge.to)]):
      focusedPlayer!==null&&mode==="network"?new Set([String(focusedPlayer),...visibleEdges
        .filter(edge=>related(edge.from,edge.to)).flatMap(edge=>[String(edge.from),String(edge.to)])]):null;
    return <><g aria-label="Completed pass connections">{mode==="network"&&visibleEdges.map(edge=>{
        const from=sample.markers.find(marker=>marker.key===String(edge.from));
        const to=sample.markers.find(marker=>marker.key===String(edge.to));
        if(!from||!to)return null;
        const label=`${from.player} → ${to.player} · ${edge.count} completed passes · ${edge.confirmed} confirmed, ${edge.estimated} inferred · ${decimals.format(edge.sharedMinutes??0)} shared minutes`;
        const dx=to.x-from.x,dy=to.y-from.y;
        const distance=Math.hypot(dx,dy)||1;
        const path=`M ${from.x} ${from.y} Q ${(from.x+to.x)/2-dy/distance*2} ${(from.y+to.y)/2+dx/distance*2} ${to.x} ${to.y}`;
        const reference=(anchor:SVGElement)=>({side,url:(side===0?resultA:resultB)!.url,from:edge.from,to:edge.to,label,anchor});
        const strength=edge.count/edgeMax;
        const edgeClass=highlighted?(related(edge.from,edge.to)?" connected":" muted"):"";
        return <g key={`${edge.from}:${edge.to}`} tabIndex={0} role="button" aria-label={label} className={`spatial-network-edge${edgeClass}`}
          aria-pressed={pinnedConnection?.side===side&&pinnedConnection.from===edge.from&&pinnedConnection.to===edge.to}
          onFocus={event=>setConnectionPreview(reference(event.currentTarget))} onBlur={()=>setConnectionPreview(undefined)}
          onPointerEnter={event=>{if(event.pointerType!=="touch")setConnectionPreview(reference(event.currentTarget));}}
          onPointerLeave={event=>{if(event.pointerType!=="touch")setConnectionPreview(undefined);}}
          onClick={event=>{if(!selectedPlayer)setConnection(reference(event.currentTarget));}}
          onKeyDown={event=>{
            if(event.key==="Enter"||event.key===" "){event.preventDefault();if(!selectedPlayer)setConnection(reference(event.currentTarget));}
            if(event.key==="Escape"){setConnection(undefined);setConnectionPreview(undefined);}
          }}>
          <path d={path} stroke="transparent" strokeWidth="12" fill="none" vectorEffect="non-scaling-stroke"/>
          <path d={path} className="spatial-pass-link" stroke={colors[side]} strokeWidth={1+4*strength} opacity={.25+.65*strength} fill="none"
            vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
        </g>;
      })}</g><Markers data={sample} color={colors[side]} involvement={involvement[side]} involvementMax={involvementMax} highlighted={highlighted} cardId={playerCardId}
        activeKey={active?.side===side?active.marker.key:undefined} selectedKey={selectedPlayer?.side===side?selectedPlayer.marker.key:undefined}
        onPreview={(key,anchor)=>setPreview(key&&anchor?{side,key,anchor,url:(side===0?resultA:resultB)!.url}:null)}
        onSelect={(key,anchor)=>{setConnection(undefined);setConnectionPreview(undefined);setPreview(null);
          setSelected(selectedPlayer?.side===side&&selectedPlayer.marker.key===key?null:{side,key,anchor,url:(side===0?resultA:resultB)!.url});}}
        onClear={clearDetails}/></>;
  };
  const filteredShots=samples.map(sample=>(sample?.shots??[]).filter(isDisplayShot).filter(shot=>shotOutcomes.has(shot.outcome)));
  const currentShot=shotHover??shotPin;
  const activeShot=currentShot?.url===(currentShot?.side===0?resultA?.url:resultB?.url)?currentShot:undefined;
  const shotCoverage=filteredShots.map(shots=>{
    const locations=shots.filter(shot=>shot.goal).length;
    const inFrame=shots.filter(shot=>shot.goal&&goalMouthPoint(shot.goal)).length;
    const origins=shots.filter(shot=>shot.origin&&shot.origin.y<=50).length;
    const outside=shots.filter(shot=>shot.origin&&shot.origin.y>50).length;
    return {locations,inFrame,origins,outside,total:shots.length};
  });
  const description=mode==="lineup"?secondSeason?"Representative lineups are based on the most common recorded starting formation and players.":"Nominal positions use recorded formation templates.":
    mode==="average"?secondSeason?"The 11 players with the most minutes in each season. Positions show where their on-ball actions were recorded.":"The 11 players with the most minutes, shown where they were involved on the pitch.":
    mode==="network"?"The 11 players with the most minutes are shown for each team. Larger circles show more passes played and received. Thicker lines show more passes between teammates.":
    isDistribution?"Recorded event distributions · shared filters and selected samples.":isShots?"Shot origins and recorded destinations.":`Shared scale · ${densityOption.label}`;
  return <section className={`panel spatial-comparison${isShots?" shot-analysis-view":""}`}>
    <div className="spatial-controls">
      <header><h2>{"Spatial Analysis"}</h2><p>{description}</p></header>
      <div className="spatial-visualization-tabs" role="tablist" aria-label="Spatial visualization">
        {modes.map(([key,label,Icon],index)=><button key={key} id={`${visualizationId}-${key}`} type="button" role="tab"
          aria-selected={mode===key} aria-controls={`${visualizationId}-panel`} tabIndex={mode===key?0:-1}
          onClick={()=>{if(mode!==key)selectMode(key);}}
          onKeyDown={event=>{
            const offset=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:0;
            if(!offset&&event.key!=="Home"&&event.key!=="End")return;
            event.preventDefault();
            const next=event.key==="Home"?0:event.key==="End"?modes.length-1:(index+offset+modes.length)%modes.length;
            const nextMode=modes[next][0];
            selectMode(nextMode);
            document.getElementById(`${visualizationId}-${nextMode}`)?.focus();
          }}><Icon size={15} aria-hidden="true"/>{label}</button>)}
      </div>
      <Activity mode={isDistribution?"hidden":"visible"}><div className={`team-analysis-shared-filters spatial-common-filters${isShots?" shot-analysis-controls":""}`}>
      {isDensity&&<div className="spatial-normalization-control">
        <div className="spatial-normalization-label">
          <label htmlFor={`${densityHelpId}-select`}>Density normalization</label>
          <span className="spatial-density-info">
            <button type="button" aria-label="About density normalization" aria-describedby={densityHelpId}><Info size={14} aria-hidden="true"/></button>
            <span id={densityHelpId} role="tooltip" className="spatial-density-tooltip">{densityOption.help}</span>
          </span>
        </div>
        <select id={`${densityHelpId}-select`} aria-describedby={densityHelpId}
          value={distribution?"distribution":"match"} onChange={event=>setDistribution(event.target.value==="distribution")}>
          {Object.entries(densityOptions).map(([value,option])=><option value={value} key={value}>{option.label}</option>)}
        </select>
      </div>}
      {(mode==="events") && <label>Event type<select aria-label="Event type" value={category} onChange={event => setCategory(event.target.value)}>
        {eventCategories.filter(value=>value!=="defensive"&&value!=="other"&&value!=="final-third").map(value => <option key={value} value={value}>{value==="all"?"All events":value==="progressive"?"Progressive passes":capitalize(value)}</option>)}</select></label>}
      {isShots&&<>
        <label>Shot view<select value={shotView} onChange={event=>{setShotView(event.target.value as ShotView);clearDetails();}}>
          <option value="map">Shot Map</option><option value="mouth">Goal Mouth</option>
        </select></label>
        <div className="spatial-shot-filters" role="group" aria-label="Shot outcomes">
          {shotOutcomeOptions.map(outcome=>{
            const shot=shotSymbols[outcome];
            return <button type="button" key={outcome} aria-pressed={shotOutcomes.has(outcome)}
              onClick={()=>{
                setShotOutcomes(previous=>{
                  const next=new Set(previous);
                  if(next.has(outcome))next.delete(outcome);else next.add(outcome);
                  return next;
                });
                clearDetails();
              }}><i style={{backgroundColor:shot.color}} aria-hidden="true"/>{outcome==="goal"?"Goals":shot.label}</button>;
          })}
          <button className="spatial-shot-toggle-all" type="button" onClick={()=>{
            setShotOutcomes(shotOutcomes.size===shotOutcomeOptions.length?new Set():new Set(shotOutcomeOptions));
            clearDetails();
          }}>{shotOutcomes.size===shotOutcomeOptions.length?"Deselect all":"Select all"}</button>
          <span className="spatial-density-info">
            <button type="button" aria-label="Shot coordinate coverage" aria-describedby={shotHelpId}><Info size={15} aria-hidden="true"/></button>
            <span id={shotHelpId} role="tooltip" className="spatial-density-tooltip">
              {shotCoverage.map((value,side)=><span className="spatial-shot-coverage-line" key={side}>{title(teams[side])} · {
                shotView==="map"?`${value.origins}/${value.total} origins in view${value.outside?` · ${value.outside} outside the attacking half`:""}`:
                  `${value.inFrame}/${value.locations} valid destinations in view · ${value.total-value.locations} unavailable`}</span>)}
              {shotView==="mouth"&&"Both clubs share one fixed goal scale. Wide or high destinations outside the frame are counted separately."}
            </span>
          </span>
        </div>
      </>}
      </div></Activity>
    </div>
    <Activity mode={isDistribution?"hidden":"visible"}><div className="spatial-stage" role="tabpanel" id={!isDistribution?`${visualizationId}-panel`:undefined} aria-labelledby={`${visualizationId}-${mode}`}>
    <div className={`spatial-pitches spatial-pitches-pair${showDifference?" spatial-pitches-trio":""}`}>
      {([0,1] as const).map(side=>{
        const team=teams[side], sample=samples[side];
        const sampleSeason=side===1?secondSeason??season:season;
        const name=data.teams.find(item=>item.id===team)?.name;
        const formation=sample?.lineup?.formation;
        const caption=[secondSeason?sampleSeason.replace("-","/"):null,formation].filter(Boolean).join(" · ");
        const coverage=shotCoverage[side];
        const outside=shotView==="map"?coverage.outside:coverage.locations-coverage.inFrame;
        const empty=(shotView==="map"?coverage.origins:coverage.inFrame)===0;
        return <Pitch key={side} side={side===0?"a":"b"} title={title(team)} logo={name?data.logos[name]:undefined}
          caption={caption} details={sample?coverageDetails(sample,mode==="network"):undefined}
          density={isDensity?<EventHeatmap values={side===0?leftDensity:rightDensity} max={max} label={`${title(team)} event heatmap`} portrait/>:undefined}
          shotSurface={isShots?shotView==="map"?"shot-surface-half":"shot-surface-mouth":undefined}
          showAttack={!isShots||shotView==="map"}
          shotPlot={isShots?<><ShotPlot key={shotView} shots={filteredShots[side]} view={shotView}
            activeKey={activeShot?.side===side?activeShot.shot.key:undefined} onClear={clearDetails}
            onShot={(shot,anchor,pin)=>{
              const url=(side===0?resultA:resultB)?.url;
              const next=shot&&anchor&&url?{shot,anchor,side,url}:undefined;
              if(pin)setShotPin(next);else setShotHover(next);
            }}/>{sample&&empty&&<p className="spatial-shot-empty">No qualifying shots in view</p>}</>:undefined}
          onClear={!isDensity?clearDetails:undefined}
          coverage={isShots?<div className="spatial-shot-coverage">
            <CoverageNotice result={side===0?resultA:resultB} mode={mode}/>
            {sample&&outside>0&&<p>{outside} {shotView==="map"?
              (outside===1?"shot outside the attacking half":"shots outside the attacking half"):
              (outside===1?"valid destination outside the goal view":"valid destinations outside the goal view")}</p>}
          </div>:<CoverageNotice result={side===0?resultA:resultB} mode={mode}/>}>{draw(side)}</Pitch>;
      })}
      {showDifference&&<Pitch side="difference" title="Spatial Difference Map" caption="Comparison − baseline"
        density={<EventHeatmap values={difference?.values??[]} max={difference?.max??0} portrait diverging label="Spatial difference heatmap"/>}
        coverage={difference?null:<p>{left&&right?"Insufficient coverage for a difference map.":"Waiting for both seasons."}</p>}>{null}</Pitch>}
    </div>
    {!isDensity&&!isShots&&active&&<FloatingCard anchor={active.anchor} network={mode==="network"} id={playerCardId}>
      <PlayerCard marker={active.marker} sample={active.sample} mode={mode}/>
    </FloatingCard>}
    {isShots&&activeShot&&<FloatingCard anchor={activeShot.anchor}>
      <ShotCard shot={activeShot.shot} fixture={samples[activeShot.side]?.matches.find(match=>match.id===activeShot.shot.matchId)}/>
    </FloatingCard>}
    {!isDensity&&activeConnection&&<FloatingCard anchor={activeConnection.anchor}><p>{activeConnection.label}</p></FloatingCard>}
    {isDensity&&<EventHeatmapLegend label={`0–${decimals.format(max)} ${unit}`}/>}
    {showDifference&&<div className="spatial-difference-legend">
      {difference&&<><span>−{decimals.format(difference.max)} · Less</span><i aria-hidden="true"/><span>+{decimals.format(difference.max)} · More</span><span>{differenceUnit}</span></>}
      <span className="spatial-density-info">
        <button type="button" aria-label="About the difference map" aria-describedby={differenceHelpId}><Info size={14} aria-hidden="true"/></button>
        <span id={differenceHelpId} role="tooltip" className="spatial-density-tooltip">Each cell subtracts the baseline season from the comparison season using the same filters and normalization. Blue marks less activity, red marks more, and transparent cells show no change.</span>
      </span>
    </div>}

    {mode==="lineup"&&left&&right&&!formations.length&&<p role="status">No starting formations were recorded for the selected matches.</p>}
    {mode==="lineup"&&formations.length>0&&<div className="spatial-formation-table">
      <table><caption>Recorded starting formations</caption><thead><tr><th scope="col">Formation</th>
        {teams.map((team,side)=><th key={side} scope="col" style={{borderBottomColor:colors[side]}}>{secondSeason?(side===0?season:secondSeason).replace("-","/"):title(team)}</th>)}
        {secondSeason&&<th scope="col">Season change</th>}</tr></thead>
        <tbody>{formations.map(formation=>{
          const shares=distributions.map(sample=>sample?.matches?100*(sample.rows.find(row=>row.formation===formation)?.count??0)/sample.matches:null);
          const change=shares[0]!==null&&shares[1]!==null?shares[1]-shares[0]:null;
          return <tr key={formation}><th scope="row">{formation}</th>{distributions.map((sample,side)=>{
            const count=sample?.rows.find(item=>item.formation===formation)?.count??0;
            return <td key={side}>{shares[side]===null?"—":`${count} · ${decimals.format(shares[side])}%`}</td>;
          })}
          {secondSeason&&<td>{change===null?"—":`${change>0?"+":""}${decimals.format(change)} pp`}</td>}</tr>;
        })}</tbody>
      </table>
    </div>}
    </div>
    </Activity>
    <Activity mode={isDistribution?"visible":"hidden"}><div className="spatial-stage" role="tabpanel" id={isDistribution?`${visualizationId}-panel`:undefined} aria-labelledby={`${visualizationId}-${mode}`}>
      <div className="spatial-distribution-options" role="group" aria-label="Positional Analysis views">
        <button type="button" aria-pressed={distributionMode==="territory"} onClick={()=>setDistributionMode("territory")}>Territorial Distribution</button>
        <button type="button" aria-pressed={distributionMode==="channels"} onClick={()=>setDistributionMode("channels")}>Attacking Channels</button>
      </div>
      <AggregatedSpatialWorkspace data={data} kind={secondSeason?"history":"teams"} teams={teams} teamId={teams[0]} referenceSeason={season} secondSeason={secondSeason} scope={scope} mode={distributionMode} basis={comparisonBasis}/>
    </div></Activity>
  </section>;
}
