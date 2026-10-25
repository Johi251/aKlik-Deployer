import { createRoot } from "react-dom/client";
import { createRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { FILM_FRAMES, WorkflowFilm } from "./workflow-scenes";

export interface MotionHandle { seek(frame:number):void; destroy():void }
export function mountWorkflow(host:HTMLElement,compact:boolean,onReady:()=>void):MotionHandle {
  const root=createRoot(host),ref=createRef<PlayerRef>(); let requested=0,ready=false;
  root.render(<Player ref={player=>{ref.current=player;if(player){player.seekTo(requested);if(!ready){ready=true;onReady();}}}} component={WorkflowFilm} durationInFrames={FILM_FRAMES} compositionWidth={compact?480:720} compositionHeight={compact?480:520} fps={30} controls={false} autoPlay={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} numberOfSharedAudioTags={0} overrideInternalClassName="aklik-deployer-motion" acknowledgeRemotionLicense style={{width:"100%"}}/>);
  return {seek(frame){requested=Math.max(0,Math.min(FILM_FRAMES-1,Math.round(frame)));ref.current?.seekTo(requested);},destroy(){root.unmount();}};
}
