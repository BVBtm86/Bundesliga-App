"use client";

import { useId } from "react";
import type { SpatialShot, SpatialShotOutcome } from "@/lib/spatial-shots";
import type { SpatialFixture } from "@/lib/spatial-density";
import TacticalPitch from "./tactical-pitch";

export type ShotView="map"|"mouth";
export const shotSymbols={
  goal:{color:"#ffd369",label:"Goal"},
  "on target":{color:"#8be2bb",label:"Saved"},
  "off target":{color:"#dedfe5",label:"Missed"},
  blocked:{color:"#ff9a84",label:"Blocked"},
  woodwork:{color:"#d5b5ff",label:"Woodwork"}
} satisfies Partial<Record<SpatialShotOutcome,{color:string;label:string}>>;
export type DisplayShotOutcome=keyof typeof shotSymbols;
export type DisplayShot=SpatialShot & {outcome:DisplayShotOutcome};
export function isDisplayShot(shot:SpatialShot):shot is DisplayShot{
  return Object.hasOwn(shotSymbols,shot.outcome);
}

const goalWidth=7.32;
const goalHeight=2.44;
const frameWidth=10.46;
const frameHeight=5.6;
const ground=4.8;
const centre=frameWidth/2;
const leftPost=centre-goalWidth/2;

// Opta F24 Appendix 4 encodes woodwork as bands outside the opening.
function goalAxis(value:number,inside:number,band:number,length:number){
  const excess=value-inside;
  if(excess<=0)return value/inside*length;
  const frameThickness=.12;
  return length+Math.min(excess,band)/band*frameThickness+Math.max(0,excess-band)/inside*length;
}

export function goalMouthPoint(goal:{y:number;z:number}){
  const horizontal=50-goal.y;
  const x=centre+Math.sign(horizontal)*goalAxis(Math.abs(horizontal),4.8,1,goalWidth/2);
  const y=ground-goalAxis(goal.z,38,4,goalHeight);
  return x>=.18&&x<=frameWidth-.18&&y>=.18&&y<=frameHeight-.18?{x,y}:null;
}

export function ShotPlot({shots,view,activeKey,onShot,onClear}:{
  shots:DisplayShot[];view:ShotView;activeKey?:string;
  onShot:(shot:DisplayShot|null,anchor?:SVGElement,pin?:boolean)=>void;onClear:()=>void;
}){
  const netId=useId();
  const map=view==="map";
  const points=[...shots].sort((a,b)=>Number(a.outcome==="goal")-Number(b.outcome==="goal")).flatMap(shot=>{
    const point=map?(shot.origin&&shot.origin.y<=50?shot.origin:null):shot.goal&&goalMouthPoint(shot.goal);
    return point?[{shot,point}]:[];
  });
  return <div className={`spatial-shot-plot ${map?"half map":"mouth"}`}>
    {map&&<TacticalPitch portrait/>}
    <svg className="spatial-shot-overlay" viewBox={map?"0 0 100 50":`0 0 ${frameWidth} ${frameHeight}`}
      preserveAspectRatio={map?"none":"xMidYMid meet"} aria-label={map?"Shot map":"Front-facing goal"}
      onClick={event=>{if(event.target===event.currentTarget)onClear();}}>
      {!map&&<g className="spatial-goal-frame" pointerEvents="none">
        <defs><pattern id={netId} width=".24" height=".24" patternUnits="userSpaceOnUse">
          <path d="M .24 0 H 0 V .24" className="spatial-goal-net-thread"/>
        </pattern></defs>
        <rect className="spatial-goal-ground" x="0" y={ground} width={frameWidth} height={frameHeight-ground}/>
        <path className="spatial-goal-ground-line" d={`M 0 ${ground} H ${frameWidth}`}/>
        <rect className="spatial-goal-interior" x={leftPost} y={ground-goalHeight} width={goalWidth} height={goalHeight}/>
        <rect x={leftPost} y={ground-goalHeight} width={goalWidth} height={goalHeight} fill={`url(#${netId})`}/>
        <path className="goal-posts" d={`M ${leftPost} ${ground} V ${ground-goalHeight} h ${goalWidth} V ${ground}`}/>
      </g>}
      {points.map(({shot,point})=>{
        const icon=shotSymbols[shot.outcome];
        const size=(map?1.44:.13125)*(shot.outcome==="goal"?1.1:1);
        return <g key={shot.key} className={`spatial-shot-marker${activeKey===shot.key?" active":""}`}
          transform={`translate(${point.x} ${point.y})${map?" scale(1 .647619)":""}`}
          tabIndex={0} role="button" aria-label={`${shot.player??"Shot"} · ${icon.label}`}
          onPointerEnter={e=>{if(e.pointerType!=="touch")onShot(shot,e.currentTarget);}}
          onPointerLeave={()=>onShot(null)} onFocus={e=>onShot(shot,e.currentTarget)} onBlur={()=>onShot(null)}
          onClick={e=>onShot(shot,e.currentTarget,true)}
          onKeyDown={e=>{
            if(e.key==="Escape")onClear();
            if(e.key==="Enter"||e.key===" "){e.preventDefault();onShot(shot,e.currentTarget,true);}
          }}>
          <rect x={-size*1.5} y={-size*1.5} width={size*3} height={size*3} fill="transparent"/>
          <circle r={size*.84} fill={icon.color} className="spatial-shot-glyph"/>
        </g>;
      })}
    </svg>
  </div>;
}

export function ShotCard({shot,fixture}:{shot:DisplayShot;fixture?:SpatialFixture}){
  return <>
    <h3>{shot.player??"Shot"}</h3>
    <p>{[fixture?.opponent? `vs ${fixture.opponent}`:null,fixture?`Matchday ${fixture.week}`:null,
      shot.minute!=null?`${shot.minute}′`:null].filter(Boolean).join(" · ")}</p>
    <dl>
      <div><dt>Outcome</dt><dd>{shotSymbols[shot.outcome].label}</dd></div>
      {shot.bodyPart&&<div><dt>Body part</dt><dd>{shot.bodyPart}</dd></div>}
      {shot.situation&&<div><dt>Situation</dt><dd>{shot.situation}</dd></div>}
    </dl>
  </>;
}
