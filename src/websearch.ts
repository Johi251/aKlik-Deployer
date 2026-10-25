import type { Candidate, Coverage, SearchProfile } from "./types";
import { canonical, relevance } from "./search";
import { sources } from "./sources";
import { mapLimit, validatePublicUrl } from "./network";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { read, save } from "./store";
import { must } from "./process";

interface SearchResponse { results: { title: string; url: string; content?: string; engines?: string[] }[]; unresponsive_engines?: [string, string][] }
export async function webSearch(profile: SearchProfile): Promise<{ candidates: Candidate[]; coverage: Coverage[] }> {
  const candidates: Candidate[] = [], coverage: Coverage[] = [];
  const checkedAt = new Date().toISOString();
  const cacheId = createHash("sha256").update(profile.githubQuery + "|" + profile.terms.join(",")).digest("hex");
  const cached = read<{ id: string; at: number; candidates: Candidate[]; coverage: Coverage[] }>("webcache", cacheId);
  if (cached && Date.now() - cached.at < 15 * 60_000) return { candidates: cached.candidates, coverage: cached.coverage.map(c => ({ ...c, status: c.status === "searched" ? "cached" : c.status, detail: "Websuch-Cache, höchstens 15 Minuten. " + c.detail })) };
  const healthy = async () => { try { return (await fetch("http://127.0.0.1:43111/healthz", { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; } };
  try {
    if (!await healthy()) {
      // Recover only the previously installed, owner-labelled local service; no global Docker restart.
      await must([process.execPath, join(import.meta.dir, "../scripts/setup-search.ts")], { timeout: 60_000 });
      if (!await healthy()) throw new Error();
    }
  } catch {
    return { candidates, coverage: [{ id: "web", name: "Seitenübergreifende Websuche", url: "https://docs.searxng.org/", status: "failed", count: 0, checkedAt, detail: "Lokaler Suchdienst nicht erreichbar. Katalog-/GitHub-Suche bleibt verfügbar. Mit bun run search:up starten." }] };
  }
  const term = profile.githubQuery || profile.terms.slice(0, 2).join(" ");
  const domains = [...new Set(sources.filter(s => s.kind !== "github").map(s => new URL(s.url).hostname))];
  const groups: string[][] = [];
  for (let i = 0; i < domains.length; i += 4) groups.push(domains.slice(i, i + 4));
  const queries = [ { id: "web", name: "Offene Websuche", q: `${term} free open source software`, domains: [] as string[] }, ...groups.map((group, i) => ({ id: `web-sources-${i}`, name: `Websuche in Quellen ${i + 1}`, q: `${term} (${group.map(d => "site:" + d).join(" OR ")})`, domains: group })) ];
  const outcomes = await mapLimit(queries, 2, async query => {
    try {
      const params = new URLSearchParams({ q: query.q, format: "json", categories: "general", language: "en", safesearch: "1" });
      const response = await fetch("http://127.0.0.1:43111/search?" + params, { signal: AbortSignal.timeout(18_000) });
      if (!response.ok) throw new Error("Suchdienst antwortet mit HTTP " + response.status);
      const data = await response.json() as SearchResponse;
      const valid = (data.results ?? []).slice(0, 12).filter(r => { try { const u = validatePublicUrl(r.url); return !query.domains.length || query.domains.some(d => u.hostname === d || u.hostname.endsWith("." + d)); } catch { return false; } });
      const items = valid.map(result => {
        const entry = { name: result.title.slice(0, 180), url: result.url, description: (result.content ?? "Webfund; Originalbedingungen noch zu prüfen.").slice(0, 650) };
        const match = relevance(entry, profile.terms);
        const hostname = new URL(result.url).hostname;
        const sourceId = sources.find(s => new URL(s.url).hostname === hostname)?.id;
        return { id: canonical(result.url), ...entry, sources: [...new Set(["web", ...(sourceId ? [sourceId] : [])])], score: match.score, reasons: match.matches.map(t => `Suchbegriff: ${t}`), kind: /^https:\/\/github\.com\/[^/]+\/[^/#?]+\/?$/.test(result.url) ? "repository" : "online", cost: "unknown", evidence: [{ label: "Websuchtreffer", url: result.url, text: entry.description, checkedAt }] } satisfies Candidate;
      });
      const failures = data.unresponsive_engines?.map(e => e[0]).join(", ");
      return { items, coverage: { id: query.id, name: query.name, url: "http://127.0.0.1:43111/search?q=" + encodeURIComponent(query.q), status: failures?.length || !valid.length ? "partial" : "searched", count: valid.length, checkedAt, detail: `${query.domains.length ? query.domains.join(", ") : "Allgemeine Produkt- und Projektsuche"}. Bis zu zwölf indexierte Treffer, keine vollständige Inventur.${failures ? " Nicht antwortende Suchmaschinen: " + failures + "." : ""}` } satisfies Coverage };
    } catch (e) { return { items: [] as Candidate[], coverage: { id: query.id, name: query.name, url: "https://docs.searxng.org/", status: "failed", count: 0, checkedAt, detail: (e as Error).message } satisfies Coverage }; }
  });
  candidates.push(...outcomes.flatMap(o => o.items)); coverage.push(...outcomes.map(o => o.coverage));
  if (candidates.length) save("webcache", { id: cacheId, at: Date.now(), candidates, coverage });
  return { candidates, coverage };
}
