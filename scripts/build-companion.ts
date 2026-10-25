import {mkdir,readdir,readFile} from "node:fs/promises";
import {join,resolve,relative} from "node:path";
import {zipSync} from "fflate";
const root=resolve(import.meta.dir,".."),manager=join(root,"integrations/bookmarks-manager"),out=join(root,".data/releases");
await mkdir(out,{recursive:true});
const build=Bun.spawn(["bun","run","build","--base=/bookmarks/"],{cwd:manager,stdout:"inherit",stderr:"inherit",windowsHide:true});if(await build.exited)throw Error("Bookmarks Web-Build fehlgeschlagen.");
const ext=Bun.spawn(["bunx","vite","build","-c","vite.config.ext.ts"],{cwd:manager,stdout:"inherit",stderr:"inherit",windowsHide:true});if(await ext.exited)throw Error("Bookmarks Add-on-Build fehlgeschlagen.");
const background=await Bun.build({entrypoints:[join(manager,"extension/background.ts")],format:"iife",target:"browser",minify:true});
if(!background.success)throw Error("Add-on-Hintergrundskript fehlgeschlagen.");await Bun.write(join(manager,"dist-ext/background.js"),background.outputs[0]!);
async function entries(dir:string,base=dir):Promise<Record<string,Uint8Array>>{const bag:Record<string,Uint8Array>={};for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())Object.assign(bag,await entries(path,base));else bag[relative(base,path).replaceAll("\\","/")]=new Uint8Array(await readFile(path));}return bag;}
for(const browser of ["chrome","firefox"]){const files=await entries(join(manager,"dist-ext"));Object.assign(files,Object.fromEntries(Object.entries(await entries(join(manager,"extension/icons"))).map(([k,v])=>["icons/"+k,v])));
const manifest=await Bun.file(join(manager,browser==="chrome"?"extension/manifest.json":"extension/manifest.firefox.json")).json();manifest.version="1.3.0";manifest.name="Bookmarks Dynamic Manager · aKlik-Deployer";manifest.host_permissions=["http://127.0.0.1:43110/*","https://api.github.com/*","https://huggingface.co/api/*","https://api.microlink.io/*"];if(browser==="firefox")manifest.browser_specific_settings.gecko.id="bookmarks-aklik-deployer@johi251.github.io";files["manifest.json"]=new TextEncoder().encode(JSON.stringify(manifest,null,2));await Bun.write(join(out,"bookmarks-"+browser+".zip"),zipSync(files,{level:6}));}
const origin=process.env.AKLIK_DEPLOYER_PUBLIC_ORIGIN??"https://aklik-deployer.pages.dev";
await Bun.write(join(out,"aklik-deployer-bookmarks.txt"),'<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>aKlik-Deployer</TITLE><H1>aKlik-Deployer</H1><DL><p>\n<DT><A HREF="'+origin+'/">aKlik-Deployer Werkzeugkasten</A>\n<DT><A HREF="'+origin+'/bookmarks/">Bookmarks Manager mit aKlik-Deployer</A>\n</DL><p>\n');
console.log(JSON.stringify({bookmarksBuild:true,extensionPackages:2,output:out}));
