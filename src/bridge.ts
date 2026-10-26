import {APP_VERSION} from './version';
import {pendingScan, repositoryRef, scanRepository, type RepositoryScan} from './repository-scan';

export function createBridge(port:number, scan=scanRepository){
  const cache=new Map<string,{at:number;result:RepositoryScan}>();let active=0;
  const origins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`,'tauri://localhost','http://tauri.localhost',...(process.env.AKLIK_DEPLOYER_BRIDGE_ORIGINS??'').split(',').filter(Boolean)]);
  return async(request:Request):Promise<Response>=>{
    const url=new URL(request.url),origin=request.headers.get('origin');
    const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
    if(origin&&!origins.has(origin)&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)&&!/^moz-extension:\/\/[a-f0-9-]{36}$/.test(origin))return json({error:'Bridge-Origin nicht freigegeben.'},403);
    if(origin){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, OPTIONS';headers['Access-Control-Allow-Private-Network']='true';}
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='GET')return json({error:'Die Status-Bridge ist ausschließlich lesend.'},405);
    if(url.pathname==='/bridge/v1/health')return json({name:'aKlik-Deployer',version:APP_VERSION,status:'ok',protocol:'aklik-deployer.status.v1'});
    if(url.pathname!=='/bridge/v1/status')return json({error:'Nicht gefunden.'},404);
    try{
      const key=repositoryRef(url.searchParams.get('url')??'').url,existing=cache.get(key);
      if(existing&&(existing.result.state==='checking'||Date.now()-existing.at<300000))return json(existing.result,existing.result.state==='checking'?202:200);
      if(active>=4)return json({error:'Vier Prüfungen laufen bereits. Gleich erneut versuchen.'},429);
      if(cache.size>=128){const old=[...cache].find(([,v])=>v.result.state!=='checking');if(old)cache.delete(old[0]);}
      const item={at:Date.now(),result:pendingScan(key)};cache.set(key,item);active++;
      void scan(key).then(result=>{item.result={...result,inspectUrl:new URL(key).hostname==='github.com'?`http://127.0.0.1:${port}/#inspect=${encodeURIComponent(key)}`:key};},error=>{item.result={...item.result,state:'error',color:'neutral',label:'Erneut prüfen',note:String(error?.message??error).slice(0,500)};}).finally(()=>{item.at=Date.now();active--;});
      return json(item.result,202);
    }catch(error){return json({error:String((error as Error).message)},400);}
  };
}
