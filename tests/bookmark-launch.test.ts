import {test,expect} from 'bun:test';
import {startBookmarkRepository} from '../src/web/bookmark-launch';

test('Lokale Badge: eine Sitzung, erneute Analyse und geschützter Start mit belegtem Port',async()=>{
 const calls:{path:string;init?:RequestInit}[]=[];
 const request:any=async(path:string,init?:RequestInit)=>{calls.push({path,init});return Response.json(path==='/'?{}:path==='/api/analyze'?{id:'analysis',strategy:'dockerfile',license:'MIT',blockers:[],env:[],ports:[8080]}:{id:'project',status:'queued'});};
 const result=await startBookmarkRepository('https://github.com/example/app','http://127.0.0.1:43110',request);
 expect(result.id).toBe('project');expect(calls.map(c=>c.path)).toEqual(['/','/api/analyze','/api/start']);
 expect(JSON.parse(String(calls[2]!.init?.body))).toEqual({analysisId:'analysis',env:{},port:8080});
 expect(calls[2]!.init?.headers).toEqual({'Content-Type':'application/json','X-Aklik-Deployer':'1'});
});
test('Badge startet keine blockierten Projekte oder Projekte mit erforderlichen Angaben',async()=>{
 for(const analysis of [{strategy:'compose',license:'MIT',blockers:['Hostzugriff'],env:[]},{strategy:'compose',license:'MIT',blockers:[],env:[{required:true,name:'API_KEY'}]},{strategy:'unsupported',license:'MIT',blockers:[],env:[]},{strategy:'dockerfile',license:'BUSL-1.1',blockers:[],env:[]}]){
  let starts=0;const request:any=async(path:string)=>{if(path==='/api/start')starts++;return Response.json(path==='/api/analyze'?analysis:{});};
  await expect(startBookmarkRepository('https://github.com/example/app','http://localhost:43110',request)).rejects.toThrow('manuelle Prüfung');expect(starts).toBe(0);
 }
});
test('Öffentliche Webseite und fremde Repository-Hosts dürfen keinen lokalen Start anfordern',async()=>{
 let calls=0;const request:any=async()=>{calls++;return Response.json({});};
 await expect(startBookmarkRepository('https://github.com/example/app','https://aklik-deployer.vercel.app',request)).rejects.toThrow('lokalen');
 await expect(startBookmarkRepository('https://evil.example/app','http://127.0.0.1:43110',request)).rejects.toThrow();expect(calls).toBe(0);
});
