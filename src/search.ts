import { canonical, makeProfile, markdownLinks, relevance, mergeCandidates, recognizedOpenSourceLicense, usableLink, type LinkEntry } from "./discovery";
export { canonical, makeProfile, markdownLinks, relevance, mergeCandidates, recognizedOpenSourceLicense, normalized } from "./discovery";
import { createHash, randomUUID } from "node:crypto";
import { getJSON, getPublic, mapLimit, validatePublicUrl } from "./network";
import { read, save } from "./store";
import { sources } from "./sources";
import { webSearch } from "./websearch";
import type { Candidate, Coverage, SearchProfile, SearchResult, Source } from "./types";

export async function htmlLinks(html: string, source: Source): Promise<LinkEntry[]> {
  const links: LinkEntry[] = []; let current: LinkEntry | undefined;
  const rewriter = new HTMLRewriter().on("a[href]", {
    element(el) {
      try { current = { url: new URL(el.getAttribute("href")!, source.url).href, name: "", description: "" }; links.push(current); }
      catch { current = undefined; }
    },
    text(t) { if (current) current.name += t.text; },
  });
  await rewriter.transform(new Response(html)).text();
  return links.map(l => ({ ...l, name: l.name.replace(/\s+/g, " ").trim(), description: l.name.replace(/\s+/g, " ").trim().slice(0, 650) }))
    .filter(l => usableLink(l, source) && new URL(l.url).hostname !== new URL(source.url).hostname);
}
interface Cache { id: string; version: number; at: string; entries: LinkEntry[]; partial: boolean }
async function catalog(source: Source): Promise<{ entries: LinkEntry[]; coverage: Coverage }> {
  const cached = read<Cache>("catalog", source.id);
  if (cached && cached.version === 4 && Date.now() - Date.parse(cached.at) < 6 * 3600_000) return {
    entries: cached.entries,
    coverage: { id: source.id, name: source.name, url: source.url, status: cached.partial ? "partial" : "cached", count: cached.entries.length, checkedAt: cached.at, detail: cached.partial ? "Zwischengespeicherter Startseiten-Auszug, kein vollständiger Katalog." : "Katalog aus lokalem Cache (höchstens sechs Stunden)." },
  };
  const response = await getPublic(source.feed ?? source.url);
  const text = response.body.toString("utf8");
  const entries = source.kind === "markdown" ? markdownLinks(text, source) : await htmlLinks(text, source);
  const at = new Date().toISOString();
  save("catalog", { id: source.id, version: 4, at, entries, partial: source.kind !== "markdown" });
  return { entries, coverage: {
    id: source.id, name: source.name, url: source.url,
    status: source.kind === "markdown" ? "searched" : "partial", count: entries.length, checkedAt: at,
    detail: source.kind === "markdown" ? "Verlinkte Quelldatei gelesen und ihre Einträge durchsucht." : entries.length ? "Öffentliche Startseite gelesen; nur sichtbare externe Links durchsucht, keine vollständige Seitensuche." : "Seite abrufbar, aber keine verwendbaren externen Einträge auslesbar.",
  } };
}
interface GitHubItem { full_name: string; html_url: string; description: string | null; license: { spdx_id: string } | null; stargazers_count: number; pushed_at: string; archived: boolean }
async function githubSearch(profile: SearchProfile): Promise<Candidate[]> {
  if (!profile.githubQuery) return [];
  const term = profile.githubQuery === "bookmark" ? "bookmark manager" : profile.githubQuery;
  const query = new URLSearchParams({ q: term + " in:name,description archived:false", per_page: "12" });
  const cacheId = createHash("sha256").update(query.toString()).digest("hex");
  const cached = read<{ id: string; at: number; data: { items: GitHubItem[] } }>("github-search", cacheId);
  const data = cached && Date.now() - cached.at < 15 * 60_000 ? cached.data : await getJSON<{ items: GitHubItem[] }>("https://api.github.com/search/repositories?" + query);
  if (data !== cached?.data) save("github-search", { id: cacheId, at: Date.now(), data });
  return data.items.filter(item => relevance({ name: item.full_name, url: item.html_url, description: item.description ?? "" }, profile.terms).score > 0).map(item => {
    const match = relevance({ name: item.full_name, url: item.html_url, description: item.description ?? "" }, profile.terms);
    const license = item.license?.spdx_id;
    return {
      id: canonical(item.html_url), name: item.full_name, url: item.html_url,
      description: item.description ?? "Keine Repository-Beschreibung.", sources: ["github"],
      score: match.score + (profile.localPreferred ? 8 : 0), reasons: match.matches.map(t => `Suchbegriff: ${t}`),
      kind: "repository", license, stars: item.stargazers_count, updated: item.pushed_at,
      archived: item.archived, cost: recognizedOpenSourceLicense(license) ? "oss" : "unknown",
      evidence: [{ label: "GitHub-Metadaten", url: item.html_url, text: `Lizenzangabe: ${license ?? "unbekannt"}. Zusatzkosten und benötigte Dienste sind noch ungeprüft.`, checkedAt: new Date().toISOString() }],
    } satisfies Candidate;
  });
}
export async function search(input: string, localPreferred: boolean, openSourceOnly: boolean, options?: unknown): Promise<SearchResult> {
  const profile = makeProfile(input, localPreferred, openSourceOnly, options);
  const inputCandidates: Candidate[] = [];
  if (profile.inputUrl) {
    const inputUrl = new URL(profile.inputUrl);
    if (inputUrl.hostname === "github.com" && inputUrl.pathname.split("/").filter(Boolean).length >= 2) {
      const slug = inputUrl.pathname.split("/").filter(Boolean).slice(0, 2).join("/").replace(/\.git$/, "");
      try {
        const m = await getJSON<GitHubItem>(`https://api.github.com/repos/${slug}`);
        profile.title = m.full_name;
        profile.terms = [...new Set([...profile.terms, ...makeProfile(m.description || m.full_name).terms])].slice(0, 12);
        profile.githubQuery = profile.githubQuery || profile.terms.slice(0, 2).join(" ");
        inputCandidates.push({ id: canonical(m.html_url), name: m.full_name, url: m.html_url, description: m.description ?? "Eingegebenes Repository", sources: ["input", "github"], score: 100, reasons: ["Dein eingegebener Kandidat"], kind: "repository", license: m.license?.spdx_id, stars: m.stargazers_count, updated: m.pushed_at, archived: m.archived, cost: recognizedOpenSourceLicense(m.license?.spdx_id) ? "oss" : "unknown", evidence: [{ label: "Eingegebener Kandidat", url: m.html_url, text: "Original-Repository gelesen; Laufzeit und Zusatzkosten ungeprüft.", checkedAt: new Date().toISOString() }] });
      } catch (e) { profile.notes.push(`Eingegebenes Repository: ${(e as Error).message}`); }
    } else {
      // Only title/description go to search providers, never the full supplied document.
      try {
        const page = (await getPublic(profile.inputUrl)).body.toString("utf8");
        let title = "", description = "";
        await new HTMLRewriter().on("title", { text(t) { title += t.text; } })
          .on('meta[name="description"]', { element(el) { description = el.getAttribute("content") ?? ""; } })
          .transform(new Response(page)).text();
        const derived = makeProfile((title + " " + description).slice(0, 900) || inputUrl.hostname);
        profile.title = title.slice(0, 120) || inputUrl.hostname;
        profile.terms = [...new Set([...profile.terms, ...derived.terms])].slice(0, 12);
        profile.githubQuery ||= derived.githubQuery;
        profile.notes.push("Produktlink anhand von Seitentitel und Beschreibung eingeordnet; Funktionsumfang noch ungeprüft.");
      } catch (e) { profile.notes.push(`Produktlink konnte nicht eingeordnet werden: ${(e as Error).message}`); }
    }
  }
  if (!profile.terms.length) throw new Error("Aus dem Link konnten keine Suchbegriffe abgeleitet werden. Bitte ergänze die gewünschte Funktion.");
  const webPromise = webSearch(profile);
  const outcomes = await mapLimit(sources, 4, async source => {
    if (source.kind === "reference") return { candidates: [] as Candidate[], coverage: { id: source.id, name: source.name, url: source.url, status: "reference", count: 0, checkedAt: new Date().toISOString(), detail: source.purpose + ". Kein allgemeiner Suchadapter; als offene Recherchequelle verlinkt." } satisfies Coverage };
    try {
      if (source.kind === "github") {
        const candidates = await githubSearch(profile);
        return { candidates, coverage: { id: source.id, name: source.name, url: source.url, status: "searched", count: candidates.length, checkedAt: new Date().toISOString(), detail: `Öffentliche GitHub-Suche: ${profile.githubQuery}. Ergebnisse höchstens 15 Minuten zwischengespeichert; bis zu zwölf Treffer; keine vollständige GitHub-Inventur.` } satisfies Coverage };
      }
      const { entries, coverage } = await catalog(source);
      const candidates = entries.map(entry => ({ entry, match: relevance(entry, profile.terms) })).filter(({ match }) => match.score >= 4).sort((a, b) => b.match.score - a.match.score).slice(0, 20).map(({ entry, match }) => {
        const isRepo = /^https:\/\/github\.com\/[^/]+\/[^/#?]+\/?$/.test(entry.url);
        return { id: canonical(entry.url), name: entry.name, url: entry.url, description: entry.description, category: entry.category, license: entry.license, licenseSource: entry.license ? source.name + " (Katalogangabe)" : undefined, platforms: entry.platforms, sources: [source.id], score: match.score + (profile.localPreferred && source.id === "selfhosted" ? 8 : 0), reasons: match.matches.map(t => `Suchbegriff: ${t}`), kind: isRepo ? "repository" : "online", cost: isRepo && recognizedOpenSourceLicense(entry.license) ? "oss" : "catalog", evidence: [{ label: source.name, url: source.feed ?? source.url, text: "Katalogfund. Preise, Lizenz und Funktionsumfang beim Original noch zu prüfen.", checkedAt: coverage.checkedAt }] } satisfies Candidate;
      });
      return { candidates, coverage };
    } catch (e) { return { candidates: [] as Candidate[], coverage: { id: source.id, name: source.name, url: source.url, status: "failed", count: 0, checkedAt: new Date().toISOString(), detail: (e as Error).message } satisfies Coverage }; }
  });
  const web = await webPromise;
  const candidates = mergeCandidates([...inputCandidates, ...outcomes.flatMap(o => o.candidates), ...web.candidates], profile);
  const result: SearchResult = {
    id: randomUUID(), createdAt: new Date().toISOString(), profile, candidates, coverage: [...outcomes.map(o => o.coverage), ...web.coverage],
    recommendation: candidates.length ? "Vorhandene Kandidaten gefunden. Prüfe zuerst Funktionsumfang und Bedingungen; die Rangfolge allein ist keine bestätigte Produktempfehlung." : "In den abgefragten Quellen keine passenden Kandidaten belegt. Suchbegriffe erweitern und offene Quellen prüfen, bevor ein Neubau geplant wird.",
  };
  return save("search", result);
}
export function candidateId(url: string): string { return createHash("sha256").update(canonical(url)).digest("hex").slice(0, 16); }
