"use client";
import {useEffect,useId,useRef,useState} from "react";
const formatNumber=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value);
const formatSeason=(season:string)=>season.replace("-","/");
const shortSeason=(season:string)=>season.slice(0,4)+"/"+season.slice(-2);
export type ChartPoint={season:string;value:number|null;detail:string;ongoing:boolean;reference?:boolean;extreme?:boolean};
export type ChartSeries={name:string;points:ChartPoint[];color:string;dashed?:boolean;reverse?:boolean};

export default function SeasonChart({title,series,matchdays=false,sharedScale=false,wide=false,formatValue=formatNumber,research=false,benchmark,large=false}: {title:string;series:ChartSeries[];matchdays?:boolean;sharedScale?:boolean;wide?:boolean;formatValue?:(value:number|null)=>string;research?:boolean;large?:boolean;benchmark?:{value:number|null;label:string}}) {
  const [active,setActive]=useState<string|null>(null);
  const [hover,setHover]=useState<{line:number;index:number}|null>(null);
  const [plotWidth,setPlotWidth]=useState(600);
  const chartFrame=useRef<HTMLElement>(null);
  const gradient=useId().replace(/[^a-zA-Z0-9]/g,"");
  const hasData=series.some(line=>line.points.some(point=>point.value!==null));
  useEffect(()=>{if(!research||!chartFrame.current)return;const observer=new ResizeObserver(([entry])=>setPlotWidth(Math.max(480,Math.round(entry.contentRect.width))));observer.observe(chartFrame.current);return()=>observer.disconnect();},[research,hasData]);
  const seasons=series[0]?.points??[];
  const plotHeight=large?460:320;
  const left=research?58:wide?64:45,right=research?plotWidth-24:wide?1040:670,top=research?26:22,bottom=research?plotHeight-52:wide?260:220;
  const x=(index:number)=>seasons.length<2?(left+right)/2:left+index*(right-left)/(seasons.length-1);
  const domains=series.map(line=>{
    const together=matchdays||sharedScale?series:series.filter(item=>item===line || (line===series[0]&&item.dashed) || (line.dashed&&item===series[0]));
    const values=[...together.flatMap(item=>item.points.flatMap(point=>point.value===null?[]:[point.value])),...(research&&benchmark?.value!=null?[benchmark.value]:[])];
    const padding=research&&values.length?(Math.max(...values)-Math.min(...values))*.08:0;
    const min=line.reverse?research?Math.max(1,Math.floor(Math.min(...values,18))-1):1:values.length?Math.min(...values)-padding:0,max=line.reverse?research?Math.min(18,Math.ceil(Math.max(...values,1))+1):18:values.length?Math.max(...values)+padding:1;
    return {min:min===max?min-1:min,max:min===max?max+1:max};
  });
  const y=(value:number,index:number)=>{
    const {min,max}=domains[index];
    const scale=(value-min)/(max-min);
    return series[index].reverse?top+scale*(bottom-top):bottom-scale*(bottom-top);
  };
  const hoveredLine=hover?series[hover.line]:undefined;
  const hoveredPoint=hoveredLine&&hover?hoveredLine.points[hover.index]:undefined;
  if(!hasData)return <div className="team-analysis-empty">No supported values in this season range.</div>;
  return <figure ref={chartFrame} className={`comparison-season-chart${research?` research-season-chart${large?" historical-modal-line-chart":""}`:wide?" statistical-evolution-wide-chart":""}`}>
    <svg viewBox={research?`0 0 ${plotWidth} ${plotHeight}`:wide?"0 0 1100 310":"0 0 720 270"} role="img" aria-label={title} onPointerLeave={()=>{if(research)setHover(null);}} onKeyDown={event=>{if(event.key==="Escape")setHover(null);}}>
      {research&&<defs><linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={bottom}><stop offset="0" stopColor={series[0].color} stopOpacity=".08"/><stop offset="1" stopColor={series[0].color} stopOpacity="0"/></linearGradient></defs>}
      {research&&seasons.map((point,index)=>point.ongoing||large&&point.reference?<rect key={point.season} x={Math.max(left,x(index)-12)} y={top} width={large?Math.min(24,right-Math.max(left,x(index)-12)):24} height={bottom-top} fill="var(--accent)" opacity={large&&point.reference?".065":".035"}/>:null)}
      {(series[0].reverse&&!research?[0,4/17,8/17,12/17,1]:[0,.25,.5,.75,1]).map(fraction=>{
        const line=series[0],domain=domains[0];
        const tick=line.reverse?domain.min+fraction*(domain.max-domain.min):domain.max-fraction*(domain.max-domain.min);
        const py=top+fraction*(bottom-top);
        if(research&&line.reverse&&fraction>0&&Math.round(tick)===Math.round(domain.min+(fraction-.25)*(domain.max-domain.min)))return null;
        return <g key={fraction}><line x1={left} x2={right} y1={py} y2={py}/><text x={left-6} y={py+4} textAnchor="end">{wide?formatValue(line.reverse?Math.round(tick):tick):formatNumber(line.reverse?Math.round(tick):tick)}</text>
          {series[1]&&!series[1].dashed&&!matchdays&&!sharedScale&&<text x={right+6} y={py+4} fill={series[1].color}>{formatNumber(domains[1].max-fraction*(domains[1].max-domains[1].min))}</text>}</g>;
      })}
      {seasons.map((point,index)=>(research?(index===0||index===seasons.length-1||index%Math.max(1,Math.ceil(seasons.length/(plotWidth/48)))===0&&(seasons.length-1-index)*(right-left)/Math.max(1,seasons.length-1)>=40):(wide&&!matchdays||seasons.length<11||index%2===0||index===seasons.length-1))&&<text key={point.season} x={x(index)} y={research?plotHeight-30:wide?286:242} textAnchor="middle">{matchdays?point.season:wide?point.season.slice(2,4)+"/"+point.season.slice(-2):shortSeason(point.season)}{point.ongoing?"*":""}</text>)}
      {research&&benchmark?.value!=null&&<line className="research-average-line" x1={left} x2={right} y1={y(benchmark.value,0)} y2={y(benchmark.value,0)}/>}
      {research&&!matchdays&&series[0].points.map((point,index)=>{
        const previous=series[0].points[index-1];
        return point.value===null||previous?.value==null?null:<path key={point.season} d={`M${x(index-1)} ${bottom} L${x(index-1)} ${y(previous.value,0)} L${x(index)} ${y(point.value,0)} L${x(index)} ${bottom}Z`} fill={`url(#${gradient})`} stroke="none"/>;
      })}
      {research&&hoveredPoint&&hover&&<line className="research-crosshair" x1={x(hover.index)} x2={x(hover.index)} y1={top} y2={bottom}/>}
      {series.map((line,index)=>{
        let drawing=false,path="";
        line.points.forEach((point,position)=>{
          if(point.value===null){drawing=false;return;}
          path+=`${drawing?"L":"M"}${x(position)} ${y(point.value,index)} `;drawing=true;
        });
        return <g key={line.name}>{wide?line.points.map((point,position)=>{
            const previous=line.points[position-1];
            return point.value===null||previous?.value==null?null:<path key={point.season} d={`M${x(position-1)} ${y(previous.value,index)} L${x(position)} ${y(point.value,index)}`} stroke={line.color} strokeWidth="1.6" fill="none" strokeDasharray={line.dashed||point.ongoing||previous.ongoing?"5 5":undefined}/>;
          }):<path d={path} stroke={line.color} strokeWidth="2.5" fill="none" strokeDasharray={line.dashed?"5 5":undefined}/>}
          {line.points.map((point,position)=>point.value===null?null:<circle key={point.season} tabIndex={0}
            cx={x(position)} cy={y(point.value,index)} r={research?(large&&point.reference&&index===0?5:hover?.line===index&&hover.index===position?4:2.75):wide?(point.reference?3.5:2.5):point.reference||point.extreme?6:point.ongoing?5:4} fill={point.ongoing?"var(--panel)":line.color}
            stroke={line.color} strokeWidth={wide?1.3:2} aria-label={point.detail} onMouseEnter={()=>{setActive(point.detail);if(research)setHover({line:index,index:position});}} onFocus={()=>{setActive(point.detail);if(research)setHover({line:index,index:position});}} onBlur={()=>{if(research)setHover(null);}}>
            <title>{point.detail}</title></circle>)}</g>;
      })}
      {research&&hoveredPoint&&hover&&<foreignObject className="research-scatter-tooltip-container" x={Math.max(left,Math.min(plotWidth-244,x(hover.index)+12))} y={top+22} width="220" height="202"><div className="research-tooltip" role="tooltip"><strong>{hoveredLine?.name} · {matchdays?`Matchday ${hoveredPoint.season}`:formatSeason(hoveredPoint.season)}</strong><b>{formatValue(hoveredPoint.value)}</b><small>{hoveredPoint.detail}</small></div></foreignObject>}
    </svg>
    <figcaption>{series.map(line=><span key={line.name} style={{color:line.color}}>● {line.name}</span>)}{research&&benchmark?.value!=null&&<span>{benchmark.label} {formatValue(benchmark.value)}</span>}{seasons.some(point=>point.ongoing)&&<span>* Ongoing or incomplete schedule</span>}</figcaption>
    {!research&&<p className="comparison-point-detail" aria-live="polite">{active??"Hover or focus a point to see season details."}</p>}
  </figure>;
}

