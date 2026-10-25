import { parseDocument } from "yaml";
import type { EnvHint } from "./types";
export interface ComposeReview { model?: Record<string, any>; blockers: string[]; warnings: string[]; env: EnvHint[]; ports: number[] }
const allowedService = new Set(["image", "build", "command", "entrypoint", "environment", "ports", "expose", "volumes", "depends_on", "healthcheck", "restart", "working_dir", "user", "init", "stop_grace_period", "profiles"]);
export function extractEnv(text: string, source: string): EnvHint[] {
  const hints = new Map<string, EnvHint>();
  for (const m of text.matchAll(/(?<!\$)\$\{([A-Za-z_][A-Za-z0-9_]*)([^}]*)\}/g)) {
    const suffix = m[2] ?? "", required = !/^:?-/.test(suffix) && !/^:?\+/.test(suffix);
    const previous = hints.get(m[1]!);
    hints.set(m[1]!, { name: m[1]!, required: required || !!previous?.required, source });
  }
  return [...hints.values()];
}
function safePath(path: unknown): boolean {
  return typeof path === "string" && path.length > 0 && !/[\x00-\x1f$]/.test(path) &&
    !/^[A-Za-z]:|^[/\\]|(^|[/\\])\.\.([/\\]|$)|:\/\//.test(path);
}
export function reviewCompose(text: string, source: string): ComposeReview {
  const result: ComposeReview = { blockers: [], warnings: [], env: extractEnv(text, source), ports: [] };
  try {
    const doc = parseDocument(text, { uniqueKeys: true, merge: false });
    if (doc.errors.length || doc.warnings.length) throw new Error("YAML enthält Fehler oder unbekannte Tags.");
    const model = doc.toJS({ maxAliasCount: 0 }) as Record<string, any>;
    if (!model || typeof model !== "object" || !model.services || typeof model.services !== "object" || Array.isArray(model.services)) throw new Error("Keine gültige Compose-Dienstliste.");
    for (const key of Object.keys(model)) if (!["services", "volumes", "name", "version"].includes(key)) result.blockers.push(`Compose-Feld ${key} wird noch nicht sicher unterstützt.`);
    if (Object.keys(model.services).length > 8) result.blockers.push("Mehr als acht Dienste werden im Prototyp nicht gestartet.");
    for (const [name, raw] of Object.entries(model.services)) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name)) { result.blockers.push("Ungültiger Dienstname."); continue; }
      const svc = raw as Record<string, any>;
      if (!svc || typeof svc !== "object" || Array.isArray(svc)) { result.blockers.push(`${name}: ungültige Konfiguration.`); continue; }
      for (const key of Object.keys(svc)) if (!allowedService.has(key)) result.blockers.push(`${name}: ${key} benötigt eine gesonderte Prüfung und wird nicht ausgeführt.`);
      if (!svc.image && !svc.build) result.blockers.push(`${name}: Image oder Build fehlt.`);
      for (const variable of Array.isArray(svc.environment) ? svc.environment.filter((v: unknown) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v as string)) : Object.entries(svc.environment ?? {}).filter(([, v]) => v === null).map(([k]) => k)) {
        if (!result.env.some(v => v.name === variable)) result.env.push({ name: variable, required: true, source: `${source}: ${name}.environment` });
      }
      if (svc.image && (typeof svc.image !== "string" || /[\s\x00-\x1f]/.test(svc.image))) result.blockers.push(`${name}: ungültiges Image.`);
      if (svc.build) {
        const b = typeof svc.build === "string" ? { context: svc.build } : svc.build;
        if (!b || typeof b !== "object" || !safePath(b.context ?? ".") || (b.dockerfile && !safePath(b.dockerfile))) result.blockers.push(`${name}: nur Build-Kontexte innerhalb des Projekts sind erlaubt.`);
        for (const key of Object.keys(b ?? {})) if (!["context", "dockerfile", "target", "args"].includes(key)) result.blockers.push(`${name}: Build-Feld ${key} wird nicht unterstützt.`);
        if (b.args) result.blockers.push(`${name}: Build-Argumente müssen vor einer Ausführung separat geprüft werden.`);
      }
      for (const vol of svc.volumes ?? []) {
        if (typeof vol === "string") {
          const parts = vol.split(":");
          if (parts.length < 2 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(parts[0]!)) result.blockers.push(`${name}: Host-/anonyme Mounts werden nicht gestartet.`);
        } else if (!vol || vol.type !== "volume" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(vol.source ?? "") || Object.keys(vol).some(k => !["type", "source", "target", "read_only"].includes(k))) result.blockers.push(`${name}: nur einfache benannte Volumes sind erlaubt.`);
      }
      for (const port of svc.ports ?? []) {
        const value = typeof port === "object" && port ? port.target : String(port).split(":").at(-1)?.split("/")[0];
        if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 65535) result.blockers.push(`${name}: dynamische oder ungültige Portangabe wird nicht unterstützt.`);
        else result.ports.push(Number(value));
        if (typeof port === "object" && Object.keys(port).some(k => !["target", "published", "host_ip", "protocol", "mode", "name", "app_protocol"].includes(k))) result.blockers.push(`${name}: unbekannte Portoption.`);
        if (typeof port === "object" && port.mode && port.mode !== "ingress") result.blockers.push(`${name}: Portmodus benötigt gesonderte Prüfung.`);
      }
      if (svc.healthcheck && (typeof svc.healthcheck !== "object" || Object.keys(svc.healthcheck).some(k => !["test", "interval", "timeout", "retries", "start_period", "start_interval", "disable"].includes(k)))) result.blockers.push(`${name}: ungültiger Healthcheck.`);
      // These fields cannot execute on the host, but may otherwise bypass the intended model.
      if (svc.profiles) result.blockers.push(`${name}: Compose-Profile erfordern eine explizite Dienstauswahl.`);
    }
    for (const [name, options] of Object.entries(model.volumes ?? {})) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name) || (options && Object.keys(options as object).length)) result.blockers.push(`Volume ${name}: externe Namen und Treiberoptionen sind nicht erlaubt.`);
    }
    result.model = model;
    result.warnings.push("Ports werden an 127.0.0.1 gebunden. Ressourcenlimits und no-new-privileges werden ergänzt.");
  } catch (e) { result.blockers.push(`Compose kann nicht freigegeben werden: ${(e as Error).message}`); }
  result.ports = [...new Set(result.ports)];
  return result;
}
