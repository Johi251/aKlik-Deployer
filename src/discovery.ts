import { validatePublicUrl } from "./public-url";
import { assessCandidate, hasSecret, normalized, searchOptions } from "./matching";
export { normalized } from "./matching";
import type { Candidate, SearchProfile, Source } from "./types";
const stop = new Set("ich suche mochte brauche ein eine einen einem einer das der die und oder mit fur fuer von zum zur auf in am an als ist es auch soll kann tool tools app apps software kostenlos kostenlose free open source lokal lokale github repository bitte mir etwas haben machen erstellen benutzen nutzen wie ahnlich alternative beschreibung link ohne muss sollten moglich wollen suche".split(" "));
const concepts: [RegExp, string[]][] = [
  [/rechnun|invoice|billing/i, ["invoice", "billing", "invoicing"]],
  [/lesezeichen|bookmark|linksamml/i, ["bookmark", "bookmarks", "linkding"]],
  [/passw[oö]rt|password/i, ["password", "vault"]],
  [/aufgaben|todo|to-do|task/i, ["task", "todo", "tasks"]],
  [/notiz|notes|notebook/i, ["notes", "notebook"]],
  [/termin|kalender|calendar|scheduling/i, ["calendar", "scheduling"]],
  [/pdf/i, ["pdf"]], [/ocr|texterkennung/i, ["ocr", "document"]],
  [/transkrip|transcrib|whisper/i, ["transcription", "whisper"]],
  [/bild|image|foto|photo/i, ["image", "photo"]],
  [/video/i, ["video"]], [/datei|file|sync/i, ["file", "sync"]],
  [/chat|messeng/i, ["chat", "messaging"]], [/automati|workflow/i, ["automation", "workflow"]],
  [/monitor|überwach|uptime/i, ["monitoring", "uptime"]],
  [/diagram|whiteboard/i, ["diagram", "whiteboard"]],
  [/zeiterfass|time.?track/i, ["time-tracking", "timesheet"]],
  [/wissens|knowledge|wiki/i, ["knowledge", "wiki"]],
  [/trello|asana|kanban/i, ["kanban", "project-management"]],
  [/notion|obsidian|evernote/i, ["notes", "knowledge", "wiki"]],
  [/dropbox|onedrive|google drive/i, ["file", "sync", "storage"]],
  [/photoshop|canva|figma/i, ["image", "design", "editor"]],
  [/1password|lastpass|bitwarden/i, ["password", "vault"]],
  [/docker|deploy|container/i, ["docker", "deployment"]],
];
export function recognizedOpenSourceLicense(value?: string): boolean {
  return !!value && /^(MIT|ISC|Apache-2\.0|Zlib|0BSD|BSD-[23]-Clause|MPL-2\.0|CC0-1\.0|Unlicense|(?:A?GPL|LGPL)-(?:2\.0|2\.1|3\.0)(?:-only|-or-later)?)$/.test(value);
}
export function canonical(value: string): string {
  const u = new URL(value); u.hash = "";
  u.hostname = u.hostname.replace(/^www\./, "");
  if (u.hostname === "github.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && !["topics", "orgs", "users", "search"].includes(parts[0]!)) {
      u.pathname = "/" + parts.slice(0, 2).join("/").replace(/\.git$/, ""); u.search = "";
    }
  } else { u.search = ""; }
  const result = u.href.replace(/\/$/, "");
  return u.hostname === "github.com" ? result.toLowerCase() : result;
}
export function makeProfile(input: string, localPreferred = true, openSourceOnly = false, options?: unknown): SearchProfile {
  input = input.trim();
  if (input.length < 3 || input.length > 3000) throw new Error("Bitte 3 bis 3000 Zeichen als Beschreibung oder Link eingeben.");
  if (hasSecret(input)) throw new Error("Die Eingabe enthält möglicherweise einen geheimen Schlüssel. Bitte nur den allgemeinen Bedarf beschreiben.");
  const settings = searchOptions(options);
  let inputUrl: string | undefined;
  const match = input.match(/https:\/\/[^\s<>"']+/);
  if (match) inputUrl = validatePublicUrl(match[0]).href;
  else if (/^(?:www\.)?github\.com\//i.test(input)) inputUrl = validatePublicUrl("https://" + input.replace(/^www\./, "")).href;
  const words = normalized(input.replace(/https?:\/\/\S+/g, " ")).match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  const content = input.replace(/https?:\/\/\S+/g, " ");
  const expanded = concepts.filter(([re]) => re.test(content)).flatMap(([, terms]) => terms);
  const terms = [...new Set([...expanded, ...words.filter(w => !stop.has(w))])].slice(0, 12);
  return {
    original: input, title: input.slice(0, 120), terms,
    githubQuery: (expanded.length ? expanded.slice(0, 1) : terms.slice(0, 2)).join(" "),
    localPreferred, openSourceOnly, inputUrl, ...settings,
    notes: ["Funktionspassung ist eine Suchhypothese. Pflichtfunktionen und tatsächliche Gratis-Bedingungen müssen am Kandidaten geprüft werden."],
  };
}
export interface LinkEntry { name: string; url: string; description: string; category?: string; license?: string; platforms?: string[] }
const excludedHosts = /(^|\.)(twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com|youtube\.com|discord\.gg|discord\.com|buymeacoffee\.com|ko-fi\.com|patreon\.com|shields\.io|imgur\.com)$/;
export function usableLink(entry: LinkEntry, source: Source): boolean {
  try {
    const u = validatePublicUrl(entry.url);
    return entry.name.length > 2 && entry.name.length < 180 && !excludedHosts.test(u.hostname) &&
      !/\.(png|jpe?g|gif|svg|webp|ico|zip|pdf)(\?|$)/i.test(u.pathname) &&
      canonical(u.href) !== canonical(source.url) &&
      !/^(sign in|sign up|login|privacy|terms|contact|sponsor|read more|home|all|next|previous|fork|star|edit|contribute)$/i.test(entry.name);
  } catch { return false; }
}
export function markdownLinks(text: string, source: Source): LinkEntry[] {
  const links: LinkEntry[] = []; let section = "";
  if (source.id === "saas-alternatives") {
    for (const block of text.split(/(?=^### )/m)) {
      const first = /^### \[([^\]]+)\]\((https:\/\/github\.com\/[^/]+\/[^/#?\s)]+)\)/m.exec(block);
      if (!first) continue;
      const clean = block.split("\n").filter(l => !/^(?:<|\[!\[|!\[)/.test(l)).join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_#]/g, "").slice(0, 650);
      links.push({ name: first[1]!, url: first[2]!, description: clean });
    }
    return links;
  }
  for (const line of text.split("\n")) {
    if (line.startsWith("#")) section = line.replace(/^#+\s*/, "");
    if (!/^\s*(?:[-*]\s|\|)/.test(line)) continue;
    const matches = [...line.matchAll(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g)];
    const primary = matches.find(m => !/^(demo|source code|documentation|license|website)$/i.test(m[1]!));
    const primaryName = primary?.[1]?.replace(/[*_`]/g, "").trim();
    const repoLink = source.id === "selfhosted" ? matches.find(m => /^https:\/\/github\.com\/[^/]+\/[^/#?]+\/?$/.test(m[2]!)) : undefined;
    for (const m of repoLink ? [repoLink] : matches) {
      const entry: LinkEntry = { name: m[1]!.replace(/[*_`]/g, "").trim(), url: m[2]!, description: (section + " · " + line.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")).slice(0, 650), category: section };
      if (source.id === "selfhosted") {
        const labels = [...line.matchAll(/`([^`]+)`/g)].map(m => m[1]!);
        entry.license = labels.find(l => recognizedOpenSourceLicense(l));
        entry.platforms = labels.filter(l => l !== entry.license && !/^(?:A?GPL|LGPL|MIT|BSD|Apache|MPL|CC)/.test(l)).flatMap(l => l.split("/"));
      }
      if (primaryName && (repoLink || /^(demo|source code)$/i.test(entry.name))) entry.name = primaryName;
      if (usableLink(entry, source)) links.push(entry);
    }
  }
  return links;
}
export function relevance(entry: LinkEntry, terms: string[]): { score: number; matches: string[] } {
  const name = normalized(entry.name), text = normalized(entry.description + " " + entry.url);
  const effective = terms.filter(t => !terms.some(other => other !== t && t.startsWith(other)));
  const matches = effective.filter(t => name.includes(t) || text.includes(t));
  const primary = concepts.find(([, synonyms]) => synonyms.includes(effective[0] ?? ""))?.[1] ?? effective.slice(0, 1);
  if (primary.length && !primary.some(term => name.includes(term) || text.includes(term))) return { score: 0, matches: [] };
  const collection = /(?:curated|awesome)[ -]*(?:list|collection)|collection of (?:links|bookmarks|resources)|awesome-/.test(name + " " + text);
  return { score: matches.reduce((n, t) => n + (name.includes(t) ? 12 : 4), 0) - (collection ? 20 : 0), matches };
}
export function mergeCandidates(items: Candidate[], profile: SearchProfile): Candidate[] {
  const merged = new Map<string, Candidate>();
  for (const item of items) {
    const key = canonical(item.url), previous = merged.get(key);
    if (!previous) merged.set(key, { ...item, id: key });
    else {
      const main = item.sources.includes("github") ? item : previous;
      merged.set(key, { ...main, sources: [...new Set([...previous.sources, ...item.sources])], score: Math.max(previous.score, item.score), evidence: [...previous.evidence, ...item.evidence].slice(0, 6) });
    }
  }
  return [...merged.values()].filter(c => (!profile.openSourceOnly || (c.kind === "repository" && c.cost === "oss")) && !(profile.excluded ?? []).some(term => normalized(c.name + " " + c.description).includes(normalized(term))))
    .map(c => assessCandidate(c, profile))
    .sort((a, b) => b.score - a.score || (b.stars ?? 0) - (a.stars ?? 0)).slice(0, 30);
}
