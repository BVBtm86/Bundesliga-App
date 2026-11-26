import { eventHeatmapGrid, heatColor } from "@/lib/spatial-density";

export function EventPitchMarkings({portrait=false}:{portrait?:boolean}){
  return <svg className="event-pitch-markings" viewBox={portrait?"0 0 68 105":"0 0 105 68"} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g className="pitch-lines" transform={portrait?"translate(68 0) rotate(90)":undefined}><rect x="0" y="0" width="105" height="68"/><line className="halfway-line" x1="52.5" y1="0" x2="52.5" y2="68"/><circle className="center-circle" cx="52.5" cy="34" r="9.15"/><circle cx="52.5" cy="34" r=".35" fill="currentColor" stroke="none"/><rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="99.5" y="24.84" width="5.5" height="18.32"/><circle cx="11" cy="34" r=".35" fill="currentColor" stroke="none"/><circle cx="94" cy="34" r=".35" fill="currentColor" stroke="none"/><path d="M16.5 26.69 A9.15 9.15 0 0 1 16.5 41.31"/><path d="M88.5 26.69 A9.15 9.15 0 0 0 88.5 41.31"/><rect x="-2" y="30.34" width="2" height="7.32"/><rect x="105" y="30.34" width="2" height="7.32"/></g></svg>;
}

export function EventHeatmap({values,max,label,portrait=false,teamClass,diverging=false}:{
  values:number[];max:number;label:string;portrait?:boolean;teamClass?:string;diverging?:boolean;
}){
  const {columns,rows}=eventHeatmapGrid(portrait);
  return <svg className="heatmap-overlay heatmap-smooth" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={label}>
    {values.map((value,index)=>{
      const scale=(diverging?Math.abs(value):value)/(max||1);
      return <rect key={index} x={index%columns*100/columns} y={Math.floor(index/columns)*100/rows}
        width={100/columns+.02} height={100/rows+.02} className={teamClass}
        style={{fill:diverging?(value<0?"#488ff2":"#f65e69"):heatColor(scale),opacity:diverging?Math.min(.9,scale*.9):scale>.015?Math.min(.9,.05+Math.pow(scale,.72)*.9):0}}/>;
    })}
  </svg>;
}

export function EventHeatmapLegend({label}:{label:string}){
  return <div className="heatmap-intensity-legend"><i aria-hidden="true"/><span>{label}</span></div>;
}
