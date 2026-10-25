import {publicLink,validLinkReport,type LinkReport} from "./link-report";
export const LINK_REPORT_KEY="aklik-deployer-link-reports-v1";
export function readLinkReport(url:string):LinkReport|undefined {
  try{const value=JSON.parse(localStorage.getItem(LINK_REPORT_KEY)??"{}")[publicLink(url)];return validLinkReport(value,url)?value:undefined;}catch{return undefined;}
}
export function saveLinkReport(report:LinkReport):void {
  if(!validLinkReport(report,report.url))return;
  try{const old=JSON.parse(localStorage.getItem(LINK_REPORT_KEY)??"{}");const all=typeof old==="object"&&old&&!Array.isArray(old)?old:{};all[publicLink(report.url)]=report;const keep=Object.values(all).filter((r:any)=>validLinkReport(r,r?.url)).sort((a:any,b:any)=>b.checkedAt.localeCompare(a.checkedAt)).slice(0,300);localStorage.setItem(LINK_REPORT_KEY,JSON.stringify(Object.fromEntries(keep.map((r:any)=>[r.url,r]))));}catch{/* Full storage must not break analysis. */}
}
export const AKLIK_DEPLOYER_ORIGIN="https://aklik-deployer.pages.dev";
export function aklikDeployerOrigin():string {try{if(location.origin===AKLIK_DEPLOYER_ORIGIN||["localhost","127.0.0.1"].includes(location.hostname)&&location.protocol==="http:")return location.origin;}catch{/* Extension/SSR uses fixed public origin. */}return AKLIK_DEPLOYER_ORIGIN;}
export function companionLink(url:string):string{return aklikDeployerOrigin()+"/#"+new URLSearchParams({inspect:publicLink(url)});}
