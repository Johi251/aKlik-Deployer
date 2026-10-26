import {expect,test} from "bun:test";
test("Der aKlik-Deployer-Service-Worker erhält Bookmarks- und fremde Offline-Caches",async()=>{
 const events=new Map<string,Function>(),deleted:string[]=[];let pending:Promise<unknown>=Promise.resolve();
 const self={addEventListener:(name:string,fn:Function)=>events.set(name,fn),skipWaiting:()=>{},clients:{claim:()=>Promise.resolve()},location:{origin:"https://example.org",href:'https://example.org/aKlik-Deployer/sw.js'}};
 const caches={keys:async()=>["bdm-aklik-deployer-v1.3.0","foreign-cache","aklik-deployer-shell-/v100","aklik-deployer-shell-/aKlik-Deployer/v100","aklik-deployer-shell-/aKlik-Deployer/v110"],delete:async(key:string)=>{deleted.push(key);return true;}};
 new Function("self","caches",await Bun.file(new URL("../public/sw.js",import.meta.url)).text())(self,caches);
 events.get("activate")!({waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;expect(deleted).toEqual(["aklik-deployer-shell-/aKlik-Deployer/v100"]);
});
