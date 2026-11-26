import type { PassingNetworkEdge } from "@/lib/passing-network";

export default function PassingPartners({heading,edges,playerName,direction,max}: {
  heading:string;edges:PassingNetworkEdge[];playerName:(id:number)=>string|undefined;direction:"sent"|"received";max:number;
}) {
  const top=[...edges].sort((a,b)=>b.count-a.count||
    (direction==="sent"?a.to-b.to:a.from-b.from)).slice(0,5);
  return <div className="spatial-passing-partners"><h4>{heading}</h4>
    {top.length?<ol>{top.map(edge=>{
      const id=direction==="sent"?edge.to:edge.from;
      const name=playerName(id)??`Player ${id}`;
      return <li key={id}>
        <div><strong>{name}</strong><b>{edge.count.toLocaleString()}</b></div>
        <span className="spatial-passing-bar" aria-hidden="true"><i style={{width:`${100*edge.count/max}%`}}/></span>
      </li>;
    })}</ol>:<p>No completed passes.</p>}
  </div>;
}
