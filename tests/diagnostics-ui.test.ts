import {test,expect} from 'bun:test';
test('diagnostics UI refreshes, exports only safe fields and discards failed results',()=>{
 // Happy DOM evaluation runs separately so its globals cannot leak into navigation tests.
 const result=Bun.spawnSync([process.execPath,'scripts/verify-diagnostics-ui.ts'],{stdout:'pipe',stderr:'pipe',timeout:12000,windowsHide:true});
 if(result.exitCode)throw Error(result.stderr.toString());
 expect(JSON.parse(result.stdout.toString().trim())).toMatchObject({passed:true,privateDetailsExported:false});
},15000);
