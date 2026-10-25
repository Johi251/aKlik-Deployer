import {scanRepository} from '../src/repository-scan';
const base='http://127.0.0.1:43110';
const query='/bridge/v1/status?url='+encodeURIComponent('https://github.com/docker/welcome-to-docker');
let last:any;
for(let i=0;i<30;i++){const r=await fetch(base+query);last=await r.json();if(last.state!=='checking')break;await Bun.sleep(2000);}
const report={checkedAt:new Date().toISOString(),health:await fetch(base+'/bridge/v1/health').then(r=>r.json()),state:last.state,color:last.color,evidence:last.evidence,commit:last.commit,note:last.note};
await Bun.write('.data/verification/bridge-v1.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
