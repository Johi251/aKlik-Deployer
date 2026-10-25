import { recognizedOpenSourceLicense, canonical } from "./discovery";
import { validatePublicUrl } from "./public-url";
import { hasSecret } from "./matching";
import { browserTools } from "./usage-guide";
import type { Analysis } from "./types";

export type LinkState="online"|"pc"|"needs_check";
export interface LinkReport {
  schema:"aklik-deployer.link.v1"; url:string; title:string; description:string;
  descriptionSource:"catalog"|"github"|"website"|"title";
  state:LinkState; label:string; checkedAt:string; expiresAt:string;
  online?:{url:string;kind:"existing";freeBasis:"project-source"};
  local?:{url:string;kind:"download";license:string};
  evidence:{label:string;url:string}[]; cautions:string[];
  oneClickDeployment:false; fullyLocalTested:false;
}
export function publicLink(value:string):string {
  if(typeof value!=="string"||value.length>2048||hasSecret(value))throw Error("Nur öffentliche Links ohne Geheimwerte prüfen.");
  const u=validatePublicUrl(value);u.hash="";return u.href;
}
export function initialLinkReport(url:string,title:string):LinkReport {
  const safe=publicLink(url),u=new URL(safe),at=new Date();
  return {schema:"aklik-deployer.link.v1",url:safe,title:String(title).slice(0,250)||u.hostname,description:`Gespeicherter Verweis auf ${u.hostname}. Die genaue Funktion und die Nutzungsbedingungen sind noch zu prüfen.`,descriptionSource:"title",state:"needs_check",label:"Noch prüfen",checkedAt:at.toISOString(),expiresAt:new Date(at.getTime()+7*86400000).toISOString(),evidence:[],cautions:["Keine bestätigte Gratis-, Installations- oder Deployment-Zusage."],oneClickDeployment:false,fullyLocalTested:false};
}
export function reportFromAnalysis(a:Omit<Analysis,"files">,originalUrl=a.repository.url):LinkReport {
  const report=initialLinkReport(originalUrl,a.name);report.description=a.description?.slice(0,2000)||report.description;report.descriptionSource="github";
  report.evidence=[{label:"GitHub-Projekt",url:a.repository.url},...a.evidence.slice(0,3).map(e=>({label:e.label,url:e.url}))];
  const native=a.installOptions?.find(o=>o.status==="available"&&o.assets?.length);
  if(native&&recognizedOpenSourceLicense(a.license)&&!a.archived){report.state="pc";report.label="PC-Download";report.local={url:a.repository.url+"/releases",kind:"download",license:a.license};report.cautions=["Open-Source-Lizenz und Windows-Download belegt; vollständig lokaler Betrieb und Installation nicht praktisch getestet."];}
  return addKnownBrowser(report);
}
export function addKnownBrowser(report:LinkReport):LinkReport {
  const normalized=canonical(report.url);
  const known=browserTools.find(t=>[canonical(t.repository),canonical(t.url)].includes(normalized)||new URL(report.url).hostname==="github.com"&&new URL(report.url).pathname.toLowerCase()==="/jgraph/drawio-desktop"&&t.name==="draw.io");
  if(!known)return report;
  return {...report,state:"online",label:"Online öffnen",description:known.features,descriptionSource:"catalog",online:{url:known.url,kind:"existing",freeBasis:"project-source"},evidence:[{label:"Projektquelle",url:known.source},...report.evidence],cautions:[known.cost,"Vorhandenen Browser-Zugang öffnen, kein neues Deployment. Vollständige Funktionen und aktuelle Bedingungen nicht praktisch getestet."]};
}
export function validLinkReport(value:unknown,url:string):value is LinkReport {
  if(!value||typeof value!=="object")return false;const r=value as LinkReport;
  try {
    if(typeof r.checkedAt!=="string"||typeof r.expiresAt!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.checkedAt)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.expiresAt))return false;
    const checked=Date.parse(r.checkedAt),expires=Date.parse(r.expiresAt);
    if(r.schema!=="aklik-deployer.link.v1"||publicLink(r.url)!==publicLink(url)||!["online","pc","needs_check"].includes(r.state)||!["catalog","github","website","title"].includes(r.descriptionSource)||typeof r.title!=="string"||r.title.length>250||typeof r.description!=="string"||r.description.length>3000||r.oneClickDeployment!==false||r.fullyLocalTested!==false||!Number.isFinite(checked)||checked>Date.now()+300000||!Number.isFinite(expires)||expires<=checked||expires-checked>31*86400000)return false;
    const labels={online:"Online öffnen",pc:"PC-Download",needs_check:"Noch prüfen"};
    if(r.label!==labels[r.state]||!Array.isArray(r.evidence)||r.evidence.length>10||!r.evidence.every(e=>typeof e?.label==="string"&&e.label.length<=200&&!!publicLink(e.url))||!Array.isArray(r.cautions)||r.cautions.length>10||!r.cautions.every(c=>typeof c==="string"&&c.length<=1000))return false;
    if(r.online){const expected=addKnownBrowser(initialLinkReport(r.url,r.title));if(r.online.kind!=="existing"||r.online.freeBasis!=="project-source"||expected.online?.url!==publicLink(r.online.url))return false;}
    if(r.local){const u=new URL(publicLink(r.local.url));if(r.local.kind!=="download"||!recognizedOpenSourceLicense(r.local.license)||u.hostname!=="github.com"||!/^\/[^/]+\/[^/]+\/releases$/.test(u.pathname))return false;}
    return (r.state!=="online"||!!r.online&&r.evidence.length>0)&&(r.state!=="pc"||!!r.local&&r.evidence.length>0);
  }catch{return false;}
}
