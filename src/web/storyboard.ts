import type { MotionHandle } from "./motion-entry";
import {applicationPath} from './paths';
const FRAMES=180, TOTAL=720;
type Mount = (host:HTMLElement,compact:boolean,onReady:()=>void)=>MotionHandle;
export function setupStoryboard(load:()=>Promise<{mountWorkflow:Mount}>=async()=>{
  const inline=(globalThis as typeof globalThis & {aklikDeployerMotion?:{mountWorkflow:Mount}}).aklikDeployerMotion;
  if(inline)return inline;
  const path=applicationPath("/workflow.js");return import(path);
}):()=>void {
  const story=document.getElementById("hero-scroll"),host=document.getElementById("workflow-film"),stage=document.getElementById("hero-preview");
  const chapters=[...document.querySelectorAll<HTMLElement>("[data-workflow-chapter]")];
  const tabs=[...document.querySelectorAll<HTMLAnchorElement>("[data-workflow-tab]")];
  if(!story||!host||!stage||chapters.length!==4)return()=>{};
  const reduced=matchMedia("(prefers-reduced-motion: reduce)"), compact=matchMedia("(max-width: 760px)"), short=matchMedia("(max-height: 640px)");
  let raf=0,film:MotionHandle|undefined,mount:Mount|undefined,loading=false,disposed=false,variant=compact.matches,active=0,enabled=true;
  const progress=document.getElementById("journey-progress") as HTMLProgressElement;
  const setActive=(index:number)=>{
    active=index;story.dataset.step=String(index);
    tabs.forEach((tab,i)=>{if(i===index)tab.setAttribute("aria-current","step");else tab.removeAttribute("aria-current");});
    chapters.forEach((chapter,i)=>chapter.classList.toggle("is-active",i===index));
    document.querySelectorAll<HTMLElement>("[data-journey-scene]").forEach((scene,i)=>{scene.hidden=i!==index;});
    const title=document.getElementById("workflow-scene-label");if(title)title.textContent=tabs[index]?.textContent??"";
  };
  const mountFilm=()=>{if(!mount||disposed)return;film=mount(host,variant,()=>{if(!disposed){stage.dataset.motionReady="true";schedule();}});};
  const ensureFilm=()=>{
    if(film||loading||disposed||!enabled||stage.dataset.motionError)return;
    if(mount){mountFilm();return;}
    loading=true;void load().then(module=>{loading=false;if(disposed)return;mount=module.mountWorkflow;mountFilm();},()=>{loading=false;stage.dataset.motionReady="false";stage.dataset.motionError="true";});
  };
  const update=()=>{
    raf=0;if(disposed||document.hidden||!story.getClientRects().length)return;
    enabled=stage.offsetHeight+120<window.innerHeight&&!short.matches;
    story.dataset.enhanced=String(enabled);story.dataset.reduced=String(reduced.matches);
    const bounds=story.getBoundingClientRect();if(bounds.bottom<0||bounds.top>window.innerHeight)return;
    const anchor=enabled&&compact.matches?Math.min(window.innerHeight-80,stage.getBoundingClientRect().bottom+(window.innerHeight-stage.getBoundingClientRect().bottom)/2):window.innerHeight*.55;
    let best=0,distance=Infinity;chapters.forEach((chapter,i)=>{const r=chapter.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-anchor);if(d<distance){best=i;distance=d;}});
    setActive(best);ensureFilm();
    const rect=chapters[best]!.getBoundingClientRect();
    const p=Math.max(0,Math.min(1,(anchor-rect.top)/Math.max(1,rect.height)));
    const frame=best*FRAMES+(reduced.matches?FRAMES-1:Math.round(p*(FRAMES-1)));
    film?.seek(frame);story.dataset.frame=String(frame);if(progress)progress.value=frame/(TOTAL-1);
  };
  function schedule(){if(!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(update);}
  const resize=()=>{if(variant!==compact.matches){variant=compact.matches;film?.destroy();film=undefined;delete stage.dataset.motionReady;}schedule();};
  const jump=(event:Event)=>{const index=tabs.indexOf(event.currentTarget as HTMLAnchorElement);if(index<0)return;event.preventDefault();setActive(index);chapters[index]!.scrollIntoView({behavior:reduced.matches?"instant":"smooth",block:"center"});const heading=chapters[index]!.querySelector<HTMLElement>("h3");if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}};
  tabs.forEach(tab=>tab.addEventListener("click",jump));
  window.addEventListener("scroll",schedule,{passive:true});window.addEventListener("resize",resize,{passive:true});document.addEventListener("aklik-deployer:viewchange",resize);document.addEventListener("visibilitychange",schedule);
  compact.addEventListener("change",resize);short.addEventListener("change",resize);reduced.addEventListener("change",resize);setActive(0);story.dataset.enhanced="false";update();
  void document.fonts?.ready.then(()=>{if(!disposed)resize();},()=>{});
  return()=>{disposed=true;if(raf)cancelAnimationFrame(raf);film?.destroy();tabs.forEach(tab=>tab.removeEventListener("click",jump));window.removeEventListener("scroll",schedule);window.removeEventListener("resize",resize);document.removeEventListener("aklik-deployer:viewchange",resize);document.removeEventListener("visibilitychange",schedule);compact.removeEventListener("change",resize);short.removeEventListener("change",resize);reduced.removeEventListener("change",resize);};
}
