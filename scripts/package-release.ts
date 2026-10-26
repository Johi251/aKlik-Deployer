import {mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {sourceFiles} from './source-files';
import {APP_VERSION} from '../src/version';

const root=resolve(import.meta.dir,'..'),out=join(root,'.data/releases');
const native=resolve(process.env.AKLIK_NATIVE_ROOT??join(out,'native'));
await mkdir(out,{recursive:true});
const files:Record<string,Uint8Array>={};
async function add(name:string,path:string){files[name]=new Uint8Array(await readFile(path));}
for(const platform of ['windows','mac-arm64','mac-intel','linux']){
 const proof=await Bun.file(join(native,platform,'engine-self-test.json')).json();
 if(proof.passed!==true||proof.version!==APP_VERSION)throw Error('Kein passender Engine-Selbsttest: '+platform);
 await add('Pruefberichte/'+platform+'-engine.json',join(native,platform,'engine-self-test.json'));
}
const source=await sourceFiles(root),zipOptions={level:6 as const,mtime:new Date('2026-10-26T00:00:00Z')};
const sourceZip=zipSync(source,zipOptions);
await Bun.write(join(out,'aKlik-Deployer-Quellcode.zip'),sourceZip);
files['Quellcode/aKlik-Deployer-Quellcode.zip']=sourceZip;
const portable=await readFile(join(out,'aKlik-Deployer.exe')),windowsManifest=await Bun.file(join(out,'windows.json')).json();
if(windowsManifest.version!==APP_VERSION||createHash('sha256').update(portable).digest('hex')!==windowsManifest.sha256)throw Error('Portable EXE passt nicht zum aktuellen Release.');
files['Windows/aKlik-Deployer-portable.exe']=new Uint8Array(portable);
const setup=`aKlik-Deployer_${APP_VERSION}_x64-setup.exe`,msi=`aKlik-Deployer_${APP_VERSION}_x64_en-US.msi`;
await add('Windows/'+setup,join(native,'windows/nsis',setup));
await add('Windows/'+msi,join(native,'windows/msi',msi));
for(const [platform,arch] of [['mac-arm64','aarch64'],['mac-intel','x64']]){
 const name=`aKlik-Deployer_${APP_VERSION}_${arch}.dmg`;
 await add('macOS/'+name,join(native,platform!,'dmg',name));
}
const deb=`aKlik-Deployer_${APP_VERSION}_amd64.deb`;
await add('Linux/'+deb,join(native,'linux/deb',deb));
for(const browser of ['chrome','edge','brave','opera','vivaldi','firefox'])await add('Browser-Erweiterungen/aklik-deployer-'+browser+'.zip',join(out,'aklik-deployer-'+browser+'.zip'));
for(const browser of ['chrome','firefox'])await add('Browser-Erweiterungen/bookmarks-'+browser+'.zip',join(out,'bookmarks-'+browser+'.zip'));
await add('Lesezeichen/aklik-deployer-bookmarks.html',join(out,'aklik-deployer-bookmarks.txt'));
for(const [name,bytes]of Object.entries(source))if(name.startsWith('docs/'))files['Dokumentation/'+name.slice(5)]=bytes;
for(const [name,path]of [['THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md'],['licenses.txt','public/licenses.txt'],['LICENSE','LICENSE'],['bun-LICENSE.md','.data/releases/bun-LICENSE.md']])await add('Lizenzen/'+name,join(root,path!));
files['START-AKLIK.cmd']=new TextEncoder().encode('@echo off\r\nstart "" "%~dp0Windows\aKlik-Deployer-portable.exe"\r\n');
files['ZUERST-LESEN.txt']=new TextEncoder().encode(`aKlik-Deployer ${APP_VERSION} – Gesamtpaket\n\nWindows: START-AKLIK.cmd öffnet die portable lokale App.\nEigenes Programmfenster: Windows/${setup} installieren.\nMac: passende DMG unter macOS/ öffnen (aarch64 = Apple Silicon, x64 = Intel).\nHandbuch: Dokumentation/Benutzerhandbuch.pdf oder .html öffnen.\nErweiterungen: ZIP entpacken und nach Handbuch laden.\nQuellcode: Quellcode/aKlik-Deployer-Quellcode.zip entpacken.\nWeb-Demo auf GitHub: https://johi251.github.io/aKlik-Deployer/\nKommerzielle Hosting-Variante: https://aklik-deployer.pages.dev\nUpdates: https://github.com/Johi251/aKlik-Deployer/releases\n\nDiagnose & Hilfe zeigt verfügbare Funktionen und fehlende Voraussetzungen.\nWindows unsigniert, Mac nicht notarisiert, Firefox temporär ladbar.\nNative Bedienung ist durch die Engine-Selbsttests nicht bewiesen.\nDocker-Funktionen benötigen eine lokale Docker-Installation.\nKeine persönlichen Daten, Schlüssel oder node_modules enthalten.\nFremdlizenzen: Dokumentation/KOMMERZIELLE-NUTZUNG.md.\n`);
const sums=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,data])=>createHash('sha256').update(data).digest('hex')+'  '+name).join('\n')+'\n';
files['SHA256SUMS.txt']=new TextEncoder().encode(sums);
const zip=zipSync(files,zipOptions),check=unzipSync(zip);
for(const line of sums.trim().split('\n')){const hash=line.slice(0,64),name=line.slice(66);if(!check[name]||createHash('sha256').update(check[name]!).digest('hex')!==hash)throw Error('Release-Prüfsumme falsch: '+name);}
const name=`aKlik-Deployer-Gesamtpaket-${APP_VERSION}.zip`,digest=createHash('sha256').update(zip).digest('hex');
await Bun.write(join(out,name),zip);
await Bun.write(join(out,name+'.sha256'),digest+'  '+name+'\n');
console.log(JSON.stringify({file:join(out,name),version:APP_VERSION,bytes:zip.length,sha256:digest,entries:Object.keys(files).length,sourceFiles:Object.keys(source).length}));
