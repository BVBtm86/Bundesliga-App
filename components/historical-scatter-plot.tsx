"use client";
import { useEffect, useRef, useState } from "react";
import { mean } from "@/lib/historical-research";
export type HistoricalScatterPoint={season:string;x:number;y:number;played:number;ongoing:boolean};
export type HistoricalScatterPlotProps={points:HistoricalScatterPoint[];latest:string;xLabel:string;yLabel:string;formatX:(value:number)=>string;formatY:(value:number)=>string;rankX:boolean;rankY:boolean;averageX:boolean;averageY:boolean;context:string;referenceLogo?:string};

export default function HistoricalScatterPlot({points,latest,xLabel,yLabel,formatX,formatY,rankX,rankY,averageX,averageY,context,referenceLogo}:HistoricalScatterPlotProps){
 const [active,setActive]=useState<string|null>(null),[width,setWidth]=useState(600);
 const frame=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!frame.current)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(360,Math.round(entry.contentRect.width))));observer.observe(frame.current);return()=>observer.disconnect();},[points.length===0]);
 const historical=points.filter(point=>point.season<latest);
 const xMean=mean(historical.map(point=>point.x)),yMean=mean(historical.map(point=>point.y));
 const domain=(key:"x"|"y",rank:boolean)=>{
  const values=points.map(point=>point[key]);
  const low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):1,padding=(high-low)*.12||(rank?1:Math.max(Math.abs(high)*.1,.1));
  return rank?[Math.max(1,Math.floor(low-padding)),Math.min(18,Math.max(2,Math.ceil(high+padding)))]:[low-padding,high+padding];
 };
 const [xmin,xmax]=domain("x",rankX),[ymin,ymax]=domain("y",rankY);
 const height=Math.max(440,Math.min(600,Math.round(width*.58))),left=76,right=width-32,top=30,bottom=height-66;
 const xs=(value:number)=>left+(rankX?1-(value-xmin)/(xmax-xmin):(value-xmin)/(xmax-xmin))*(right-left);
 const ys=(value:number)=>bottom-(rankY?1-(value-ymin)/(ymax-ymin):(value-ymin)/(ymax-ymin))*(bottom-top);
 const ticks=(min:number,max:number,rank:boolean)=>[...new Set([0,.25,.5,.75,1].map(fraction=>rank?Math.round(min+(max-min)*fraction):min+(max-min)*fraction))];
 const tooltip=points.find(point=>point.season===active);
 const placements=new Map<string,{x:number;y:number}>();
 const occupied:{x:number;y:number;w:number;h:number}[]=[];
 for(const point of [...points].sort((a,b)=>Number(b.season===latest)-Number(a.season===latest)||a.season.localeCompare(b.season))){
  const px=xs(point.x),py=ys(point.y),w=32,h=12;
  for(const [dx,dy] of [[0,point.season===latest&&referenceLogo?-24:-12],[0,point.season===latest&&referenceLogo?30:20],[24,-8],[-24,-8],[24,20],[-24,20],[0,-28],[0,35]]){
   const x=Math.max(left+w/2,Math.min(right-w/2,px+dx)),y=Math.max(top+h,Math.min(bottom-3,py+dy));
   const box={x:x-w/2,y:y-h,w,h};
   if(occupied.some(other=>box.x<other.x+other.w+3&&box.x+w+3>other.x&&box.y<other.y+other.h+3&&box.y+h+3>other.y))continue;
   if(points.some(other=>other!==point&&xs(other.x)>box.x-4&&xs(other.x)<box.x+w+4&&ys(other.y)>box.y-4&&ys(other.y)<box.y+h+4))continue;
   placements.set(point.season,{x,y});occupied.push(box);break;
  }
 }
 return <div className="historical-season-scatter">
  {!points.length?<p className="team-analysis-empty">No seasons have compatible values for both axes under these filters.</p>:<>
  <div className="research-scatter-scroll" ref={frame}>
   <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Season comparison scatterplot" onKeyDown={event=>{if(event.key==="Escape")setActive(null);}}>
    {ticks(ymin,ymax,rankY).map(value=><g key={value}><line className="research-gridline" x1={left} x2={right} y1={ys(value)} y2={ys(value)}/><text x={left-9} y={ys(value)+3} textAnchor="end">{formatY(value)}</text></g>)}
    {ticks(xmin,xmax,rankX).map(value=><g key={value}><line className="research-gridline" x1={xs(value)} x2={xs(value)} y1={top} y2={bottom}/><text x={xs(value)} y={bottom+22} textAnchor="middle">{formatX(value)}</text></g>)}
    <path className="historical-scatter-axes" d={`M${left} ${top}V${bottom}H${right}`}/>
    {averageX&&xMean!==null&&<line className="research-average-line" x1={xs(xMean)} x2={xs(xMean)} y1={top} y2={bottom}><title>Historical X average {formatX(xMean)} · {historical.length} paired historical seasons</title></line>}
    {averageY&&yMean!==null&&<line className="research-average-line" x1={left} x2={right} y1={ys(yMean)} y2={ys(yMean)}><title>Historical Y average {formatY(yMean)} · {historical.length} paired historical seasons</title></line>}
    <text className="historical-scatter-axis-label" transform={`translate(16 ${(top+bottom)/2}) rotate(-90)`} textAnchor="middle">{yLabel}</text><text x={(left+right)/2} y={height-16} textAnchor="middle">{xLabel}</text>
    {[...points].sort((a,b)=>Number(a.season===latest)-Number(b.season===latest)).map((point,index)=>{
     const selected=point.season===latest,hovered=point.season===active;
     const placed=placements.get(point.season)??(hovered?{x:xs(point.x),y:Math.max(top+10,ys(point.y)-12)}:undefined);
     const detail=`${point.season.replace("-","/")} · ${xLabel}: ${formatX(point.x)} · ${yLabel}: ${formatY(point.y)} · ${point.played} matches · ${context}${point.ongoing?" · Ongoing season":""}`;
     return <g key={point.season} tabIndex={0} role="button" aria-label={detail} aria-pressed={hovered} onPointerEnter={event=>{if(event.pointerType!=="touch")setActive(point.season);}} onPointerLeave={event=>{if(event.pointerType!=="touch")setActive(null);}} onPointerUp={event=>{if(event.pointerType==="touch")setActive(point.season);}} onFocus={()=>setActive(point.season)} onBlur={()=>setActive(null)} onClick={()=>setActive(point.season)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setActive(point.season);}}}>
      <circle cx={xs(point.x)} cy={ys(point.y)} r="10" fill="transparent"/>
      {selected&&referenceLogo?<><circle cx={xs(point.x)} cy={ys(point.y)} r="17" className="historical-season-crest-halo"/><image href={referenceLogo} x={xs(point.x)-12} y={ys(point.y)-12} width="24" height="24" preserveAspectRatio="xMidYMid meet"/></>:<circle cx={xs(point.x)} cy={ys(point.y)} r={hovered?4.5:selected?3.5:2.75} fill={point.ongoing?"var(--panel)":selected?"var(--accent)":"#8292a4"} stroke={selected?"var(--accent)":"#8292a4"} strokeWidth="1.5"/>}
      {placed&&<text className={selected?"research-latest-label":undefined} x={placed.x} y={placed.y} textAnchor="middle">{point.season.slice(2,4)}/{point.season.slice(-2)}{point.ongoing?"*":""}</text>}
     </g>;
    })}
    {tooltip&&<foreignObject className="research-scatter-tooltip-container" x={Math.min(width-230,Math.max(left,xs(tooltip.x)+12))} y={Math.max(top,Math.min(bottom-132,ys(tooltip.y)-35))} width="220" height="150"><div className="research-tooltip" role="tooltip"><strong>{tooltip.season.replace("-","/")}{tooltip.ongoing?" · Ongoing":""}</strong><span>{xLabel}: {formatX(tooltip.x)}</span><span>{yLabel}: {formatY(tooltip.y)}</span><span>{tooltip.played} completed matches</span><small>{context}</small></div></foreignObject>}
   </svg>
  </div>
  <div className="research-scatter-footer"><span>{points.length} paired seasons</span><span>Historical references: {historical.length} seasons</span>{points.some(point=>point.ongoing)&&<span>* Ongoing or incomplete season</span>}</div>
  </>}
 </div>;
}
