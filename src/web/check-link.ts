import {addKnownBrowser,initialLinkReport,publicLink,type LinkReport} from "../link-report";
import {githubText} from "./online-api";
import {recognizedOpenSourceLicense} from "../discovery";
export async function checkLink(value:string,title:string,options:{websiteMetadata?:boolean;signal?:AbortSignal}={}):Promise<LinkReport>{
  const url=publicLink(value),known=addKnownBrowser(initialLinkReport(url,title));
  if(known.state==="online")return known;
  if(new URL(url).hostname==="github.com"){
    const p=new URL(url).pathname.split("/").filter(Boolean);
    if(p.length>=2){
      const base=`https://api.github.com/repos/${encodeURIComponent(p[0]!)}/${encodeURIComponent(p[1]!)}`;
      const meta=JSON.parse(await githubText(base));
      known.title=String(meta.full_name??title).slice(0,250);known.description=String(meta.description??known.description).slice(0,2000);known.descriptionSource="github";known.evidence=[{label:"GitHub-Metadaten",url:`https://github.com/${p[0]}/${p[1]}`}];
      if(recognizedOpenSourceLicense(meta.license?.spdx_id)&&!meta.archived){
        try{const release=JSON.parse(await githubText(base+"/releases/latest"));if(Array.isArray(release.assets)&&release.assets.some((a:{name?:string})=>/\.(exe|msi|msix)$/i.test(a.name??""))){known.state="pc";known.label="PC-Download";known.local={url:`https://github.com/${p[0]}/${p[1]}/releases`,kind:"download",license:meta.license.spdx_id};known.cautions=["Open-Source-Lizenz und Windows-Datei belegt. Installation, vollständiger Gratisumfang und Offline-Betrieb noch nicht praktisch getestet."];}}catch{/* No stable Windows release evidence; keep needs_check. */}
      }
      return known;
    }
    return known;
  }
  if(new URL(url).hostname==="huggingface.co"){
    const parts=new URL(url).pathname.split("/").filter(Boolean);
    if(parts.length===2){const meta=JSON.parse(await githubText(`https://huggingface.co/api/models/${parts.map(encodeURIComponent).join("/")}`));known.description=`KI-Modell ${String(meta.id??title).slice(0,180)}. ${meta.pipeline_tag?"Aufgabe: "+String(meta.pipeline_tag)+". ":""}Cloud-Anbieter, Agenten-Eignung und mögliche Kosten separat prüfen.`;known.descriptionSource="github";known.evidence=[{label:"Hugging-Face-Metadaten",url}];}
    return known;
  }
  if(options.websiteMetadata){
    const response=await fetch("https://api.microlink.io?url="+encodeURIComponent(url)+"&meta=true",{credentials:"omit",referrerPolicy:"no-referrer",signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000)});
    if(!response.ok)throw Error(response.status===429?"Metadaten-Tageslimit erreicht; später erneut prüfen.":"Webseiten-Metadaten derzeit nicht erreichbar.");
    const data=await response.json();
    if(data.status!=="success")throw Error("Webseite liefert keine lesbaren Metadaten.");
    if(typeof data.data?.description==="string"&&data.data.description.trim()){known.description=data.data.description.replace(/<[^>]*>/g," ").replace(/\s+/g," ").slice(0,2000);known.descriptionSource="website";known.evidence=[{label:"Webseiten-Metadaten über Microlink",url}];}
  }
  return known;
}
