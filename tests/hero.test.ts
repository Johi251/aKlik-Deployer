import {afterAll,beforeAll,expect,test} from 'bun:test';
import {Window,HTMLElement} from 'happy-dom';
import {setupStoryboard} from '../src/web/storyboard';
const window=new Window({settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}}), document=window.document;
class Preference extends EventTarget { matches=false; change(value:boolean){this.matches=value;this.dispatchEvent(new Event('change'));} }
const reduced=new Preference(),compact=new Preference(),short=new Preference(),originals=new Map<string,PropertyDescriptor|undefined>();
let cleanup:()=>void,offset=0,height=500,visible=true,loads=0,destroyed=0;const frames:number[]=[];
const get=(id:string)=>document.getElementById(id)! as HTMLElement;
const tick=async()=>{await new Promise(resolve=>window.requestAnimationFrame(resolve));await Promise.resolve();};
beforeAll(async()=>{
 document.write(await Bun.file(new URL('../public/index.html',import.meta.url)).text());Object.defineProperty(window,'innerHeight',{value:1000,configurable:true});
 for(const[name,value]of Object.entries({window,document,matchMedia:(q:string)=>q.includes('reduced-motion')?reduced:q.includes('max-height')?short:compact,requestAnimationFrame:window.requestAnimationFrame.bind(window),cancelAnimationFrame:window.cancelAnimationFrame.bind(window)})){originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
 Object.defineProperty(get('hero-scroll'),'getClientRects',{value:()=>visible?[1]:[]});Object.defineProperty(get('hero-scroll'),'getBoundingClientRect',{value:()=>({top:-offset,bottom:3200-offset,height:3200})});
 Object.defineProperty(get('hero-preview'),'offsetHeight',{get:()=>height});Object.defineProperty(get('hero-preview'),'getBoundingClientRect',{value:()=>({bottom:height})});
 [...document.querySelectorAll('[data-workflow-chapter]')].forEach((el,i)=>Object.defineProperty(el,'getBoundingClientRect',{value:()=>({top:i*700-offset,height:700})}));
 cleanup=setupStoryboard(async()=>{loads++;return {mountWorkflow(_host,_compact,ready){queueMicrotask(ready);return {seek(frame){frames.push(frame);},destroy(){destroyed++;}}}};});await tick();
});
afterAll(async()=>{cleanup();await window.happyDOM.abort();window.close();for(const[name,value]of originals){if(value)Object.defineProperty(globalThis,name,value);else delete(globalThis as any)[name];}});
test('Vier Prozesse folgen beim Vorwärts- und Rückwärtsscrollen derselben Remotion-Timeline',async()=>{
 for(const index of [0,1,2,3,2,0]){offset=index*700;window.dispatchEvent(new window.Event('scroll'));await tick();expect(get('hero-scroll').dataset.step).toBe(String(index));expect(Math.floor(frames.at(-1)!/180)).toBe(index);expect(document.querySelector('[aria-current="step"]')?.getAttribute('data-workflow-tab')).toBe(String(index));}
 expect(loads).toBe(1);expect(get('hero-preview').dataset.motionReady).toBe('true');expect(document.querySelectorAll('[data-journey-scene]:not([hidden])')).toHaveLength(1);
});
test('Reduzierte Bewegung springt zum lesbaren Endzustand des jeweiligen Prozesses',async()=>{
 reduced.change(true);await tick();expect(frames.at(-1)).toBe(179);offset=1400;window.dispatchEvent(new window.Event('scroll'));await tick();expect(frames.at(-1)).toBe(539);reduced.change(false);await tick();
});
test('Kurze Bildschirme lösen Sticky und Resize lädt eine passende mobile Komposition',async()=>{
 short.change(true);await tick();expect(get('hero-scroll').dataset.enhanced).toBe('false');short.change(false);height=1100;window.dispatchEvent(new window.Event('resize'));await tick();expect(get('hero-scroll').dataset.enhanced).toBe('false');height=500;compact.change(true);await tick();expect(destroyed).toBe(1);expect(loads).toBe(1);expect(get('hero-scroll').dataset.enhanced).toBe('true');
});
test('Tastaturanker und Ansichtswechsel erhalten Kapitelzugriff und Fokus',async()=>{
 reduced.change(true);let behavior='';Object.defineProperty(get('journey-use'),'scrollIntoView',{value:(o:any)=>{behavior=o.behavior;}});(document.querySelector('[data-workflow-tab="3"]') as HTMLElement).click();expect(behavior).toBe('instant');expect(document.activeElement).toBe(get('journey-use').querySelector('h3')!);
 compact.change(false);visible=false;document.dispatchEvent(new window.Event('aklik-deployer:viewchange'));await tick();visible=true;offset=0;document.dispatchEvent(new window.Event('aklik-deployer:viewchange'));await tick();expect(get('hero-scroll').dataset.step).toBe('0');
});
