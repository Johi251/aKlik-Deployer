import {join,resolve} from 'node:path';
import {readdir} from 'node:fs/promises';
const root=resolve(import.meta.dir,'..');
const packages=['react','react-dom','scheduler','remotion','@remotion/player','@remotion/media-utils','@remotion/media','@remotion/streaming','ai','@ai-sdk/provider','@ai-sdk/provider-utils','@opentelemetry/api','eventsource-parser','json-schema','zod','fflate','yaml'];
const parts=['aKlik-Deployer 0.9.0 — Distribution notices. Exact dependency versions: bun.lock.\nBookmarks Dynamic Manager integration: Johi251/bookmarks-dynamic-manager; changes distributed by the project owner.\nApplication source and rebuild scripts: /aklik-deployer-local.zip\nBun runtime source/relink guidance: https://bun.sh/docs/project/license; https://github.com/oven-sh/bun/tree/bun-v1.4.2; https://github.com/oven-sh/WebKit'];
for(const pkg of packages){const dir=join(root,'node_modules',pkg);let names:string[];try{names=await readdir(dir);}catch{continue;}for(const name of names.filter(n=>/^(LICENSE|NOTICE|THIRD_PARTY_LICENSES)(\.|$)/i.test(n))){const file=Bun.file(join(dir,name));if((await file.stat()).isFile())parts.push(pkg+' / '+name+'\n'+await file.text());}}
for(const name of ['public/fonts/Manrope-OFL.txt','public/fonts/OFL.txt','.data/releases/bun-LICENSE.md'])parts.push(name+'\n'+await Bun.file(join(root,name)).text());
await Bun.write(join(root,'public/licenses.txt'),parts.join('\n\n========================================\n\n'));
console.log(JSON.stringify({noticesWritten:true,sections:parts.length,bytes:Bun.file(join(root,'public/licenses.txt')).size}));
