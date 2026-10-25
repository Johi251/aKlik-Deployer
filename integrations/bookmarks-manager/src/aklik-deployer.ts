import {useEffect,useRef,useState} from "react";
import type {BookmarksApi} from "./hooks/useBookmarks";
import {checkLink} from "../../../src/web/check-link";
import {addKnownBrowser,initialLinkReport,validLinkReport,publicLink,type LinkReport} from "../../../src/link-report";
import {readLinkReport,saveLinkReport,LINK_REPORT_KEY} from "../../../src/link-store";
import {checkLocalBridge} from '../../../src/web/bridge-client';
import type {RepositoryScan} from '../../../src/repository-scan';
export {companionLink} from "../../../src/link-store";
export function bookmarkReport(url:string,title:string,stored?:unknown):LinkReport {
  if(validLinkReport(stored,url))return stored;
  try{return readLinkReport(url)??addKnownBrowser(initialLinkReport(url,title));}
  catch{return {schema:"aklik-deployer.link.v1",url,title,description:"Diesen Link vor einem externen Abruf manuell prüfen.",descriptionSource:"title",state:"needs_check",label:"Noch prüfen",checkedAt:"",expiresAt:"",evidence:[],cautions:["Nur öffentliche HTTPS-Links ohne Geheimwerte werden automatisch abgerufen."],oneClickDeployment:false,fullyLocalTested:false};}
}
export function useLinkEnrichment(api:BookmarksApi){
  const [deployments,setDeployments]=useState<Record<string,RepositoryScan>>({});
  const latest=useRef(api);latest.current=api;
  const [enabled,setEnabled]=useState(()=>localStorage.getItem("bdm-aklik-deployer-auto")!=="off");
  const [web,setWeb]=useState(()=>localStorage.getItem("bdm-aklik-deployer-web")==="on");
  const [checking,setChecking]=useState<string[]>([]),[count,setCount]=useState(0),[epoch,setEpoch]=useState(0);
  const attempted=useRef(new Set<string>()),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const fingerprint=api.state.bookmarks.map(b=>b.id+":"+b.url).join("|");
  useEffect(()=>{
    const sync=()=>{for(const b of latest.current.state.bookmarks){const r=readLinkReport(b.url);if(r&&r.checkedAt!==(b.linkReport?.checkedAt))latest.current.updateBookmark(b.id,{linkReport:r});}};
    window.addEventListener("focus",sync);const receive=(e:StorageEvent)=>{if(e.key===LINK_REPORT_KEY)sync();};window.addEventListener("storage",receive);sync();
    return()=>{window.removeEventListener("focus",sync);window.removeEventListener("storage",receive);};
  },[api.ready]);
  useEffect(()=>{
    setChecking([]);if(!api.ready||!enabled)return;
    let cancelled=false;const controller=new AbortController();let done=0;
    const run=async()=>{
      if(cancelled||done>=8)return;
      const bm=latest.current.state.bookmarks.find(b=>!attempted.current.has(b.id)&&(!validLinkReport(b.linkReport,b.url)||Date.parse(b.linkReport.expiresAt)<Date.now()));
      if(!bm)return;attempted.current.add(bm.id);setChecking([bm.id]);
      let report:LinkReport;
      try{
        publicLink(bm.url);
        await checkLocalBridge(bm.url,controller.signal,result=>{if(!cancelled)setDeployments(previous=>({...previous,[bm.id]:result}));});
        let websiteMetadata=web;
        if(web&&!/https:\/\/(github\.com|huggingface\.co)\//i.test(bm.url)){
          const day=new Date().toISOString().slice(0,10),stored=JSON.parse(localStorage.getItem("bdm-aklik-deployer-quota")??"{}");
          const used=stored.day===day?Number(stored.used)||0:0;
          websiteMetadata=used<20;if(websiteMetadata)localStorage.setItem("bdm-aklik-deployer-quota",JSON.stringify({day,used:used+1}));
        }
        report=await checkLink(bm.url,bm.title,{websiteMetadata,signal:controller.signal});
        if(web&&!websiteMetadata)report.cautions.push("Lokales Metadaten-Tagesbudget erreicht. Weitere Webseiten später prüfen.");
      }catch(e){report=bookmarkReport(bm.url,bm.title);report={...report,state:"needs_check",label:"Noch prüfen",cautions:[String((e as Error).message).slice(0,500)],expiresAt:new Date(Date.now()+3600000).toISOString()};}
      if(cancelled)return;
      latest.current.updateBookmark(bm.id,{linkReport:report});saveLinkReport(report);done++;setCount(c=>c+1);setChecking([]);
      timer.current=setTimeout(()=>{void run();},1800);
    };
    void run();return()=>{cancelled=true;controller.abort();if(timer.current)clearTimeout(timer.current);};
  },[api.ready,fingerprint,enabled,web,epoch]);
  return {enabled,web,checking,count,deployments,toggle(){setEnabled(v=>{localStorage.setItem("bdm-aklik-deployer-auto",v?"off":"on");return !v;});},setWeb(value:boolean){localStorage.setItem("bdm-aklik-deployer-web",value?"on":"off");setWeb(value);if(value)for(const b of latest.current.state.bookmarks)if(b.linkReport?.descriptionSource==="title")latest.current.updateBookmark(b.id,{linkReport:undefined});attempted.current.clear();setEpoch(v=>v+1);},more(){setEpoch(v=>v+1);},retry(id:string){attempted.current.delete(id);setDeployments(previous=>{const next={...previous};delete next[id];return next;});latest.current.updateBookmark(id,{linkReport:undefined});setEpoch(v=>v+1);}};
}
