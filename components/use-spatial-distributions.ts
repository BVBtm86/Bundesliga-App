"use client";
import {useEffect,useState} from "react";
const cache=new Map<string,{until:number;value:unknown}>();
export function useSpatialDistributions<T>(url:string){
 const [state,setState]=useState<{url:string;value?:T;error?:boolean}>(),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!url)return;
  const hit=cache.get(url);if(hit&&hit.until>Date.now()){setState({url,value:hit.value as T});return;}
  const controller=new AbortController();
  fetch(url,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error("Spatial data unavailable");const value=await response.json() as T;if(controller.signal.aborted)return;if(cache.size>30)cache.delete(cache.keys().next().value!);cache.set(url,{until:Date.now()+60000,value});setState({url,value});}).catch(()=>{if(!controller.signal.aborted)setState({url,error:true});});
  return()=>controller.abort();
 },[url,revision]);
 return {value:state?.url===url?state.value:undefined,error:state?.url===url&&state.error,retry:()=>{cache.delete(url);setState(undefined);setRevision(value=>value+1);}};
}
