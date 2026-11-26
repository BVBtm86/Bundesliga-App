"use client";

import {useState} from "react";
import type {Dashboard} from "@/lib/types";
import {fullScope,type SeasonScope} from "@/lib/team-season-comparison";
import TeamSpatialComparison from "./team-spatial-comparison";
import {useSpatialDistributions} from "./use-spatial-distributions";

type Metadata={seasons:{season:string;teams:{id:number}[]}[]};

export default function SeasonSpatialWorkspace({data,teamId,season}:{data:Dashboard;teamId:number;season:string}) {
  const seasons=[...new Set([...(data.teamAnalysisSeasons??data.seasons).filter(value=>value>="2009-2010"),season])].sort();
  const metadata=useSpatialDistributions<Metadata>("/api/spatial-distributions?"+new URLSearchParams({metadata:"1",seasons:seasons.join(",")}));
  const eligible=metadata.value?.seasons.filter(sample=>sample.teams.some(team=>team.id===teamId)).map(sample=>sample.season)??seasons;
  const [primary,setPrimary]=useState(season);
  const [comparison,setComparison]=useState(seasons.filter(value=>value<season).at(-1)??season);
  const [basis,setBasis]=useState<"stage"|"perMatch">("stage");
  const [scope,setScope]=useState<SeasonScope>(fullScope);
  return <div className="team-comparison-spatial season-spatial-workspace">
    <div className="team-analysis-shared-filters spatial-parent-filters">
      {([primary,comparison] as const).map((value,index)=><label key={index}><span>{index?"Comparison season":"Primary season"}</span><select aria-label={index?"Comparison season":"Primary season"} value={value} onChange={event=>(index?setComparison:setPrimary)(event.target.value)}>{[...new Set([...eligible,value])].sort().reverse().map(item=><option key={item} value={item}>{item.replace("-","/")}</option>)}</select></label>)}
      <label><span>Comparison basis</span><select aria-label="Spatial comparison basis" value={basis} onChange={event=>setBasis(event.target.value as typeof basis)}><option value="stage">Same Stage</option><option value="perMatch">Season</option></select></label>
      <label><span>Venue</span><select aria-label="Venue" value={scope.venue} onChange={event=>setScope(current=>({...current,venue:event.target.value as SeasonScope["venue"]}))}><option value="all">All venues</option><option value="home">Home</option><option value="away">Away</option></select></label>
      <label><span>Match period</span><select aria-label="Match period" value={scope.period} onChange={event=>setScope(current=>({...current,period:event.target.value as SeasonScope["period"]}))}><option value="ft">Full match</option><option value="fh">First half</option><option value="sh">Second half</option></select></label>
    </div>
    <TeamSpatialComparison data={data} teams={[teamId,teamId]} season={primary} secondSeason={comparison} scope={scope} comparisonBasis={basis}/>
  </div>;
}
