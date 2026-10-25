import {mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {sourceFiles} from './source-files';

const root=resolve(import.meta.dir,'..'),out=join(root,'.data/releases');
await mkdir(out,{recursive:true});
const files:Record<string,Uint8Array>={};
async function add(name:string,path:string){files[name]=new Uint8Array(await readFile(path));}
const source=await sourceFiles(root);
const sourceZip=zipSync(source,{level:6});
await Bun.write(join(out,'aKlik-Deployer-Quellcode.zip'),sourceZip);
files['Quellcode/aKlik-Deployer-Quellcode.zip']=sourceZip;
await add('Windows/aKlik-Deployer-portable.exe',join(out,'aKlik-Deployer.exe'));
await add('Windows/aKlik-Deployer_1.0.0_x64-setup.exe',join(root,'src-tauri/target/release/bundle/nsis/aKlik-Deployer_1.0.0_x64-setup.exe'));
await add('Windows/aKlik-Deployer_1.0.0_x64_en-US.msi',join(root,'src-tauri/target/release/bundle/msi/aKlik-Deployer_1.0.0_x64_en-US.msi'));
for(const browser of ['chrome','edge','brave','opera','vivaldi','firefox'])await add('Browser-Erweiterungen/aklik-deployer-'+browser+'.zip',join(out,'aklik-deployer-'+browser+'.zip'));
for(const browser of ['chrome','firefox'])await add('Browser-Erweiterungen/bookmarks-'+browser+'.zip',join(out,'bookmarks-'+browser+'.zip'));
await add('Lesezeichen/aklik-deployer-bookmarks.html',join(out,'aklik-deployer-bookmarks.txt'));
for(const [name,bytes]of Object.entries(source))if(name.startsWith('docs/'))files['Dokumentation/'+name.slice(5)]=bytes;
await add('Lizenzen/THIRD_PARTY_NOTICES.md',join(root,'THIRD_PARTY_NOTICES.md'));
await add('Lizenzen/licenses.txt',join(root,'public/licenses.txt'));
await add('Lizenzen/LICENSE',join(root,'LICENSE'));
await add('Lizenzen/bun-LICENSE.md',join(out,'bun-LICENSE.md'));
const linux=join(root,'.data/linux-target/release/bundle/deb/aKlik-Deployer_1.0.0_amd64.deb');
if(await Bun.file(linux).exists())await add('Linux/aKlik-Deployer_1.0.0_amd64.deb',linux);
const mac=join(out,'mac');
if(await Bun.file(mac).exists())for(const name of await readdir(mac))if(name.endsWith('.dmg')||name.endsWith('.app.tar.gz'))await add('macOS/'+name,join(mac,name));
files['ZUERST-LESEN.txt']=new TextEncoder().encode(`aKlik-Deployer 1.0.0 – Gesamtpaket\n\n1. Windows: Windows/aKlik-Deployer_1.0.0_x64-setup.exe installieren.\n   Oder Windows/aKlik-Deployer-portable.exe starten (Browser-Oberfläche).\n2. Benutzerhandbuch: Dokumentation/Benutzerhandbuch.pdf oder .html öffnen.\n3. Browser-Erweiterungen: ZIP entpacken, dann nach Handbuch laden.\n4. Vollständiger Quellcode: Quellcode/aKlik-Deployer-Quellcode.zip entpacken.\n5. Web: https://aklik-deployer.pages.dev\n6. Updates: https://github.com/Johi251/aKlik-Deployer/releases\n\nWindows-Pakete sind unsigniert. Firefox-Paket ist temporär ladbar.\nKeine persönlichen Daten, Geheimwerte oder node_modules enthalten.\nAbhängigkeiten werden für eigene Builds nach bun.lock installiert.\nLokale Docker-Funktionen benötigen Docker. Safari-Paket nicht enthalten.\nLinux-DEB wurde unter Ubuntu 26.04 gebaut.\nKommerzielle Bedingungen und Fremdlizenzen: Dokumentation/KOMMERZIELLE-NUTZUNG.md.\n`);
const sums=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,data])=>createHash('sha256').update(data).digest('hex')+'  '+name).join('\n')+'\n';
files['SHA256SUMS.txt']=new TextEncoder().encode(sums);
const zip=zipSync(files,{level:6});
// Verify the generated archive and every checksum before exposing it as a download.
const check=unzipSync(zip);
for(const line of sums.trim().split('\n')){const hash=line.slice(0,64),name=line.slice(66);if(!check[name]||createHash('sha256').update(check[name]!).digest('hex')!==hash)throw Error('Release-Prüfsumme falsch: '+name);}
const name='aKlik-Deployer-Gesamtpaket-1.0.0.zip';
await Bun.write(join(out,name),zip);
const digest=createHash('sha256').update(zip).digest('hex');
await Bun.write(join(out,name+'.sha256'),digest+'  '+name+'\n');
console.log(JSON.stringify({file:join(out,name),bytes:zip.length,sha256:digest,entries:Object.keys(files).length,sourceFiles:Object.keys(source).length}));
