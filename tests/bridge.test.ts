import {test,expect} from 'bun:test';
import {createBridge} from '../src/bridge';
import {pendingScan,repositoryRef,scanRepository} from '../src/repository-scan';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('Bridge: Prüfung läuft asynchron, gleiche URL wird nur einmal geprüft',async()=>{
 let resolve!:(value:any)=>void,calls=0;
 const bridge=createBridge(43110,async url=>{calls++;return new Promise(done=>{resolve=done;});});
 const req=()=>new Request('http://127.0.0.1:43110/bridge/v1/status?url=https://github.com/test/app');
 expect((await bridge(req())).status).toBe(202);expect((await (await bridge(req())).json()).color).toBe('orange');expect(calls).toBe(1);
 resolve({...pendingScan('https://github.com/test/app'),state:'local',color:'blue'});await tick();
 expect((await (await bridge(req())).json()).color).toBe('blue');expect(calls).toBe(1);
});
test('Bridge: fremde Origins, private URLs und Schreibzugriffe bleiben gesperrt',async()=>{
 const bridge=createBridge(43110);const base='http://127.0.0.1:43110/bridge/v1/';
 expect((await bridge(new Request(base+'health',{headers:{Origin:'https://evil.example'}}))).status).toBe(403);
 expect((await bridge(new Request(base+'status?url=https://127.0.0.1/'))).status).toBe(400);
 expect((await bridge(new Request(base+'status',{method:'POST'}))).status).toBe(405);
 expect((await bridge(new Request(base+'health',{headers:{Origin:'chrome-extension://'+'a'.repeat(32)}}))).headers.get('access-control-allow-origin')).toBe('chrome-extension://'+'a'.repeat(32));
});
test('Bridge: Parallelität begrenzt und Fehler verlassen Orange',async()=>{
 const bridge=createBridge(43110,()=>new Promise(()=>{}));
 for(let i=0;i<4;i++)expect((await bridge(new Request('http://localhost/bridge/v1/status?url=https://github.com/test/app'+i))).status).toBe(202);
 expect((await bridge(new Request('http://localhost/bridge/v1/status?url=https://github.com/test/fifth'))).status).toBe(429);
 const broken=createBridge(43110,async()=>{throw Error('Limit erreicht');});const req=new Request('http://localhost/bridge/v1/status?url=https://github.com/test/app');
 await broken(req);await tick();expect((await (await broken(req)).json()).state).toBe('error');
});
test('Repository-Scanner: Frontend-Kandidat wird nicht als bestehende Gratis-Demo ausgegeben',async()=>{
 const io:any={json:async(url:string)=>url.includes('/commits/')?{sha:'abc',commit:{tree:{sha:'tree'}}}:url.includes('/git/trees/')?{tree:[{path:'package.json',type:'blob'},{path:'Dockerfile',type:'blob'}],truncated:false}:{default_branch:'main',license:{spdx_id:'MIT'}},page:async()=>({body:Buffer.from(JSON.stringify({scripts:{build:'vite build'}}))})};
 const result=await scanRepository('https://github.com/test/app',io);expect(result.color).toBe('blue');expect(result.deploymentCandidate).toBe(true);expect(result.onlineReady).toBe(false);expect(result.runtimeTested).toBe(false);
 io.json=async(url:string)=>url.includes('/commits/')?{sha:'abc',commit:{tree:{sha:'tree'}}}:url.includes('/git/trees/')?{tree:[{path:'Dockerfile',type:'blob'}],truncated:false}:{default_branch:'main',license:{spdx_id:'NOASSERTION'}};
 expect((await scanRepository('https://github.com/test/app',io)).color).toBe('neutral');
});
test('Scanner: erlaubte Demo muss erreichbar sein; Marketingseite bleibt ungeprüft',async()=>{
 const io:any={json:async(url:string)=>url.includes('/commits/')?{sha:'abc',commit:{tree:{sha:'tree'}}}:url.includes('/git/trees/')?{tree:[],truncated:false}:{default_branch:'main',license:{spdx_id:'MIT'},homepage:'https://demo.pages.dev'},page:async()=>({body:Buffer.from('<html>Demo</html>'),type:'text/html',url:'https://demo.pages.dev/'})};
 expect((await scanRepository('https://github.com/test/app',io)).color).toBe('green');
 io.page=async()=>{throw Error('offline');};expect((await scanRepository('https://github.com/test/app',io)).onlineReady).toBe(false);
});
test('Repository-Parser erkennt GitLab-Untergruppen und Spaces, blockiert Secrets und Fremdhosts',()=>{
 expect(repositoryRef('https://gitlab.com/team/group/app').id).toBe('team/group/app');expect(repositoryRef('https://huggingface.co/spaces/team/app').provider).toBe('space');
 expect(()=>repositoryRef('https://github.com/team/app?token=secret')).toThrow();expect(()=>repositoryRef('https://example.com/team/app')).toThrow();
});
