import {test,expect} from 'bun:test';
import {readiness,shareableDiagnostics,type DiagnosticReport} from '../src/readiness';
import {applicationPath,webBase} from '../src/web/paths';
import {APP_VERSION} from '../src/version';
test('missing Docker never blocks research and the web edition never claims local readiness',()=>{
 const local:DiagnosticReport={edition:'local',checkedAt:new Date().toISOString(),checks:[{name:'Git',status:'ok',detail:'git'}]};
 expect(readiness(local).map(c=>c.status)).toEqual(['ready','setup','setup','ready']);
 local.checks.push({name:'Docker',status:'ok',detail:'linux'});
 expect(readiness(local)[1]!.status).toBe('ready');
 expect(readiness(local)[2]!.status).toBe('setup');
 local.checks.push({name:'Railpack',status:'ok',detail:'image'});
 expect(readiness(local)[2]!.status).toBe('ready');
 expect(readiness({...local,edition:'web'}).map(c=>c.status)).toEqual(['ready','setup','setup','setup']);
});
test('shareable diagnostics contain no raw process output or injected names',()=>{
 const report:DiagnosticReport={edition:'local',checkedAt:'2026-10-26T00:00:00Z',checks:[{name:'Docker',status:'warn',detail:'PRIVATE_VALUE /Users/person/secret',action:'PRIVATE_VALUE'},{name:'PRIVATE_VALUE',status:'warn',detail:'x'}]};
 expect(JSON.stringify(shareableDiagnostics(report))).not.toContain('PRIVATE_VALUE');
 expect(JSON.stringify(shareableDiagnostics(report))).not.toContain('/Users/');
 expect(shareableDiagnostics(report).checks).toEqual([{name:'Docker',status:'warn'}]);
});
test('GitHub project paths keep downloads within the app and reject unsafe base paths',()=>{
 expect(applicationPath('/downloads/windows.json','/aKlik-Deployer/')).toBe('/aKlik-Deployer/downloads/windows.json');
 expect(applicationPath('/sw.js','/')).toBe('/sw.js');
 for(const base of ['//evil/','/../','/a?b/','https://example.com/'])expect(()=>webBase(base)).toThrow();
 expect(()=>applicationPath('//evil/','/')).toThrow();
});
test('desktop, browser and engine versions match the release version',async()=>{
 for(const path of ['src-tauri/tauri.conf.json','extension/manifest.json'])expect((await Bun.file(path).json()).version).toBe(APP_VERSION);
 expect(await Bun.file('src-tauri/Cargo.toml').text()).toContain('version = "'+APP_VERSION+'"');
});
