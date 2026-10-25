import {useId,useState} from "react";
import type {Bookmark} from "../types";
import {bookmarkReport,companionLink} from "../aklik-deployer";
import type {RepositoryScan} from '../../../../src/repository-scan';
import {publicLink} from '../../../../src/link-report';
import {localBookmarkLaunch,startBookmarkRepository} from '../../../../src/web/bookmark-launch';
export default function LinkInsight({bookmark,checking,retry,deployment}:{bookmark:Bookmark;checking:boolean;retry:()=>void;deployment?:RepositoryScan}){
  const r=bookmarkReport(bookmark.url,bookmark.title,bookmark.linkReport),[open,setOpen]=useState(false),id=useId();
  const [starting,setStarting]=useState(false),[launchError,setLaunchError]=useState(''),[started,setStarted]=useState(false);
  let destination:string|undefined;try{destination=companionLink(bookmark.url);}catch{/* Unsupported/private links remain readable, never sent. */}
  const stale=r.expiresAt&&Date.parse(r.expiresAt)<Date.now(),state=deployment?.state==='online'?'online':deployment?.state==='local'?'pc':checking?'checking':stale?'needs_check':r.state;
  const label=deployment?.state==='online'?'Online öffnen':deployment?.state==='local'?'Lokal vorbereiten':checking?'Wird geprüft':stale?'Erneut prüfen':r.label;
  let action:string|undefined;
  if(!checking){try{const value=deployment?.state==='online'?deployment.launchUrl:deployment?.state==='local'?deployment.inspectUrl:r.online?.url??r.local?.url;if(value){const u=new URL(value);action=u.origin==='http://127.0.0.1:43110'&&u.pathname==='/'?u.href:publicLink(value);}}catch{/* An invalid destination remains a non-interactive status. */}}
  let canStart=false;try{canStart=deployment?.state==='local'&&!checking&&localBookmarkLaunch(location.origin)&&new URL(bookmark.url).hostname==='github.com';}catch{/* Invalid edited bookmarks remain readable. */}
  async function start(){setStarting(true);setLaunchError('');try{await startBookmarkRepository(bookmark.url);setStarted(true);}catch(error){setLaunchError(error instanceof Error?error.message:'Start fehlgeschlagen.');}finally{setStarting(false);}}
  return <div className="link-insight">
    <div className="insight-line">{canStart?<button type="button" className="link-status pc link-status-action" onClick={()=>{void start();}} disabled={starting||started} aria-busy={starting}>{starting?'Start wird geprüft …':started?'Start beauftragt':'Lokal starten'}</button>:action?<a className={`link-status ${state}`} href={action} target="_blank" rel="noopener noreferrer" title={deployment?.note}>{label}</a>:<span className={`link-status ${state}`} role="status" title={deployment?.note}>{label}</span>}<button className="insight-toggle" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>Beschreibung &amp; Nutzungswege <span aria-hidden="true">{open?"−":"+"}</span></button></div>
    {started&&<p className="insight-source" role="status">Start beauftragt. <a href="/#view=projects" target="_blank" rel="noopener noreferrer">Laufzeit und Fortschritt ansehen</a></p>}
    {launchError&&<p className="insight-source" role="alert">{launchError} {destination&&<a href={destination} target="_blank" rel="noopener noreferrer">Startplan öffnen</a>}</p>}
    {deployment&&<p className="insight-source">{deployment.note}</p>}
    <div id={id} className={`insight-drawer ${open?"open":""}`} inert={!open}><div><p>{r.description}</p><p className="insight-source">{r.descriptionSource==="title"?"Vorläufige Einordnung aus Titel und URL":r.descriptionSource==="website"?"Beschreibung aus Webseiten-Metadaten":r.descriptionSource==="catalog"?"Beschreibung aus zugeordneter Projektquelle":"Beschreibung aus Projekt-Metadaten"}{r.checkedAt?" · "+new Date(r.checkedAt).toLocaleDateString("de-DE"):""}</p><ul>{r.cautions.map((c,i)=><li key={i}>{c}</li>)}</ul><div className="insight-actions">{r.online&&<a href={r.online.url} target="_blank" rel="noopener noreferrer">Online öffnen</a>}{r.local&&<a href={r.local.url} target="_blank" rel="noopener noreferrer">Offizielle PC-Downloads</a>}{destination&&<a href={destination} target="_blank" rel="noopener noreferrer">Mit aKlik-Deployer prüfen</a>}<button onClick={retry} disabled={checking}>Erneut prüfen</button></div>{r.evidence.length>0&&<p className="insight-source">Quellen: {r.evidence.map((e,i)=><a key={i} href={e.url} target="_blank" rel="noopener noreferrer">{e.label} </a>)}</p>}</div></div>
  </div>;
}
