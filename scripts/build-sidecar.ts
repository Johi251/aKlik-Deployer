import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const version=Bun.spawnSync(['rustc','-vV']);if(version.exitCode)throw Error('Rust fehlt.');
const triple=/host: (.+)/.exec(version.stdout.toString())?.[1]?.trim();
const targets:Record<string,string>={'x86_64-pc-windows-msvc':'bun-windows-x64','aarch64-apple-darwin':'bun-darwin-arm64','x86_64-apple-darwin':'bun-darwin-x64','x86_64-unknown-linux-gnu':'bun-linux-x64'};
if(!triple||!targets[triple])throw Error('Nicht unterstütztes Build-System: '+triple);
await mkdir('src-tauri/binaries',{recursive:true});
const build=Bun.spawn(['bun','scripts/build-desktop.ts','--sidecar'],{stdout:'inherit',stderr:'inherit',env:{...process.env,AKLIK_BUILD_TARGET:targets[triple],AKLIK_BUILD_OUT:join('src-tauri/binaries','aklik-engine-'+triple+(process.platform==='win32'?'.exe':''))},windowsHide:true});
if(await build.exited)throw Error('Engine-Build fehlgeschlagen.');
