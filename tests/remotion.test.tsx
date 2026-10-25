import {expect,test} from "bun:test";
import {Window} from "happy-dom";

test("Der echte Remotion Player rendert und seekTo wechselt den Prozess",async()=>{
  const window=new Window({url:"http://localhost/",settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}}),document=window.document;
  const originals=new Map<string,PropertyDescriptor|undefined>();
  let handle:{seek(n:number):void;destroy():void}|undefined;
  try {
    for(const[name,value]of Object.entries({window,document,navigator:window.navigator,HTMLElement:window.HTMLElement,HTMLVideoElement:window.HTMLVideoElement,requestAnimationFrame:window.requestAnimationFrame.bind(window),cancelAnimationFrame:window.cancelAnimationFrame.bind(window),ResizeObserver:window.ResizeObserver,matchMedia:window.matchMedia.bind(window)})) {originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
    const host=document.createElement("div");document.body.append(host);
    const {mountWorkflow}=await import("../src/web/motion-entry");let ready=false;
    handle=mountWorkflow(host as any,false,()=>{ready=true;});
    for(let i=0;i<20&&!ready;i++)await new Promise(r=>setTimeout(r,10));
    expect(ready).toBe(true);
    for(const [frame,scene]of [[40,0],[220,1],[400,2],[580,3],[40,0]]){
      handle.seek(frame!);for(let i=0;i<5;i++)await new Promise(r=>setTimeout(r,0));
      expect(host.querySelector("[data-workflow-scene]")?.getAttribute("data-workflow-scene")).toBe(String(scene));
    }
    expect(document.querySelector("style")?.textContent).toContain(".aklik-deployer-motion");
  } finally {handle?.destroy();await window.happyDOM.abort();window.close();for(const[name,value]of originals){if(value)Object.defineProperty(globalThis,name,value);else delete(globalThis as any)[name];}}
},15000);
