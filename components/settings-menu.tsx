"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages, Moon, Sun } from "lucide-react";
import { useI18n, type Locale, type Theme } from "@/lib/i18n";

export default function SettingsMenu(){
  const {locale,theme,setLocale,setTheme,t}=useI18n();
  const [openPanel,setOpenPanel]=useState<"appearance"|"language"|null>(null);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const close=(event:MouseEvent)=>{if(!ref.current?.contains(event.target as Node)) setOpenPanel(null);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape") setOpenPanel(null);};
    document.addEventListener("mousedown",close); document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape);};
  },[]);
  const themes:Array<{id:Theme;label:string;icon:typeof Sun}>=[{id:"light",label:t("settings.light"),icon:Sun},{id:"dark",label:t("settings.dark"),icon:Moon}];
  const languages:Array<{id:Locale;label:string}>=[{id:"en",label:t("settings.english")},{id:"de",label:t("settings.german")},{id:"es",label:t("settings.spanish")},{id:"ro",label:t("settings.romanian")}];
  const ActiveThemeIcon = theme === "light" ? Sun : Moon;
  return <div className="settings-menu" ref={ref}>
    <div className="settings-quick-actions">
      <button type="button" className={`settings-quick-trigger ${openPanel === "appearance" ? "active" : ""}`} aria-label={t("settings.appearance")} title={t("settings.appearance")} aria-haspopup="dialog" aria-expanded={openPanel === "appearance"} onClick={()=>setOpenPanel(value=>value === "appearance" ? null : "appearance")}><ActiveThemeIcon size={16}/></button>
      <button type="button" className={`settings-quick-trigger ${openPanel === "language" ? "active" : ""}`} aria-label={t("settings.language")} title={t("settings.language")} aria-haspopup="dialog" aria-expanded={openPanel === "language"} onClick={()=>setOpenPanel(value=>value === "language" ? null : "language")}><span className="settings-language-code">{locale.toUpperCase()}</span></button>
    </div>
    {openPanel&&<div className="settings-popover" role="dialog" aria-label={openPanel === "appearance" ? t("settings.appearance") : t("settings.language")}>
      {openPanel === "appearance" ? <div className="settings-section"><span className="settings-label"><Sun size={13}/>{t("settings.appearance")}</span><div className="settings-options">{themes.map(option=>{const Icon=option.icon;return <button type="button" key={option.id} className={theme===option.id?"selected":""} onClick={()=>setTheme(option.id)}><Icon size={14}/><span>{option.label}</span>{theme===option.id&&<Check size={13}/>}</button>;})}</div></div> : <div className="settings-section"><span className="settings-label"><Languages size={13}/>{t("settings.language")}</span><div className="settings-options">{languages.map(option=><button type="button" key={option.id} className={locale===option.id?"selected":""} onClick={()=>setLocale(option.id)}><span>{option.label}</span>{locale===option.id&&<Check size={13}/>}</button>)}</div></div>}
    </div>}
  </div>;
}
