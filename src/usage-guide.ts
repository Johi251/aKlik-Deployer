import { canonical } from "./discovery";
import { hasSecret } from "./matching";
import type { Analysis, Candidate, SearchResult } from "./types";

type PublicAnalysis = Omit<Analysis, "files">;
export interface UsageChoice { kind: "browser" | "download" | "docker" | "hosting" | "alternatives"; title: string; reason: string; url?: string }
export function usageChoice(a: PublicAnalysis, browserEdition: boolean): UsageChoice {
  const same = browserTools.find(t => canonical(t.repository) === canonical(a.repository.url));
  if (same) return { kind: "browser", title: "Jetzt im Browser verwenden", reason: same.features + " " + same.cost, url: same.url };
  const native = a.installOptions?.find(o => o.status === "available" && o.assets?.length);
  if (native) return { kind: "download", title: "Offiziellen Windows-Download öffnen", reason: "Für dieses Projekt gibt es einen Windows-Download. Auf der Release-Seite die passende Architektur wählen und die Herausgeberhinweise beachten.", url: a.repository.url + "/releases" };
  if (a.strategy !== "unsupported" && !a.blockers.length && !browserEdition) return { kind: "docker", title: "Lokalen Start vorbereiten", reason: "Der aKlik-Deployer hat einen Container-Startweg erkannt. Die erkannten Werte sind vorausgefüllt; eventuell benötigte Zugänge trägst du im Startformular ein." };
  if (a.onlineOptions?.some(o => o.status === "candidate")) return { kind: "hosting", title: "Einfachsten Hosting-Weg ansehen", reason: "Eine fertig nutzbare Gratis-Version ist nicht belegt. Ein möglicher Hosting-Weg ist vorhanden; Konto, Einrichtung und vollständige Funktion müssen noch geprüft werden." };
  return { kind: "alternatives", title: "Passende Browser-Alternative finden", reason: "Keinen einfachen nutzbaren Weg belegt. Wir suchen deshalb ein vergleichbares Angebot, das bereits im Browser läuft." };
}

// Small, source-backed seeds supplement live catalog search, never stand in for it.
// Feature summaries are our own; the linked original is the evidence, not an inference test.
export const browserTools = [
  { name: "draw.io", repository: "https://github.com/jgraph/drawio", url: "https://app.diagrams.net/", query: "diagram editor", terms: /diagram|draw.?io|mermaid|flowchart|flussdiagram|whiteboard|mind.?map|uml|visio/i, features: "Diagramme, Flussdiagramme und Formbibliotheken im Browser.", cost: "Laut Projekt kostenlos und ohne Anmeldung.", difference: "Strukturierte Diagramme statt eines automatisch identischen Funktionsumfangs; Dateiformate und Erweiterungen des Ausgangsprojekts separat prüfen.", source: "https://www.drawio.com/" },
  { name: "Excalidraw", repository: "https://github.com/excalidraw/excalidraw", url: "https://excalidraw.com/", query: "whiteboard", terms: /diagram|draw.?io|excalidraw|whiteboard|sketch|skizz|wireframe|flowchart|zeichnen/i, features: "Whiteboard mit Skizzenstil, PNG-/SVG-Export und gemeinsamer Bearbeitung.", cost: "Freier Browser-Editor; das separate Excalidraw+-Angebot hat eigene Bedingungen.", difference: "Fokus auf freies Skizzieren und Whiteboard; kein vollständiger Ersatz für spezialisierte CAD- oder Diagramm-Automatisierung.", source: "https://github.com/excalidraw/excalidraw#excalidrawcom" },
  { name: "Squoosh", repository: "https://github.com/GoogleChromeLabs/squoosh", url: "https://squoosh.app/", query: "image compression", terms: /image.*(?:compress|optim|convert)|bild.*(?:komprim|optim|konvert)|squoosh|imageoptim|pngquant|jpegoptim/i, features: "Bilder im Browser komprimieren und Ausgabe vergleichen; Verarbeitung auf dem eigenen Gerät.", cost: "Freies Open-Source-Browserwerkzeug.", difference: "Fokus auf Bildkompression im Browser; keine belegte Entsprechung für Stapelverarbeitung, serverseitige APIs oder einen umfassenden Bildeditor.", source: "https://squoosh.app/" },
  { name: "CyberChef", repository: "https://github.com/gchq/CyberChef", url: "https://gchq.github.io/CyberChef/", query: "data encoding", terms: /base64|encod|decod|hash|checksum|prüfsumme|kodier|chiff|cyberchef|data.*transform/i, features: "Daten kodieren, dekodieren, hashen und mit verketteten Rezepten umwandeln.", cost: "Freie Open-Source-Web-App; für den Browserbetrieb kein eigener Server nötig.", difference: "Interaktive Datenrezepte statt automatisch gleicher CLI-, Automatisierungs- oder Server-Integration.", source: "https://github.com/gchq/CyberChef#official-website" },
];
export interface BrowserAlternative { name: string; url: string; repository: string; features: string; cost: string; difference: string; source: string; matched: string; checkedAt: string }
export interface AlternativeReport { analysisId: string; query: string; checkedAt: string; ready: BrowserAlternative[]; candidates: Candidate[]; searchId?: string; coverage: SearchResult["coverage"]; notes: string[] }
export function alternativeQuery(a: PublicAnalysis, purpose?: unknown): string {
  if (purpose !== undefined && (typeof purpose !== "string" || purpose.length > 300 || hasSecret(purpose))) throw new Error("Zweck zu lang oder Geheimwertmuster erkannt.");
  const description = typeof purpose === "string" && purpose.trim() ? purpose.trim() : a.description;
  const known = browserTools.find(t => t.terms.test(description));
  if (known) return known.query;
  // Avoid turning a repository URL into a pinned exact-match search for itself.
  const words = description.replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(w => w.length > 2 && !/^(the|and|for|with|your|that|this|from|eine?|und|für|mit|der|die|das|self-hosted|open-source)$/i.test(w));
  return words.slice(0, 6).join(" ") || a.repository.repo.replace(/[_.-]/g, " ");
}
export async function findAlternatives(a: PublicAnalysis, purpose: unknown, search: (input: string, local: boolean, oss: boolean, options: unknown) => Promise<SearchResult>): Promise<AlternativeReport> {
  const query = alternativeQuery(a, purpose), checkedAt = new Date().toISOString();
  const text = typeof purpose === "string" && purpose.trim() ? purpose : a.name + " " + a.description;
  const ready = browserTools.filter(t => canonical(t.repository) !== canonical(a.repository.url) && t.terms.test(text)).slice(0, 3).map(({ terms, ...t }) => ({ ...t, matched: terms.exec(text)?.[0] ?? "", checkedAt: "2026-10-23" }));
  const notes = ["Browser-Alternativen: Originalbeschreibungen am 23.10.2026 gelesen; Bedienung und vollständige Funktionsgleichheit nicht praktisch getestet. Eine Browser-App kann lokal auf deinem Gerät rechnen."];
  let result: SearchResult | undefined;
  try { result = await search(query, false, false, { target: "online" }); } catch (e) { notes.push("Live-Recherche unvollständig: " + (e as Error).message); }
  const candidates = (result?.candidates ?? []).filter(c => canonical(c.url) !== canonical(a.repository.url) && !ready.some(r => [canonical(r.url), canonical(r.repository)].includes(canonical(c.url))) && c.score > 0 && !c.archived).slice(0, 5);
  if (!ready.length) notes.push("Keine passende, bereits belegte Gratis-Browser-App in der ergänzenden Auswahl. Weitere Suchtreffer sind Vorschläge; Online-Betrieb, Gratisumfang und Unterschiede sind dort noch zu prüfen.");
  return { analysisId: a.id, query, checkedAt, ready, candidates, searchId: result?.id, coverage: result?.coverage ?? [], notes };
}
