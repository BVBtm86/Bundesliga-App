"use client";

import { ChartNoAxesColumnIncreasing, Map, Network } from "lucide-react";

export type AnalyticalSection = "stats" | "spatial" | "tactical";
const sections = [
  ["stats", "Statistics", ChartNoAxesColumnIncreasing],
  ["spatial", "Spatial Analysis", Map],
  ["tactical", "Tactical Analysis", Network],
] as const;

export default function AnalyticalSectionNavigation({value,onChange,label}:{value:AnalyticalSection;onChange:(value:AnalyticalSection)=>void;label:string}) {
  return <nav className="team-analysis-tabs analytical-section-tabs" aria-label={label}>
    {sections.map(([id,title,Icon])=><button key={id} type="button" className={value===id?"active":""} aria-pressed={value===id} onClick={()=>onChange(id)}><Icon size={16} aria-hidden="true"/>{title}</button>)}
  </nav>;
}

export function TacticalAnalysisPlaceholder() {
  return <div className="tactical-analysis-placeholder" role="status"><p>Tactical intelligence is planned for a future release.</p></div>;
}
