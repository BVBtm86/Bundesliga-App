import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title:"Bundesliga | Football Analytics",
  icons:{icon:"/brand/bundesliga-mark.svg"},
  description:"Explore Bundesliga results, team performance and goal trends."
};
export const viewport: Viewport = {width:"device-width", initialScale:1, themeColor:"#1c222a"};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(function(){try{var t=localStorage.getItem('bundesliga-theme'),l=localStorage.getItem('bundesliga-locale'),d=document.documentElement;if(t==='light'||t==='dark')d.dataset.theme=t;else d.dataset.theme='light';if(l==='en'||l==='de'||l==='es'||l==='ro')d.lang=l;}catch(e){}})()`}} /></head><body><I18nProvider>{children}</I18nProvider></body></html>;
}

