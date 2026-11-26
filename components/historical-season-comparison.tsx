"use client";
import {ArrowLeftRight,Flag,Hand,Shield,Swords,Target,Trophy,TrendingDown,TrendingUp,ChevronDown} from "lucide-react";
import {useState} from "react";
import type {HistoricalSeason} from "./season-evolution-scatter";
import {percentageMetric,type EvolutionMetric} from "@/lib/season-evolution-values";
import {ALL_TEAM_ANALYSIS_CATEGORIES,TEAM_ANALYSIS_METRICS,type TeamAnalysisCategory} from "./team-analysis-metrics";
import TeamAnalysisScatter from "./team-analysis-scatter";

type Category=TeamAnalysisCategory|"results";
const categoryIcons={results:Trophy,attacking:Target,defending:Shield,passing:ArrowLeftRight,possession:Swords,discipline:Flag,goalkeeping:Hand};
const choices=(category:Category):EvolutionMetric[]=>category==="results"?["pointsPerMatch","position","goals","conceded","goalDifference"]:TEAM_ANALYSIS_METRICS[category].map(metric=>metric.key);
const compatible=(key:EvolutionMetric,against:boolean)=>!against||!["pointsPerMatch","position","conceded","goalDifference"].includes(key);
export default function HistoricalSeasonComparison({seasons,latest,against,view,value,label,format,t,context,loading,logo}:{
 seasons:HistoricalSeason[];latest:string;against:boolean;view:"actual"|"rank"|"index";
 value:(season:HistoricalSeason,metric:EvolutionMetric)=>number|null;label:(metric:EvolutionMetric)=>string;format:(value:number|null|undefined,metric:EvolutionMetric)=>string;
 t:(key:string)=>string;context:string;loading:boolean;logo?:string
}){
 const [x,setX]=useState<{category:Category;metric:EvolutionMetric}>({category:"attacking",metric:"goals"});
 const [y,setY]=useState<{category:Category;metric:EvolutionMetric}>({category:"attacking",metric:"shots"});
 const options=(category:Category)=>choices(category).filter(key=>compatible(key,against));
 const xMetric=options(x.category).includes(x.metric)?x.metric:options(x.category)[0];
 const yMetric=options(y.category).includes(y.metric)?y.metric:options(y.category)[0];
 const unit=(key:EvolutionMetric)=>view==="rank"?"rank":view==="index"?"index, league = 100":key==="position"?"position":percentageMetric(key)?"%":"per match";
 const axisLabel=(key:EvolutionMetric)=>`${label(key)}${against?" · Against":""} (${unit(key)})`;
 const points=seasons.flatMap(season=>{const x=value(season,xMetric),y=value(season,yMetric);return x===null||y===null||!Number.isFinite(x)||!Number.isFinite(y)?[]:[{season:season.season,x,y,played:season.club?.team.played??0,ongoing:season.ongoing}];});
 return <section className="panel comparison-card historical-season-comparison">
  <header><h3>Season Comparison</h3><p>Each observation is a season · {context}</p></header>
  <div className="research-scatter-axis-controls historical-template-axis-controls">
   {([["X",x,setX,xMetric],["Y",y,setY,yMetric]] as const).map(([axis,choice,setChoice,metric])=>{
    const CategoryIcon=categoryIcons[choice.category],Direction=against?TrendingDown:TrendingUp;
    return <div className="research-scatter-axis-pair historical-template-axis-group" key={axis}>
     <h4>{axis} axis</h4>
     <label><span>Category</span><span className="historical-template-select"><CategoryIcon className="historical-category-icon" size={17}/><select aria-label={`${axis}-axis category`} value={choice.category} onChange={event=>{const category=event.target.value as Category;setChoice({category,metric:options(category)[0]});}}><option value="results">Results</option>{ALL_TEAM_ANALYSIS_CATEGORIES.map(key=><option key={key} value={key}>{t(`teamAnalysis.${key==="possession"?"possessionCategory":key}`)}</option>)}</select><ChevronDown className="historical-select-chevron" size={14}/></span></label>
     <label><span>Statistic</span><span className="historical-template-select"><Direction size={17}/><select aria-label={`${axis}-axis metric`} value={metric} onChange={event=>setChoice({...choice,metric:event.target.value as EvolutionMetric})}>{options(choice.category).map(key=><option key={key} value={key}>{against?"Against":"For"} · {label(key)}</option>)}</select><ChevronDown className="historical-select-chevron" size={14}/></span></label>
    </div>;
   })}
  </div>
  {loading?<p role="status" className="team-analysis-empty">Loading season comparison…</p>:<TeamAnalysisScatter historical={{points,latest,xLabel:axisLabel(xMetric),yLabel:axisLabel(yMetric),formatX:value=>format(value,xMetric),formatY:value=>format(value,yMetric),rankX:view==="rank"||view==="actual"&&xMetric==="position",rankY:view==="rank"||view==="actual"&&yMetric==="position",averageX:true,averageY:true,context,referenceLogo:logo}}/>}
 </section>;
}
