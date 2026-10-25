import {createHash} from 'node:crypto';
const base=process.env.AKLIK_DEPLOYER_VERIFY_ORIGIN??'https://aklik-deployer.vercel.app';
const response=await fetch(base+'/downloads/windows.json');if(!response.ok)throw Error('Release-Manifest fehlt.');
const manifest=await response.json() as {version:string;sha256:string;bytes:number;parts:{name:string;sha256:string;bytes:number}[]};
if(manifest.version!=='1.0.0'||manifest.parts.length>30)throw Error('Falsche Release-Version.');
const total=createHash('sha256');let bytes=0;
for(const part of manifest.parts){
 if(!/^aklik-deployer-windows\.part\d+$/.test(part.name))throw Error('Ungültiger Dateiname.');
 const r=await fetch(base+'/downloads/'+part.name);if(!r.ok)throw Error('Download fehlt: '+part.name);
 const data=Buffer.from(await r.arrayBuffer());
 if(data.length!==part.bytes||createHash('sha256').update(data).digest('hex')!==part.sha256)throw Error('Teil-Prüfsumme falsch: '+part.name);
 total.update(data);bytes+=data.length;
}
if(bytes!==manifest.bytes||total.digest('hex')!==manifest.sha256)throw Error('Gesamt-Prüfsumme falsch.');
const report={checkedAt:new Date().toISOString(),origin:base,version:manifest.version,parts:manifest.parts.length,bytes,sha256:manifest.sha256,passed:true};
await Bun.write('.data/verification/public-download-v1.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
