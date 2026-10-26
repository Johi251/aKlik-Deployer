import {mkdtemp,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {APP_VERSION} from '../src/version';
import {readiness,shareableDiagnostics,type DiagnosticReport} from '../src/readiness';
process.env.AKLIK_DEPLOYER_DATA_DIR=await mkdtemp(join(tmpdir(),'aklik-readiness-'));
const {createApp}=await import('../src/server');
const server=createApp(0),base='http://127.0.0.1:'+server.port;
try{
 const home=await fetch(base),cookie=home.headers.get('set-cookie')?.split(';')[0]??'';
 if(!home.ok||!(await home.text()).includes('download-diagnostics'))throw Error('Diagnose-Oberfläche fehlt.');
 const health=await fetch(base+'/api/health',{headers:{cookie}}).then(r=>r.json());
 const response=await fetch(base+'/api/diagnostics',{headers:{cookie}});
 const report=await response.json() as DiagnosticReport;
 if(!response.ok||report.edition!=='local'||health.version!==APP_VERSION||!report.checks.some(c=>c.name==='aKlik-Deployer'&&c.detail.includes(APP_VERSION)))throw Error('Diagnose meldet falsche Ausgabe oder Version.');
 if((await fetch(base+'/api/diagnostics')).status!==403)throw Error('Diagnose ist ungeschützt.');
 const bridge=await fetch(base+'/bridge/v1/health').then(r=>r.json());
 if(bridge.version!==APP_VERSION)throw Error('Bridge meldet falsche Version.');
 const exported=shareableDiagnostics(report);
 if(JSON.stringify(exported).includes('detail')||readiness(report)[0]!.status!=='ready')throw Error('Export oder Startbereitschaft stimmt nicht.');
 await mkdir('.data/verification',{recursive:true});
 await Bun.write('.data/verification/readiness-runtime.json',JSON.stringify({passed:true,version:APP_VERSION,checks:exported.checks,capabilities:exported.capabilities,protected:true,personalDataIncluded:false},null,2));
 console.log(JSON.stringify({passed:true,version:APP_VERSION,protected:true,checks:report.checks.length}));
}finally{server.stop(true);}
