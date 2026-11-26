"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { HistoricalSeason } from "./season-evolution-scatter";
import InsightsPlaceholder from "./insights-placeholder";

export type OverviewBasis="stage"|"perMatch";
const seasonLabel=(season:string)=>season.replace("-","/");
const shortSeason=(season:string)=>season.slice(2,4)+"/"+season.slice(-2);
const decimal=(value:number|null|undefined)=>value==null?"—":value.toFixed(2);
const ordinal=(value:number|null|undefined)=>{
  if(value==null)return "—";
  const last=value%100;
  return `${value}${last>=11&&last<=13?"th":value%10===1?"st":value%10===2?"nd":value%10===3?"rd":"th"}`;
};
const metrics=[
  {key:"position",label:"League position",color:"var(--accent)",lower:true},
  {key:"points",label:"Points per game",color:"#a18ad4",lower:false},
  {key:"scored",label:"Goals scored per game",color:"#46bda0",lower:false},
  {key:"conceded",label:"Goals conceded per game",color:"#6d9ed8",lower:true},
  {key:"winShare",label:"Win rate",color:"#c79a46",lower:false},
] as const;
type Metric=typeof metrics[number];
function metricValue(item:HistoricalSeason,metric:Metric):number|null {
  const club=item.club,team=club?.team;
  if(!team?.played)return null;
  return metric.key==="position"?club!.position:metric.key==="points"?team.points/team.played:metric.key==="scored"?team.gf/team.played:metric.key==="winShare"?100*team.won/team.played:team.ga/team.played;
}
const formatted=(value:number|null,metric:Metric)=>metric.key==="position"?ordinal(value):value===null?"—":metric.key==="winShare"?`${value.toFixed(1)}%`:decimal(value);

function historicalMean(seasons:HistoricalSeason[],metric:Metric){
  const values=seasons.flatMap(season=>{
    const value=metricValue(season,metric);
    return value===null?[]:[value];
  });
  return {value:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,count:values.length};
}
const benchmarkText=(value:number|null,metric:Metric)=>metric.key==="position"&&value!==null?ordinal(Math.round(value)):formatted(value,metric);

function OverviewChart({range,metric,description,historicalSeasons,basis,stage}:{range:HistoricalSeason[];metric:Metric;description:string;historicalSeasons:HistoricalSeason[];basis:OverviewBasis;stage:number}) {
  const [active,setActive]=useState<number|null>(null);
  const [width,setWidth]=useState(1120);
  const scroller=useRef<HTMLDivElement>(null);
  const focused=useRef<number|null>(null);
  const gradient=useId().replace(/[^a-zA-Z0-9]/g,"");
  const tooltipId=`summary-tooltip-${gradient}`;
  useEffect(()=>{
    const element=scroller.current;
    if(!element)return;
    const observer=new ResizeObserver(([entry])=>setWidth(Math.max(1040,Math.round(entry.contentRect.width))));
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  const rank=metric.key==="position";
  const points=range.map(item=>({item,value:metricValue(item,metric)}));
  const values=points.flatMap(point=>point.value===null?[]:[point.value]);
  const benchmark=historicalMean(historicalSeasons,metric);
  const scaleValues=[...values,...(benchmark.value===null?[]:[benchmark.value])].filter(Number.isFinite);
  const lowest=scaleValues.length?Math.min(...scaleValues):0,highest=scaleValues.length?Math.max(...scaleValues):1;
  const padding=rank?1:Math.max((highest-lowest)*.08,highest===lowest?Math.max(Math.abs(highest)*.08,.1):.01);
  const lower=Math.max(rank?1:0,lowest-padding);
  const upper=Math.min(rank?18:metric.key==="winShare"?100:Infinity,highest+padding);
  const roughStep=Math.max((upper-lower)/4,rank?1:.000001);
  const magnitude=10**Math.floor(Math.log10(roughStep));
  const fraction=roughStep/magnitude;
  const step=rank?Math.max(1,Math.ceil(roughStep)):Math.max(metric.key==="winShare"?.1:.01,magnitude*(fraction>=5?5:fraction>=2.5?2.5:fraction>=2?2:1));
  const min=rank?lower:Math.max(0,Math.floor(lower/step)*step);
  const max=Math.max(min+step,rank?upper:Math.min(metric.key==="winShare"?100:Infinity,Math.ceil(upper/step)*step));
  const ticks:number[]=[];
  for(let tick=min;tick<=max+step*.0001;tick+=step)ticks.push(Number(tick.toFixed(8)));
  if(Math.abs(ticks.at(-1)!-max)>step*.0001)ticks.push(max);
  const left=60,right=width-36,top=24,bottom=274;
  const spacing=(right-left)/Math.max(1,range.length-1);
  const x=(index:number)=>range.length<2?(left+right)/2:left+index*spacing;
  const y=(value:number)=>rank?top+(value-min)/(max-min)*(bottom-top):bottom-(value-min)/(max-min)*(bottom-top);
  const selected=active===null?undefined:points[active];
  const context=basis==="stage"?`Same Stage · First ${stage} completed games`:"Season · All completed games";
  const detail=(item:HistoricalSeason,value:number|null)=>`${seasonLabel(item.season)} · ${metric.label}: ${formatted(value,metric)} · ${item.club?.team.played??0} games${item.ongoing?" · Ongoing season":""} · ${context} · Historical average ${benchmarkText(benchmark.value,metric)} across ${benchmark.count} prior seasons`;
  const activeX=active===null?left:x(active);
  const tooltipX=activeX>width*.7?activeX-248:activeX+16;
  const tooltipY=selected?.value==null?top+12:Math.max(top+12,Math.min(bottom-156,y(selected.value)-65));
  return <section className="panel comparison-card evolution-main-chart" id="evolution-main-chart" aria-label="Historical metric chart">
    <header><div><h3>{metric.label}</h3><p>{description}</p></div><span className="evolution-chart-unit">{rank?"Lower is better":metric.key==="winShare"?"Wins / games played":"Per game"}</span></header>
    {!values.length?<p className="team-analysis-empty">No supported values for this comparison.</p>:<figure className="comparison-season-chart summary-chart-figure">
      <div ref={scroller} className="evolution-chart-scroll" tabIndex={0} role="region" aria-label="Season chart; scroll horizontally on smaller screens">
        <svg className="summary-chart-svg" viewBox={`0 0 ${width} 310`} role="img" aria-label={`${metric.label} across ${range.length} seasons. Historical average ${benchmarkText(benchmark.value,metric)}.`}
          onPointerMove={event=>{
            const bounds=event.currentTarget.getBoundingClientRect();
            const px=(event.clientX-bounds.left)*width/bounds.width,py=(event.clientY-bounds.top)*310/bounds.height;
            if(px<left-12||px>right+12||py<top||py>bottom){setActive(focused.current);return;}
            setActive(range.length<2?0:Math.max(0,Math.min(range.length-1,Math.round((px-left)/spacing))));
          }} onPointerLeave={()=>setActive(focused.current)} onKeyDown={event=>{if(event.key==="Escape")setActive(null);}}>
          <defs><linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={bottom}><stop offset="0%" stopColor={metric.color} stopOpacity=".11"/><stop offset="100%" stopColor={metric.color} stopOpacity="0"/></linearGradient></defs>
          {points.map(({item},index)=>item.ongoing?<rect key={item.season} x={Math.max(left,x(index)-spacing*.45)} y={top} width={Math.min(right+12-x(index)+spacing*.45,spacing*.9)} height={bottom-top} fill={metric.color} opacity=".035"/>:null)}
          {ticks.map(tick=><g key={tick}><line className="summary-chart-grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)}/><text x={left-12} y={y(tick)+3} textAnchor="end">{formatted(tick,metric)}</text></g>)}
          {points.map(({item,value},index)=>{
            const previous=points[index-1];
            if(value===null||previous?.value==null||Number(item.season.slice(0,4))!==Number(previous.item.season.slice(0,4))+1)return null;
            return <path key={item.season} d={`M${x(index-1)} ${bottom} L${x(index-1)} ${y(previous.value)} L${x(index)} ${y(value)} L${x(index)} ${bottom} Z`} fill={`url(#${gradient})`} stroke="none"/>;
          })}
          {benchmark.value!==null&&<line className="summary-chart-average-line" x1={left} x2={right} y1={y(benchmark.value)} y2={y(benchmark.value)}><title>Historical average: {benchmarkText(benchmark.value,metric)} · {benchmark.count} prior seasons · {context}</title></line>}
          {points.map(({item,value},index)=>{
            const previous=points[index-1];
            if(value===null||previous?.value==null||Number(item.season.slice(0,4))!==Number(previous.item.season.slice(0,4))+1)return null;
            return <path key={item.season} d={`M${x(index-1)} ${y(previous.value)} L${x(index)} ${y(value)}`} fill="none" stroke={metric.color} strokeWidth="1.75" strokeDasharray={item.ongoing||previous.item.ongoing?"4 4":undefined}/>;
          })}
          {selected&&<line className="summary-chart-crosshair" x1={activeX} x2={activeX} y1={top} y2={bottom}/>}
          {points.map(({item,value},index)=>value===null?null:<circle className="summary-chart-marker" data-active={active===index} key={item.season} cx={x(index)} cy={y(value)} r="2.75" tabIndex={0} fill={item.ongoing?"var(--panel)":metric.color} stroke={metric.color} strokeWidth="1.5" aria-label={detail(item,value)} aria-describedby={active===index?tooltipId:undefined}
            onFocus={()=>{focused.current=index;setActive(index);}} onBlur={()=>{focused.current=null;setActive(null);}}/>)}
          {points.map(({item},index)=><text className="summary-chart-season-label" key={item.season} x={x(index)} y="298" textAnchor="middle">{shortSeason(item.season)}{item.ongoing?"*":""}</text>)}
          {selected&&<foreignObject x={tooltipX} y={tooltipY} width="232" height="156" className="summary-chart-tooltip-container"><div className="summary-chart-tooltip" id={tooltipId} role="tooltip">
            <div className="summary-tooltip-season"><strong>{seasonLabel(selected.item.season)}</strong>{selected.item.ongoing&&<span>Ongoing</span>}</div>
            <span className="summary-tooltip-label">{metric.label}</span><strong className="summary-tooltip-value" style={{color:metric.color}}>{formatted(selected.value,metric)}</strong>
            <div className="summary-tooltip-row"><span>Matches played</span><span>{selected.item.club?.team.played??"—"}</span></div>
            <div className="summary-tooltip-row"><span>Historical avg</span><span>{benchmarkText(benchmark.value,metric)}</span></div>
            <small>{context}</small>
          </div></foreignObject>}
        </svg>
      </div>
      <figcaption className="summary-chart-legend"><span><i style={{background:metric.color}}/>{metric.label}</span>{benchmark.value!==null&&<span title={`Equal-weight mean of ${benchmark.count} prior played seasons; ongoing seasons excluded.`}><i className="summary-legend-benchmark"/>Historical avg <b>{benchmarkText(benchmark.value,metric)}</b></span>}{range.some(item=>item.ongoing)&&<span><i className="summary-legend-ongoing"/>Ongoing season</span>}</figcaption>
      <span className="summary-chart-accessible-status" role="status" aria-live="polite">{selected?detail(selected.item,selected.value):""}</span>
    </figure>}
  </section>;
}

export default function SeasonEvolutionOverview({range,reference,basis,stage}:{range:HistoricalSeason[];reference:string;basis:OverviewBasis;stage:number}) {
  const [selected,setSelected]=useState<Metric["key"]>("position");
  const shown=range;
  const available=shown.filter(item=>item.club?.team.played);
  const latest=available.find(item=>item.season===reference)??available.at(-1);
  const previousSeasons=latest?available.filter(item=>item.season<latest.season):[];
  const previous=previousSeasons.at(-1);
  const historicalSeasons=previousSeasons.filter(item=>!item.ongoing);
  const metric=metrics.find(item=>item.key===selected)!;
  const description=basis==="stage"?`First ${stage} completed games in each season. Positions reflect standings when the club completed game ${stage}.`:"All completed games, including the ongoing season. Rates are per game; positions reflect current or final standings.";
  return <div className="evolution-overview">
    <div className="summary-shared-context" aria-label="Season summary context">{latest?<><strong>{seasonLabel(latest.season)}</strong><span>{latest.club!.team.played} matches played</span>{latest.ongoing&&<span className="summary-ongoing-label">Ongoing season</span>}</>:<span>No eligible season data</span>}<span className="summary-history-range">{shown.length} seasons · {seasonLabel(shown[0]?.season??reference)}–{seasonLabel(shown.at(-1)?.season??reference)}</span></div>
    <div className="evolution-kpis" role="group" aria-label="Select historical chart metric">{metrics.map(item=>{
      const value=latest?metricValue(latest,item):null,prior=previous?metricValue(previous,item):null;
      const change=value!==null&&prior!==null?value-prior:null;
      const impact=change===null||Math.abs(change)<.000001?"neutral":(item.lower?change<0:change>0)?"better":"worse";
      const averageValues=historicalSeasons.flatMap(season=>{
        const value=metricValue(season,item);
        return value===null?[]:[value];
      });
      const average=averageValues.length?averageValues.reduce((sum,value)=>sum+value,0)/averageValues.length:null;
      const averageChange=value!==null&&average!==null?value-average:null;
      const averageImpact=averageChange===null||(item.key==="position"?Math.round(value!)===Math.round(average!):Math.abs(averageChange)<.000001)?"neutral":(item.lower?averageChange<0:averageChange>0)?"better":"worse";
      const averageDifference=averageChange===null?"":item.key==="position"?`${Math.abs(Math.round(value!)-Math.round(average!))} ${Math.abs(Math.round(value!)-Math.round(average!))===1?"place":"places"} ${averageChange<0?"better":averageChange>0?"worse":"different"}`:`${averageChange>0?"+":""}${averageChange.toFixed(item.key==="winShare"?1:2)}${item.key==="winShare"?" pp":""}`;
      const comparison=change===null?"Previous season unavailable":item.key==="position"?`${change===0?"No change":`${Math.abs(change)} ${Math.abs(change)===1?"place":"places"} ${change<0?"up":"down"}`} vs ${shortSeason(previous!.season)}`:`${change>0?"+":""}${change.toFixed(item.key==="winShare"?1:2)}${item.key==="winShare"?" pp":""} vs ${shortSeason(previous!.season)}`;
      return <button type="button" className="panel evolution-kpi evolution-metric-button" key={item.key} aria-pressed={selected===item.key} aria-controls="evolution-main-chart" onClick={()=>setSelected(item.key)} style={{"--metric-color":item.color} as CSSProperties}>
        <span className="evolution-kpi-label">{item.label}</span><strong>{formatted(value,item)}</strong>
        <span className="evolution-kpi-change" data-impact={impact}>{comparison}</span>
        <span className="evolution-kpi-average" title={`Equal-weight mean of ${averageValues.length} prior played seasons, excluding ${latest?seasonLabel(latest.season):"the selected season"}. ${basis==="stage"?`Each season uses its first ${stage} completed games.`:"Each season uses its own per-game rates."} Average league position is rounded to the nearest whole place.`}>
          {average===null?"Historical average unavailable":<>Historical avg: {item.key==="position"?ordinal(Math.round(average)):formatted(average,item)}<span className="evolution-kpi-change" data-impact={averageImpact}>{averageChange===null?"":(item.key==="position"?Math.round(value!)===Math.round(average!):Math.abs(averageChange)<.000001)?" · No change":` · ${averageDifference}`}</span></>}
        </span>
      </button>;
    })}</div>
    <OverviewChart key={`${selected}:${basis}:${stage}`} range={shown} metric={metric} description={description} historicalSeasons={historicalSeasons} basis={basis} stage={stage}/>
    <section className="panel comparison-card"><header><h3>Historical Season Summary</h3><p>{basis==="perMatch"?"Points, GF, GA and GD are per game; W/D/L and Played remain match counts.":`Cumulative records after the first ${stage} completed games.`}</p></header>
      <div className="comparison-table-scroll" tabIndex={0} role="region" aria-label="Historical season summary"><table className="evolution-table"><thead><tr>{["Season","Position","Played","W","D","L",basis==="perMatch"?"Points / game":"Points","Points / game",basis==="perMatch"?"GF / game":"GF",basis==="perMatch"?"GA / game":"GA",basis==="perMatch"?"GD / game":"GD"].map((label,index)=><th scope="col" key={index}>{label}</th>)}</tr></thead>
        <tbody>{[...shown].reverse().map(item=>{
          const team=item.club?.team,divisor=basis==="perMatch"?team?.played:1;
          const total=(value:number|undefined)=>value===undefined||!divisor?"—":basis==="perMatch"?decimal(value/divisor):String(value);
          return <tr key={item.season} className={item.ongoing||item.season===reference?"historical-reference-cell":undefined}><th scope="row">{seasonLabel(item.season)}</th>
            <td>{ordinal(item.club?.position)}</td><td>{team?.played??"—"}</td><td>{team?.won??"—"}</td><td>{team?.drawn??"—"}</td><td>{team?.lost??"—"}</td><td>{total(team?.points)}</td><td>{team?.played?decimal(team.points/team.played):"—"}</td><td>{total(team?.gf)}</td><td>{total(team?.ga)}</td><td>{total(team?team.gf-team.ga:undefined)}</td></tr>;
        })}</tbody></table></div>
    </section>
    <InsightsPlaceholder insightType="season-evolution" description="Reserved for future analysis of changes in results, attack and defence."/>
  </div>;
}
