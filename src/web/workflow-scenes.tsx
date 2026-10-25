import { useCurrentFrame, useVideoConfig } from "remotion";

export const workflowScenes = [
  { name: "Werkzeug finden", input: "Du beschreibst deine Aufgabe.", inputDetail: "Zum Beispiel: Diagramme zeichnen", sources: ["GitHub", "Kataloge", "Projektseiten"], details: ["Vorhandene Projekte", "Weitere Möglichkeiten", "Funktionen und Kosten"], output: "Vorhandene Lösungen vergleichen", outputDetail: "Quellen ansehen. Passenden Kandidaten auswählen." },
  { name: "Auf dem PC nutzen", input: "Du fügst einen GitHub-Link ein.", inputDetail: "Wie lässt sich dieses Projekt auf deinem PC nutzen?", sources: ["Windows-Datei?", "Docker nötig?", "Quellcode?"], details: ["Offizielle Downloads", "Voraussetzungen", "Einrichtungsschritte"], output: "Einen belegten Startweg wählen", outputDetail: "Download, Voraussetzungen und offene Fragen verstehen." },
  { name: "Online verwenden", input: "Du möchtest im Browser starten.", inputDetail: "Gibt es einen nutzbaren Online-Zugang?", sources: ["Web-Zugang?", "Hosting prüfen", "Alternativen"], details: ["Offizielles Angebot", "Aufwand und Grenzen", "Mit Unterschieden"], output: "Original oder passende Alternative", outputDetail: "Verfügbarkeit und mögliche Kosten bleiben sichtbar." },
  { name: "KI im Agenten nutzen", input: "Du fügst einen Modell-Link ein.", inputDetail: "Hugging Face oder PirateFace", sources: ["Cloud-Zugang", "Agent verbinden", "Profil wählen"], details: ["Anbieter prüfen", "Modell zuordnen", "Einrichtung vorbereiten"], output: "Ein Agenten-Startpaket vorbereiten", outputDetail: "Zugang selbst einrichten. Kosten vor der Nutzung prüfen." },
] as const;
export const SCENE_FRAMES = 180;
export const FILM_FRAMES = SCENE_FRAMES * workflowScenes.length;
const clamp = (n:number) => Math.max(0,Math.min(1,n));

/** Authored vector process diagram. All visible claims have an equivalent HTML chapter. */
export function WorkflowScene({frame,width=720}:{frame:number;width?:number}) {
  const index = Math.max(0,Math.min(3,Math.floor(frame/SCENE_FRAMES))), scene = workflowScenes[index]!;
  const progress = (frame%SCENE_FRAMES)/(SCENE_FRAMES-1), small=width<600, height=small?480:520;
  const rise = 10*(1-clamp(progress*2));
  const red="#1E40AF", ink="#f1f2f5", muted="#a6a9b2", line="#363c4b";
  const box = (x:number,y:number,w:number,h:number,title:string,detail:string,selected=false,opacity=1) => <g opacity={opacity} transform={`translate(0 ${rise})`}>
    <rect x={x} y={y} width={w} height={h} rx="14" fill={selected?red:"#1b1e27"}/>
    <text x={x+22} y={y+35} fontSize={small?24:22} fontWeight="650" fill={selected?"#fff":ink}>{title}</text>
    <text x={x+22} y={y+64} fontSize={small?20:17} fill={selected?"#fff":muted}>{detail}</text>
  </g>;
  const connector=(path:string,phase:number) => <g fill="none" strokeWidth="2" strokeLinecap="round"><path d={path} stroke={line}/><path d={path} stroke={red} pathLength="1" strokeDasharray="1" strokeDashoffset={1-clamp((progress-phase)*3)}/></g>;
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} fontFamily="Manrope, sans-serif" aria-hidden="true" data-workflow-frame={frame} data-workflow-scene={index}>
    <rect width={width} height={height} rx="20" fill="#12151d"/>
    {small ? <>
      <text x="24" y="32" fill={muted} fontSize="16">{scene.name}</text>
      {box(24,54,432,88,scene.input.split(".")[0]!+".",scene.inputDetail.length>40?"Öffentlicher Link oder Beschreibung":scene.inputDetail)}
      {connector("M240 152V184",0.12)}
      {box(24,194,432,88,scene.sources[index===0?0:1],index===0?"Kataloge und Projektseiten einbeziehen":scene.details[1],false,.65+.35*clamp(progress*3))}
      {connector("M240 292V324",0.45)}
      {box(24,334,432,104,index===2?"Im Browser weiterkommen":index===3?"Agenten-Paket vorbereiten":index===1?"Startweg verstehen":"Lösungen vergleichen",index===2?"Original oder Alternative prüfen":index===3?"Cloud-Zugang selbst einrichten":index===1?"Download und Voraussetzungen":"Quellen und Bedingungen ansehen",true,.7+.3*clamp((progress-.4)*3))}
      <text x="24" y="464" fill={muted} fontSize="15">Illustrierter Ablauf, keine Live-Analyse</text>
    </> : <>
      <text x="44" y="40" fill={muted} fontSize="16">{scene.name}</text>
      {box(44,65,632,88,scene.input,scene.inputDetail)}
      {connector("M360 164V196H144V226M360 196V226M360 196H576V226",.12)}
      {scene.sources.map((name,i)=><g key={name} opacity={.55+.45*clamp((progress-i*.08)*3)}><rect x={44+i*216} y="236" width="200" height="98" rx="12" fill="#fff"/><text x={62+i*216} y="275" fontSize="20" fontWeight="650" fill={ink}>{name}</text><text x={62+i*216} y="306" fontSize="15" fill={muted}>{scene.details[i]}</text></g>)}
      {connector("M144 344V370H360V392M360 344V392M576 344V370H360",.45)}
      {box(44,402,632,88,scene.output,scene.outputDetail,true,.75+.25*clamp((progress-.4)*3))}
    </>}
  </svg>;
}
export function WorkflowFilm(){const frame=useCurrentFrame(),{width}=useVideoConfig();return <WorkflowScene frame={frame} width={width}/>;}
