"use client";
import {heatColor} from "@/lib/spatial-density";
import {useState} from "react";
import {EventPitchMarkings} from "./event-heatmap";
import {zoneLabels,zonePercentages,type DistributionMode,type SpatialDistribution} from "@/lib/spatial-distributions";
export function distributionStatus(sample:SpatialDistribution|undefined){
 if(!sample)return "Loading spatial sample…";
 return sample.status==="absent"?"This club did not participate in this season.":sample.status==="ongoing"?"Ongoing season excluded in Full seasons mode.":sample.status==="insufficient"?"Not enough completed matches for the common stage.":sample.status==="unavailable"?"Recorded event data is unavailable.":sample.status==="partial"?`Partial event coverage: ${sample.covered}/${sample.included} matches. Excluded from differences and historical benchmarks.`:sample.status==="no-events"?"No qualifying events in this sample.":"";
}
export default function SpatialDistributionPitch({sample,mode,side,comparisonSide,colourRange}:{sample:SpatialDistribution|undefined;mode:DistributionMode;side:"for"|"against";comparisonSide:"a"|"b";colourRange:{min:number;max:number}}){
 const [active,setActive]=useState<number|null>(null);
 const counts=sample?.counts[mode]??[0,0,0],total=counts.reduce((a,b)=>a+b,0),percentages=zonePercentages(counts),labels=zoneLabels(mode);
 const status=distributionStatus(sample)||(sample&&sample.status==="complete"&&!percentages?"No qualifying events for this distribution in the selected sample.":"");
 const territory=mode==="territory",shown=sample&&(sample.status==="complete"||sample.status==="partial")&&percentages;
 return <figure className="spatial-comparison-figure distribution-pitch-figure" data-side={comparisonSide}>
  <header>{sample?.logo?<img src={sample.logo} alt=""/>:null}<div><h3>{sample?.name??"Loading team…"}</h3><span>{sample?.season.replace("-","/")}{sample?.ongoing?" · Ongoing season":""}</span></div><span className="distribution-direction">Attack ↑</span></header>
  <div className="spatial-comparison-pitch distribution-pitch"><EventPitchMarkings portrait/>
   <svg viewBox="0 0 68 105" className="distribution-zone-overlay" role="group" aria-label={`${sample?.name??"Team"} ${mode==="territory"?"territorial distribution":"attacking channels"}`}>
    {[0,1,2].map(zone=>{
     const percentage=shown?percentages[zone]:null,x=territory?0:zone*68/3,y=territory?(2-zone)*35:0,width=territory?68:68/3,height=territory?35:105;
     const detail=`${labels[zone]} · ${percentage===null?"Unavailable":`${percentage.toFixed(2)}% · ${counts[zone].toLocaleString()} of ${total.toLocaleString()} qualifying events`} · ${sample?.covered??0}/${sample?.included??0} matches with event data · ${side==="against"?"Opponents’ actions in selected club perspective":"Selected club’s actions"}`;
     return <g key={zone} tabIndex={0} role="img" aria-label={detail} onPointerEnter={()=>setActive(zone)} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive(zone)} onBlur={()=>setActive(null)}>
      <rect x={x} y={y} width={width} height={height} fill={heatColor(((percentage??0)-colourRange.min)/Math.max(1,colourRange.max-colourRange.min))} fillOpacity={percentage?0.72:0} stroke="var(--muted)" strokeOpacity=".16" strokeWidth=".2"/>
      <rect x={territory?17:x+1} y={y+height/2-6} width={territory?34:width-2} height="12" rx="1" className="positional-distribution-label-bg"/>
      <text x={x+width/2} y={y+height/2-1} textAnchor="middle" className="distribution-zone-label">{labels[zone]}</text><text x={x+width/2} y={y+height/2+3.3} textAnchor="middle" className="distribution-zone-value">{percentage===null?"—":`${percentage.toFixed(1)}%`}</text>
      <title>{detail}</title>
     </g>;
    })}
   </svg>
   {active!==null&&shown&&<div role="tooltip" className="distribution-zone-tooltip"><strong>{labels[active]} · {percentages[active].toFixed(2)}%</strong><span>{counts[active].toLocaleString()} / {total.toLocaleString()} qualifying events</span><span>{sample.covered} covered matches</span></div>}
  </div>
  <figcaption>{sample?<><span>{sample.covered}/{sample.included} matches with event data</span><span>{total.toLocaleString()} qualifying {territory?"on-ball actions":"attacking actions"}</span></>:"Loading…"}</figcaption>
  {status&&<p className="distribution-coverage-note">{status}</p>}
 </figure>;
}
