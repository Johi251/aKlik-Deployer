import { command } from "./process";
import { toolsStatus } from "./runtime";

export interface Diagnostic { name: string; status: "ok" | "warn"; detail: string; action?: string }
export async function diagnostics(): Promise<{ checkedAt: string; checks: Diagnostic[] }> {
  const [git, docker, search] = await Promise.all([
    command(["git", "--version"], { timeout: 8000 }), toolsStatus(),
    fetch("http://127.0.0.1:43111/healthz", { signal: AbortSignal.timeout(3000) }).then(r => r.ok).catch(() => false),
  ]);
  return { checkedAt: new Date().toISOString(), checks: [
    { name: "aKlik-Deployer", status: "ok", detail: "Version 0.3.0 · lokale Sitzung erreichbar" },
    { name: "Bun", status: "ok", detail: Bun.version },
    { name: "Git", status: git.code === 0 ? "ok" : "warn", detail: git.code === 0 ? git.stdout.trim() : "Git nicht erreichbar", action: git.code === 0 ? undefined : "Git installieren und aKlik-Deployer neu starten." },
    { name: "Docker", status: docker.docker ? "ok" : "warn", detail: docker.detail, action: docker.docker ? undefined : "Docker Desktop öffnen und Linux-Container verwenden. Recherche bleibt verfügbar." },
    { name: "Railpack", status: docker.railpack ? "ok" : "warn", detail: "Festgelegte Version " + docker.railpackVersion, action: docker.railpack ? undefined : "Bei laufendem Docker die Startdatei erneut öffnen oder bun run setup:railpack ausführen." },
    { name: "Websuche", status: search ? "ok" : "warn", detail: search ? "Lokaler SearXNG-Dienst antwortet. Einzelne Suchmaschinen können trotzdem begrenzt sein." : "Suchdienst nicht erreichbar", action: search ? undefined : "Der nächste Suchlauf versucht den eigenen Dienst zu starten. Alternativ Startdatei erneut öffnen." },
    { name: "GitHub und Kataloge", status: "warn", detail: "Externe Quellen werden je Suchlauf geprüft. GitHub anonym mit Abfragelimits; Katalog- und GitHub-Caches begrenzen Wiederholungen." },
  ] };
}
export function explainError(message: string): string {
  if (/403|429|abfragelimit|rate limit/i.test(message)) return "Die Quelle begrenzt Anfragen. Bereits geladene Treffer verwenden und später erneut prüfen. Eine erneute Installation hilft hier nicht.";
  if (/docker|daemon|engine/i.test(message) && /connect|erreichbar|running|linux|pipe/i.test(message)) return "Docker Desktop öffnen, auf Linux-Container warten und Diagnose aktualisieren.";
  if (/symlink|submodul|nicht unterstützt|gesperrt|blockiert|sonderrecht/i.test(message)) return "Dieser Startweg überschreitet die geprüfte Unterstützung. Repository-Dokumentation ansehen und einen passenden Adapter wählen.";
  if (/zeitlimit|timeout|timed out|network|fetch failed|ENOTFOUND/i.test(message)) return "Netzverbindung und Diagnose prüfen. Bereits gespeicherte Recherchen bleiben benutzbar.";
  if (/container.*beendet|exited|healthcheck/i.test(message)) return "Laufzeitlogs öffnen und benötigte Projektangaben sowie den Container-Port mit der Dokumentation vergleichen.";
  return "Details und Quellen ansehen. Bei Startproblemen die Projektlogs öffnen; Geheimwerte nicht in Notizen oder Recherchetexte kopieren.";
}
