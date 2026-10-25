import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const targets=[
  {triple:'x86_64-unknown-linux-gnu',target:'bun-linux-x64',format:'ELF',machine:62},
  {triple:'x86_64-apple-darwin',target:'bun-darwin-x64',format:'Mach-O',machine:0x01000007},
  {triple:'aarch64-apple-darwin',target:'bun-darwin-arm64',format:'Mach-O',machine:0x0100000c},
];
await mkdir('.data/verification',{recursive:true});
await mkdir('src-tauri/binaries',{recursive:true});
const results=[];
for(const platform of targets){
  const output=resolve('src-tauri/binaries','aklik-engine-'+platform.triple);
  const build=Bun.spawn(['bun','scripts/build-desktop.ts','--sidecar'],{stdout:'inherit',stderr:'inherit',windowsHide:true,env:{...process.env,AKLIK_BUILD_TARGET:platform.target,AKLIK_BUILD_OUT:output}});
  if(await build.exited)throw Error('Cross-Build fehlgeschlagen: '+platform.triple);
  const bytes=Buffer.from(await Bun.file(output).arrayBuffer());
  const valid=platform.format==='ELF'?bytes.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))&&bytes[4]===2&&bytes.readUInt16LE(18)===platform.machine:bytes.readUInt32LE(0)===0xfeedfacf&&bytes.readUInt32LE(4)===platform.machine;
  if(!valid)throw Error('Falsches Binärformat oder falsche Architektur: '+platform.triple);
  let runtimeProof:unknown;
  if(platform.format==='ELF'&&process.argv.includes('--linux-runtime')){
    const linuxOutput=process.platform==='win32'?'/mnt/'+output[0]!.toLowerCase()+output.slice(2).replaceAll('\\','/'):output;
    const args=process.platform==='win32'?['wsl','-d',process.env.AKLIK_PLATFORM_WSL_DISTRO??'Ubuntu','--','env','AKLIK_DEPLOYER_DATA_DIR=/tmp/aklik-deployer-selftest',linuxOutput,'--self-test']:[output,'--self-test'];
    const run=Bun.spawnSync(args,{stdout:'pipe',stderr:'pipe',timeout:30000,env:{...process.env,AKLIK_DEPLOYER_DATA_DIR:'/tmp/aklik-deployer-selftest'}});
    if(run.exitCode)throw Error('Linux-Selbsttest fehlgeschlagen: '+run.stderr.toString().slice(0,1000));
    runtimeProof=JSON.parse(run.stdout.toString().trim());
    if(!(runtimeProof as {passed?:boolean}).passed)throw Error('Linux-Selbsttest ohne Erfolgsnachweis.');
  }
  results.push({triple:platform.triple,format:platform.format,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),runtimeTested:!!runtimeProof,...(runtimeProof?{runtimeProof}:{})});
}
const report={checkedAt:new Date().toISOString(),results};
await Bun.write('.data/verification/platform-engines-v1.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
