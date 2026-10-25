import {getJSON, getPublic} from './network';
import {publicLink} from './link-report';
import {recognizedOpenSourceLicense} from './discovery';

export interface RepositoryScan {
  schema:'aklik-deployer.status.v1'; url:string; state:'checking'|'online'|'local'|'needs_review'|'error';
  color:'orange'|'green'|'blue'|'neutral'; label:string; checkedAt:string; evidence:{path:string;url:string}[];
  localReady:boolean; onlineReady:boolean; deploymentCandidate:boolean; runtimeTested:false;
  launchUrl?:string; inspectUrl?:string; note:string; commit?:string;
}
export function pendingScan(url:string):RepositoryScan{return {schema:'aklik-deployer.status.v1',url,state:'checking',color:'orange',label:'Wird geprüft',checkedAt:new Date().toISOString(),evidence:[],localReady:false,onlineReady:false,deploymentCandidate:false,runtimeTested:false,note:'Repository wird statisch gelesen. Es werden keine Projektdateien ausgeführt.'};}
export function repositoryRef(value:string){
  const url=new URL(publicLink(value)),p=url.pathname.split('/').filter(Boolean);
  if(url.search||p.some(s=>! /^[\w.-]+$/.test(s)||s==='.'||s==='..'))throw Error('Bitte einen Repository-Link ohne Abfrageparameter eingeben.');
  if(url.hostname==='github.com'&&p.length===2)return {provider:'github' as const,id:p.join('/').replace(/\.git$/,''),url:`https://github.com/${p.join('/').replace(/\.git$/,'')}`};
  if(url.hostname==='gitlab.com'&&p.length>=2&&p.length<=8&&!p.includes('-'))return {provider:'gitlab' as const,id:p.join('/').replace(/\.git$/,''),url:`https://gitlab.com/${p.join('/').replace(/\.git$/,'')}`};
  if(url.hostname==='huggingface.co'&&p.length===3&&p[0]==='spaces')return {provider:'space' as const,id:p.slice(1).join('/'),url:`https://huggingface.co/${p.join('/')}`};
  throw Error('Unterstützt: öffentliche GitHub-/GitLab-Repositories und Hugging-Face-Spaces.');
}
export async function scanRepository(value:string, io={json:getJSON, page:getPublic}):Promise<RepositoryScan>{
  const ref=repositoryRef(value),result=pendingScan(ref.url);let paths:string[]=[],pkg='',license='',homepage='',archived=false;
  let raw:(path:string)=>string,source:(path:string)=>string;
  if(ref.provider==='github'){
    const api=`https://api.github.com/repos/${ref.id}`,meta=await io.json<any>(api);
    const commit=await io.json<any>(`${api}/commits/${encodeURIComponent(meta.default_branch)}`);result.commit=commit.sha;
    const tree=await io.json<any>(`${api}/git/trees/${commit.commit.tree.sha}?recursive=1`);
    if(tree.truncated||tree.tree.length>25000)throw Error('Repository zu groß für einen vollständigen Schnellcheck.');
    paths=tree.tree.filter((e:any)=>e.type==='blob'&&e.mode!=='120000').map((e:any)=>e.path);
    license=meta.license?.spdx_id??'';homepage=meta.homepage??'';archived=meta.archived===true;
    raw=p=>`https://raw.githubusercontent.com/${ref.id}/${result.commit}/${p}`;
    source=p=>`${ref.url}/blob/${result.commit}/${p}`;
  }else if(ref.provider==='gitlab'){
    const api=`https://gitlab.com/api/v4/projects/${encodeURIComponent(ref.id)}`,meta=await io.json<any>(api+'?license=true');
    const commit=await io.json<any>(`${api}/repository/commits/${encodeURIComponent(meta.default_branch)}`);result.commit=commit.id;
    // Bounded pagination: fail explicitly rather than classify an incomplete tree.
    for(let page=1;page<=10;page++){
      const entries=await io.json<any[]>(`${api}/repository/tree?ref=${commit.id}&recursive=true&per_page=100&page=${page}`);
      paths.push(...entries.filter(e=>e.type==='blob'&&e.mode!=='120000').map(e=>e.path));
      if(entries.length<100)break;if(page===10)throw Error('GitLab-Baum überschreitet das Schnellcheck-Limit.');
    }
    license=meta.license?.key?.toUpperCase()??'';archived=meta.archived===true;
    raw=p=>`${api}/repository/files/${encodeURIComponent(p)}/raw?ref=${commit.id}`;source=p=>`${ref.url}/-/blob/${commit.id}/${p}`;
  }else{
    const meta=await io.json<any>(`https://huggingface.co/api/spaces/${ref.id}`);result.commit=meta.sha;
    paths=(meta.siblings??[]).map((e:any)=>e.rfilename);license=meta.cardData?.license?.toUpperCase()??'';
    if(meta.runtime?.stage==='RUNNING'&&meta.private!==true&&meta.cardData?.sdk==='static')homepage=ref.url;
    raw=p=>`${ref.url}/resolve/${meta.sha}/${p}`;source=p=>`${ref.url}/blob/${meta.sha}/${p}`;
  }
  const relevant=paths.filter(p=>!/(^|\/)(node_modules|vendor|tests?|fixtures|examples?|\.github)\//i.test(p)&&/^(?:.*\/)?(?:Dockerfile|compose\.ya?ml|docker-compose\.ya?ml|START-AKLIK-DEPLOYER\.cmd|START-1CLICKER\.cmd|start\.sh|package\.json|index\.html)$/i.test(p));
  result.evidence=relevant.slice(0,12).map(path=>({path,url:source(path.split('/').map(encodeURIComponent).join('/'))}));
  const packagePath=relevant.find(p=>p==='package.json');
  if(packagePath)pkg=(await io.page(raw(packagePath),{maxBytes:80000})).body.toString('utf8');
  let packageData:any={};try{packageData=JSON.parse(pkg);}catch{/* A broken manifest grants no frontend classification. */}
  const deps={...packageData.dependencies,...packageData.devDependencies};
  const staticBuild=!!packageData.scripts?.build&&/vite|astro|parcel|react-scripts/.test(packageData.scripts.build)&&!deps.electron&&!deps['@tauri-apps/api']&&!deps.express&&!deps.fastify&&!deps.next;
  result.deploymentCandidate=paths.includes('index.html')||staticBuild;
  const localFiles=relevant.filter(p=>/Dockerfile$|(?:docker-)?compose\.ya?ml$|START-(?:AKLIK-DEPLOYER|1CLICKER)\.cmd$|start\.sh$/i.test(p));
  const freeLicense=recognizedOpenSourceLicense(license);
  result.localReady=localFiles.length>0&&freeLicense&&!archived;
  // Only recognized demo hosts plus an OSS basis earn green; arbitrary marketing homepages do not.
  if(homepage&&freeLicense&&!archived){try{
    const demo=new URL(publicLink(homepage));
    if(/\.(github\.io|vercel\.app|pages\.dev|hf\.space)$/.test(demo.hostname)||(ref.provider==='space'&&homepage===ref.url)){
      const response=await io.page(demo.href,{maxBytes:1000000,timeout:8000});
      const final=new URL(response.url);
      if(response.type.includes('text/html')&&final.origin===demo.origin&&!/vercel authentication|sign in to vercel/i.test(response.body.toString('utf8'))){result.onlineReady=true;result.launchUrl=demo.href;result.evidence.unshift({path:'Erreichbare Projekt-Demo',url:demo.href});}
    }
  }catch{/* An unreachable demo remains a candidate, never green. */}}
  result.state=result.onlineReady?'online':result.localReady?'local':'needs_review';
  result.color=result.onlineReady?'green':result.localReady?'blue':'neutral';
  result.label=result.onlineReady?'Online öffnen':result.localReady?'Lokal vorbereiten':'Noch prüfen';
  result.checkedAt=new Date().toISOString();
  result.note=result.onlineReady?'Projekt-Demo erreichbar; Basisfunktion und aktuelle Nutzungslimits bitte im Angebot prüfen.':result.localReady?`Open-Source-Lizenz und lokaler Startweg erkannt: ${localFiles.join(', ')}. Docker bzw. Laufzeit erforderlich; Ausführung und externe Dienste ungeprüft.`:result.deploymentCandidate?'Frontend erkannt: Vercel/Cloudflare-Kandidat. Noch kein bestätigter kostenloser Browserzugang.':'Kein belegter kostenloser Ein-Klick-Weg. Projektanleitung prüfen.';
  return result;
}
