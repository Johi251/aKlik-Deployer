import type { Candidate, RequirementCheck, SearchOptions, SearchProfile } from "./types";

export function normalized(value: string): string { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase(); }
const featureGroups: [RegExp, string[]][] = [
  [/^(?:docker|container)$/i, ["docker", "container", "compose"]],
  [/offline|ohne internet/i, ["offline", "without internet", "no internet"]],
  [/deutsch|german/i, ["german", "deutsch", "de-de"]],
  [/ohne anmeldung|no.?sign.?up/i, ["no signup", "no sign-up", "without registration", "no registration", "ohne anmeldung"]],
  [/api|schnittstelle/i, ["rest api", "restful", "api", "graphql"]],
  [/ocr|texterkennung/i, ["ocr", "optical character recognition", "texterkennung"]],
  [/import/i, ["import", "imports", "importing"]], [/export/i, ["export", "exports", "exporting"]],
  [/mehrbenutzer|multi.?user|team/i, ["multi-user", "multiuser", "collaborat", "teams"]],
  [/mobil|mobile|android|ios/i, ["mobile", "android", "ios"]],
  [/windows/i, ["windows", "win32", "win64"]],
  [/lokal|selbst.?host|self.?host/i, ["self-host", "selfhost", "on-premise", "local-first", "lokal"]],
];
export function hasSecret(value: string): boolean { return /(?:gh[pousr]_[a-zA-Z0-9]{15,}|github_pat_|hf_[a-zA-Z0-9]{20,}|pf-gw-[a-zA-Z0-9_-]{12,}|sk-or-v1-[a-zA-Z0-9_-]{20,}|sk-[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY|(?:password|passwd|api[_ -]?key|token|secret)\s*[:=]\s*\S{6,})/i.test(value); }
export function searchOptions(value: unknown): SearchOptions {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültige Suchoptionen.");
  const v = value as Record<string, unknown>;
  const terms = (key: string) => {
    if (v[key] === undefined) return [];
    if (!Array.isArray(v[key]) || v[key].length > 8 || v[key].some((s: unknown) => typeof s !== "string" || s.length > 100)) throw new Error("Höchstens acht kurze Merkmale oder Ausschlüsse eingeben.");
    const result = [...new Set((v[key] as string[]).map(s => s.trim()).filter(Boolean))];
    if (result.some(hasSecret)) throw new Error("Keine Geheimwerte als Suchmerkmale eingeben.");
    return result;
  };
  const target = v.target ?? "any";
  if (!["any", "selfhosted", "online", "desktop"].includes(String(target))) throw new Error("Ungültiger Betriebswunsch.");
  return { requirements: terms("requirements"), excluded: terms("excluded"), target: target as SearchOptions["target"] };
}
export function requirementChecks(requirements: string[], documents: { text: string; url: string }[]): RequirementCheck[] {
  return requirements.map(requirement => {
    const alternatives = featureGroups.find(([re]) => re.test(requirement))?.[1] ?? [normalized(requirement)];
    for (const doc of documents) {
      // A source mention is a clue, never an automatic feature guarantee.
      const lines = doc.text.split(/\n|(?<=[.!?])\s+(?=[A-Z])/).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
      for (const line of lines) {
        const text = normalized(line);
        const term = alternatives.find(t => new RegExp(`(?<![a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${["collaborat", "self-host", "selfhost"].includes(t) ? "" : "(?![a-z0-9])"}`, "i").test(text));
        if (!term) continue;
        if (/deutsch|german/i.test(requirement) && !/language|translation|locali[sz]|i18n|interface|available|support|deutschsprach|oberfl|sprache|ubersetz/.test(text)) continue;
        const index = text.indexOf(term), around = text.slice(Math.max(0, index - 65), index + term.length + 65);
        const negative = /(?:not support|does not support|unsupported|not available|requires (?:an? )?internet|nicht unterst|keine unterst|coming soon|planned)/.test(around);
        return { requirement, status: negative ? "conflict" : "hint", excerpt: line.slice(Math.max(0, index - 80), index + 230), url: doc.url };
      }
    }
    return { requirement, status: "unknown" };
  });
}
export function typeHint(candidate: Candidate): string {
  const text = normalized(candidate.name + " " + candidate.description);
  if (/browser extension|webextension|cross-browser|chrome extension|firefox extension/.test(text)) return "Browser-Erweiterung";
  if (/\blibrary\b|\bsdk\b|\bframework\b|npm package/.test(text) && !candidate.sources.includes("selfhosted")) return "Bibliothek / Baustein";
  if (/command.line|\bcli\b/.test(text) && !/web (?:ui|interface)/.test(text)) return "CLI-Werkzeug";
  if (/desktop|electron|native windows/.test(text)) return "Desktop-App";
  if (candidate.sources.includes("selfhosted") || /self.host|docker|web (?:app|interface|ui)/.test(text)) return "Selbst betreibbare App";
  return candidate.kind === "online" ? "Online-Angebot" : "Repository · Typ offen";
}
export function assessCandidate(candidate: Candidate, profile: SearchProfile): Candidate {
  const type = typeHint(candidate), requirements = profile.requirements ?? [];
  const checks = requirementChecks(requirements, [{ text: candidate.description + "\n" + (candidate.platforms ?? []).join(" "), url: candidate.url }]);
  const hints = checks.filter(c => c.status === "hint").length;
  const cautions: string[] = [];
  if (candidate.archived) cautions.push("Archiviertes Repository");
  if (candidate.updated && Date.now() - Date.parse(candidate.updated) > 730 * 86400_000) cautions.push("Letzte gemeldete Code-Aktivität über zwei Jahre her; Wartung prüfen.");
  if (!candidate.license || candidate.license === "NOASSERTION") cautions.push("Lizenz offen");
  if (["Bibliothek / Baustein", "Browser-Erweiterung", "CLI-Werkzeug"].includes(type)) cautions.push("Kein allgemeiner Docker-Start; Typ separat prüfen.");
  let bonus = hints * 6 - checks.filter(c => c.status === "conflict").length * 8;
  if (profile.localPreferred && ["Bibliothek / Baustein", "Browser-Erweiterung", "CLI-Werkzeug"].includes(type)) bonus -= 18;
  if (candidate.archived) bonus -= 30;
  if (profile.target === "selfhosted") bonus += type === "Selbst betreibbare App" ? 12 : -6;
  if (profile.target === "online") bonus += candidate.kind === "online" ? 12 : -6;
  if (profile.target === "desktop") bonus += type === "Desktop-App" ? 12 : -6;
  return { ...candidate, score: candidate.score + bonus, fit: { type, hints, total: requirements.length, checks, cautions } };
}
