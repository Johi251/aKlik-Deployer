import {APP_VERSION} from '../src/version';
import {webBase} from '../src/web/paths';
import {unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dir,'..'),dist=join(root,'sites/aklik-deployer-online/dist');
const base=webBase(process.env.AKLIK_WEB_BASE??'/');
const main=await Bun.file(join(dist,'index.html')).text(),bookmarkFile=await Bun.file(join(dist,'downloads/aklik-deployer-bookmarks.txt')).text();
if(!main.includes('href="'+base+'downloads/aklik-deployer-bookmarks.txt" download="aklik-deployer-bookmarks.html"')||!bookmarkFile.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')||bookmarkFile.includes('<script'))throw Error('Lesezeichen-Importdatei ist nicht sauber oder der Download-Dateiname fehlt.');
const manifest=await Bun.file(join(dist,'downloads/windows.json')).json(),whole=createHash('sha256');let bytes=0;
if(manifest.version!==APP_VERSION)throw Error('Falsche Version im Windows-Download.');
for(const part of manifest.parts){const data=new Uint8Array(await Bun.file(join(dist,'downloads',part.name)).arrayBuffer());if(data.length!==part.bytes||createHash('sha256').update(data).digest('hex')!==part.sha256)throw Error('Download-Teil stimmt nicht: '+part.name);bytes+=data.length;whole.update(data);}
if(bytes!==manifest.bytes||whole.digest('hex')!==manifest.sha256)throw Error('Zusammengesetzte EXE stimmt nicht.');
const source=unzipSync(new Uint8Array(await Bun.file(join(dist,'aklik-deployer-local.zip')).arrayBuffer()));
if(Object.keys(source).some(p=>/(^|\/)(\.data|\.env[^/]*|\.git|node_modules)(\/|$)|\.exe$/i.test(p)))throw Error('Unerlaubte Dateien im Quellpaket.');
for(const name of ['src/link-report.ts','integrations/bookmarks-manager/src/components/LinkInsight.tsx','public/licenses.txt','PUBLIC-BOOKMARKS-UND-DOWNLOADS-V09.md'])if(!source[name])throw Error('Quellpaket unvollständig: '+name);
for(const browser of ['chrome','firefox']){const archive=unzipSync(new Uint8Array(await Bun.file(join(dist,'downloads/bookmarks-'+browser+'.zip')).arrayBuffer()));const m=JSON.parse(new TextDecoder().decode(archive['manifest.json']));if(m.version!=='1.3.0'||!archive['manager.html']||!archive['background.js']||m.host_permissions.includes('<all_urls>'))throw Error('Erweiterungspaket unvollständig oder zu weit berechtigt.');}
for(const browser of ['chrome','edge','brave','opera','vivaldi','firefox']){
 const archive=unzipSync(new Uint8Array(await Bun.file(join(dist,'downloads/aklik-deployer-'+browser+'.zip')).arrayBuffer()));
 const manifest=JSON.parse(new TextDecoder().decode(archive['manifest.json']));
 if(manifest.name!=='aKlik-Deployer'||manifest.version!==APP_VERSION||manifest.manifest_version!==3||JSON.stringify(manifest.permissions)!=='["activeTab"]'||JSON.stringify(manifest.host_permissions)!=='["http://127.0.0.1:43110/*"]')throw Error('Deployer-Add-on mit unerwarteten Berechtigungen.');
 for(const file of [manifest.action?.default_popup,'popup.js','popup.css','icon-192.png'])if(typeof file!=='string'||!archive[file])throw Error('Deployer-Add-on-Ressource fehlt: '+file);
 if(browser==='firefox'&&!manifest.browser_specific_settings?.gecko?.id)throw Error('Firefox-Identität fehlt.');
}
const html=await Bun.file(join(dist,'bookmarks/index.html')).text();for(const [,asset]of html.matchAll(new RegExp('(?:src|href)="('+base+'bookmarks/assets/[^"?#]+)"','g')))if(!await Bun.file(join(dist,asset!.slice(base.length))).exists())throw Error('Bookmarks-Asset fehlt: '+asset);
const localBookmarks=await Bun.file(join(root,'integrations/bookmarks-manager/dist/index.html')).text();
if(!localBookmarks.includes('src="/bookmarks/assets/')||localBookmarks.includes('src="/aKlik-Deployer/'))throw Error('Desktop-Bookmarks wurden mit dem Web-Unterpfad gebaut.');
const events=new Map<string,Function>(),deleted:string[]=[];
const prefix='bdm-aklik-deployer-'+base+'bookmarks/v';let activated:Promise<unknown>=Promise.resolve();
const workerSelf={location:{href:'https://example.org'+base+'bookmarks/sw.js'},addEventListener:(name:string,handler:Function)=>events.set(name,handler),skipWaiting:()=>{},clients:{claim:async()=>{}}};
new Function('self','caches',await Bun.file(join(dist,'bookmarks/sw.js')).text())(workerSelf,{keys:async()=>['bdm-other-app',prefix+'1.2.0',prefix+'1.3.0','aklik-deployer-shell-/v110'],delete:async(key:string)=>{deleted.push(key);return true;}});
events.get('activate')!({waitUntil:(pending:Promise<unknown>)=>{activated=pending;}});await activated;
if(JSON.stringify(deleted)!==JSON.stringify([prefix+'1.2.0']))throw Error('Bookmarks löscht fremde Offline-Caches.');
for(const name of ['manifest.webmanifest','sw.js','icon-192.png','icon-512.png','licenses.txt'])if(!await Bun.file(join(dist,name)).exists())throw Error('Browser-App-Asset fehlt: '+name);
const proof={passed:true,windowsBytes:bytes,windowsParts:manifest.parts.length,sha256:manifest.sha256,sourceFiles:Object.keys(source).length,personalDataFilesIncluded:false,extensions:8,browserStoreInstallationTested:false,browserVisualTest:false};
await Bun.write(join(root,'.data/verification/companion-artifacts-v1.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
