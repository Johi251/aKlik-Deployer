import {mkdir,readdir,readFile} from 'node:fs/promises';
import {zipSync} from 'fflate';
await mkdir('.data/releases',{recursive:true});const files:Record<string,Uint8Array>={};
for(const name of await readdir('extension'))files[name]=new Uint8Array(await readFile('extension/'+name));
files['icon-192.png']=new Uint8Array(await readFile('public/icon-192.png'));
for(const browser of ['chrome','edge','brave','opera','vivaldi','firefox']){
 const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));
 if(browser==='firefox')manifest.browser_specific_settings={gecko:{id:'deployer@aklik.app',strict_min_version:'142.0',data_collection_permissions:{required:['none']}}};
 await Bun.write(`.data/releases/aklik-deployer-${browser}.zip`,zipSync({...files,'manifest.json':new TextEncoder().encode(JSON.stringify(manifest,null,2))},{level:6}));
}
console.log('aKlik-Deployer Add-ons: Chrome, Edge, Brave, Opera, Vivaldi und Firefox gebaut.');
