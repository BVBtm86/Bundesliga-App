"use client";
import {useEffect,useRef,type ReactNode} from "react";
import {X} from "lucide-react";
export default function HistoricalEvolutionModal({club,logo,metric,context,current,average,difference,children,onClose}:{club:string;logo?:string;metric:string;context:string;current:string;average:string;difference:string;children:ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current;if(!dialog)return;
  const previous=document.body.style.overflow;document.body.style.overflow="hidden";dialog.showModal();
  return()=>{dialog.close();document.body.style.overflow=previous;};
 },[]);
 return <dialog ref={ref} className="historical-evolution-modal" aria-labelledby="historical-evolution-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose();}}>
  <header className="historical-modal-header"><div className="historical-modal-club">{logo&&<img src={logo} alt=""/>}<div><span>{club} · Historical evolution</span><h2 id="historical-evolution-title">{metric}</h2><p>{context}</p></div></div><button type="button" className="historical-modal-close" aria-label="Close historical evolution" onClick={onClose} autoFocus><X size={19}/></button></header>
  <dl className="historical-modal-values"><div><dt>Current season</dt><dd>{current}</dd></div><div><dt>Historical average</dt><dd>{average}</dd></div><div><dt>Vs historical average</dt><dd>{difference}</dd></div></dl>
  <div className="historical-modal-chart">{children}</div>
 </dialog>;
}
