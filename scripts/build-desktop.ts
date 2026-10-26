import {APP_VERSION} from '../src/version';
import {mkdir,readdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {createHash} from "node:crypto";
const root=resolve(import.meta.dir,".."),out=join(root,".data/releases");await mkdir(out,{recursive:true});
const assets:Record<string,string>={"/":join(root,"public/index.html")};
for(const name of ["index.html","app.js","workflow.js","style.css","landing.css","favicon.svg","manifest.webmanifest","sw.js","icon-192.png","icon-512.png","licenses.txt","fonts/manrope-latin.woff2","fonts/Manrope-OFL.txt","fonts/ibm-plex-sans-latin.woff2","fonts/OFL.txt"])assets["/"+name]=join(root,"public",name);
async function collect(dir:string,prefix:string){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory())await collect(join(dir,entry.name),prefix+entry.name+"/");else assets[prefix+entry.name]=join(dir,entry.name);}}
await collect(join(root,"integrations/bookmarks-manager/dist"),"/bookmarks/");
assets["/bookmarks/"]=assets["/bookmarks/index.html"]!;
const imports=Object.entries(assets).map(([,file],i)=>"import asset"+i+" from "+JSON.stringify(file.replaceAll("\\","/"))+" with {type:'file'};").join("\n");
const map="{"+Object.keys(assets).map((url,i)=>JSON.stringify(url)+":asset"+i).join(",")+"}";
const entry=join(out,"desktop-entry.ts");
const template=await Bun.file(join(root,"scripts/desktop-main.template")).text();
await Bun.write(entry,template.replace("__ASSET_IMPORTS__",imports).replace("__ASSET_MAP__",map).replace("__SERVER_PATH__",JSON.stringify(join(root,"src/server.ts").replaceAll("\\","/"))));
const exe=process.env.AKLIK_BUILD_OUT??join(out,"aKlik-Deployer.exe");
const compile=await Bun.build({entrypoints:[entry],target:"bun",minify:true,compile:{outfile:exe,target:(process.env.AKLIK_BUILD_TARGET??'bun-windows-x64') as any}});
if(!compile.success)throw Error(compile.logs.map(x=>x.message).join("\n"));
if(process.argv.includes('--sidecar')){console.log(JSON.stringify({sidecar:exe}));process.exit(0);}
const bytes=new Uint8Array(await Bun.file(exe).arrayBuffer()),parts=[];
for(let offset=0,index=0;offset<bytes.length;offset+=8_000_000,index++){const chunk=bytes.slice(offset,offset+8_000_000),name="aklik-deployer-windows.part"+index;await Bun.write(join(out,name),chunk);parts.push({name,bytes:chunk.length,sha256:createHash("sha256").update(chunk).digest("hex")});}
const manifest={version:APP_VERSION,platform:"Windows x64",signed:false,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),parts};
await Bun.write(join(out,"windows.json"),JSON.stringify(manifest,null,2));console.log(JSON.stringify({exe,bytes:bytes.length,parts:parts.length,sha256:manifest.sha256}));
