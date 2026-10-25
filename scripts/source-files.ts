import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';

export const sourceRoots=['src','src-tauri','extension','.github','scripts','tests','public','docs','integrations/bookmarks-manager','package.json','bun.lock','tsconfig.json','vercel.json','.gitignore','LICENSE','README.md','DESIGN.md','PRODUCT.md','THIRD_PARTY_NOTICES.md','PUBLIC-BOOKMARKS-UND-DOWNLOADS-V09.md','START-AKLIK-DEPLOYER.cmd','START-AKLIK-BRIDGE.cmd','START-AKLIK-DEPLOYER.sh'];
const excluded=new Set(['node_modules','.git','.data','.tools','target','binaries','dist','dist-ext','releases','__pycache__']);
export function sourceAllowed(name:string){return !excluded.has(name)&&(name==='.env.example'||!/^\.env(?:\.|$)/.test(name))&&!name.endsWith('.log');}
export async function sourceFiles(root:string){
 const files:Record<string,Uint8Array>={};
 async function walk(path:string){
  const stat=await Bun.file(path).stat();
  if(stat.isDirectory()){for(const name of await readdir(path))if(sourceAllowed(name))await walk(join(path,name));}
  else files[relative(root,path).replaceAll('\\','/')]=new Uint8Array(await readFile(path));
 }
 for(const name of sourceRoots)await walk(join(root,name));
 return files;
}
