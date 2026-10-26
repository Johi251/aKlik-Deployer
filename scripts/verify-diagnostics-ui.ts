import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window=new Window({url:'http://127.0.0.1:43110/',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
const document=window.document;let fail=false,exported:Blob|undefined;
window.fetch=(async(path:string)=>{
 if(path==='/api/state')return Response.json({sources:[],searches:[],favorites:[],analyses:[],projects:[],modelReports:[],modelProfiles:[]});
 if(path==='/api/diagnostics')return fail?Response.json({error:'controlled failure'},{status:503}):Response.json({edition:'local',checkedAt:'2026-10-26T00:00:00Z',checks:[{name:'Git',status:'ok',detail:'PRIVATE_TEST_PATH'},{name:'Docker',status:'warn',detail:'Docker not running'}]});
 throw Error('Unexpected request: '+path);
}) as any;
window.URL.createObjectURL=((blob:Blob)=>{exported=blob;return 'blob:test';}) as any;
window.URL.revokeObjectURL=()=>{};
window.HTMLAnchorElement.prototype.click=function(){};
async function until(check:()=>boolean){for(let i=0;i<50&&!check();i++)await new Promise(r=>setTimeout(r,10));assert.ok(check());}
try{
 document.write(await Bun.file('public/index.html').text());
 const built=await Bun.build({entrypoints:['src/web/app.ts'],format:'iife',target:'browser'});
 assert.ok(built.success);
 window.eval(await built.outputs[0]!.text());
 await new Promise(r=>setTimeout(r,30));
 (document.querySelector('[data-view="diagnostics"]') as any).click();
 const download=document.getElementById('download-diagnostics') as any,refresh=document.getElementById('refresh-diagnostics') as any;
 await until(()=>!download.disabled);
 assert.ok(document.getElementById('diagnostic-readiness')!.textContent.includes('Einrichtung nötig'));
 assert.ok(document.getElementById('diagnostic-readiness')!.textContent.includes('Recherche'));
 download.click();await until(()=>!!exported);
 const report=await exported!.text();assert.ok(!report.includes('PRIVATE_TEST_PATH'));assert.ok(report.includes('aKlik-Deployer'));
 fail=true;refresh.click();assert.equal(download.disabled,true);
 await until(()=>!refresh.disabled);
 assert.equal(download.disabled,true);
 assert.ok(document.getElementById('diagnostic-list')!.textContent.includes('nicht abgeschlossen'));
 fail=false;refresh.click();await until(()=>!download.disabled);
 console.log(JSON.stringify({passed:true,refresh:true,errorRecovery:true,privateDetailsExported:false,visualBrowserCheck:false}));
}finally{await window.happyDOM.abort();window.close();}
