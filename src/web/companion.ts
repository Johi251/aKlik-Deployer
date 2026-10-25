import {publicLink,reportFromAnalysis} from "../link-report";
import {saveLinkReport} from "../link-store";
import type {Analysis} from "../types";
export function shareAnalysis(a:Omit<Analysis,"files">){saveLinkReport(reportFromAnalysis(a));}
export function setupCompanion(openView:(name:string)=>void,inspect:(url:string)=>Promise<void>,search:(url:string)=>void){
  async function incoming(){const hash=new URLSearchParams(location.hash.slice(1));if(["companion","projects"].includes(hash.get("view")??'')){openView(hash.get("view")!);return;}if(!hash.has("inspect"))return;
    try{const url=publicLink(hash.get("inspect")!);history.replaceState(null,"",location.pathname+location.search);if(new URL(url).hostname==="github.com"){openView("analyze");(document.getElementById("repo-url") as HTMLInputElement).value=url;await inspect(url);}else if(["huggingface.co","pirateface.co"].includes(new URL(url).hostname)){openView("models");(document.getElementById("model-url") as HTMLInputElement).value=url;(document.getElementById("model-form") as HTMLFormElement).requestSubmit();}else{openView("discover");search(url);}}catch{openView("discover");}}
  if(typeof location!=="undefined"){window.addEventListener("hashchange",()=>{void incoming();});void incoming();}
  const button=document.getElementById("desktop-download") as HTMLButtonElement|null;
  button?.addEventListener("click",async()=>{
    const status=document.getElementById("download-progress")!;button.disabled=true;status.textContent="Windows-App wird geladen …";
    try{
      const manifest=await fetch("/downloads/windows.json").then(r=>{if(!r.ok)throw Error("Download gerade nicht verfügbar.");return r.json();});
      if(!Array.isArray(manifest.parts)||manifest.parts.length>30||manifest.bytes>180_000_000)throw Error("Ungültiges Downloadpaket.");
      const chunks:Uint8Array[]=[];
      for(let i=0;i<manifest.parts.length;i++){const part=manifest.parts[i];if(!/^aklik-deployer-windows\.part\d+$/.test(part.name))throw Error("Ungültige Paketdatei.");const r=await fetch("/downloads/"+part.name);if(!r.ok)throw Error("Download unterbrochen. Erneut versuchen.");const data=new Uint8Array(await r.arrayBuffer());const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",data))].map(b=>b.toString(16).padStart(2,"0")).join("");if(hash!==part.sha256||data.length!==part.bytes)throw Error("Prüfsumme stimmt nicht. Erneut herunterladen.");chunks.push(data);status.textContent=`Windows-App laden: ${Math.round((i+1)/manifest.parts.length*100)} %`;}
      if(chunks.reduce((n,c)=>n+c.length,0)!==manifest.bytes)throw Error("Download unvollständig.");
      const blob=new Blob(chunks as BlobPart[],{type:"application/vnd.microsoft.portable-executable"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="aKlik-Deployer.exe";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent="Download bereit. Öffne aKlik-Deployer.exe nach dem Speichern; die App startet lokal auf deinem PC.";
    }catch(e){status.textContent=(e as Error).message;}finally{button.disabled=false;}
  });
  let install:Event&{prompt:()=>Promise<void>}|undefined;
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();install=event as typeof install;});
  document.getElementById("install-app")?.addEventListener("click",async()=>{const status=document.getElementById("install-help")!;if(install){await install.prompt();install=undefined;}else status.textContent="Chrome/Edge: Browsermenü → App installieren. Safari: Teilen → Zum Home-Bildschirm. Firefox: Als Lesezeichen speichern. Die lokale Windows-App gibt es als separaten EXE-Download.";});
  if(document.body.dataset.mode==="online"&&"serviceWorker"in navigator&&typeof navigator.serviceWorker.register==="function")void navigator.serviceWorker.register("/sw.js").catch(()=>{});
}
