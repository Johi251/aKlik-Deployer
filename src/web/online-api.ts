import { canonical, makeProfile, markdownLinks, mergeCandidates, recognizedOpenSourceLicense, relevance } from "../discovery";
import { sources } from "../sources";
import { hasSecret, requirementChecks } from "../matching";
import { inferApp, manifestNames, normalizeRoot, parseRepo, rootCandidates } from "../repo-model";
import { reviewCompose } from "../compose-review";
import { hostingOptions, installationOptions, type GitHubRelease } from "../repo-options";
import { inspectModel, modelSetupProfile } from "../model-planner";
import { findAlternatives } from "../usage-guide";
import type { Analysis, Candidate, CandidateReview, Coverage, Favorite, ModelProfile, ModelReport, SearchResult } from "../types";

const key = "aklik-deployer-online-v1";
const previousKey=['one','clicker-online-v1'].join('');
interface BrowserData { searches: SearchResult[]; analyses: Analysis[]; favorites: Favorite[]; reviews: CandidateReview[]; modelReports: ModelReport[]; modelProfiles: ModelProfile[] }
const empty = (): BrowserData => ({ searches: [], analyses: [], favorites: [], reviews: [], modelReports: [], modelProfiles: [] });
function load(): BrowserData { const text = localStorage.getItem(key)??localStorage.getItem(previousKey); if (!text) return empty(); try { const d = JSON.parse(text); if (Array.isArray(d.searches) && Array.isArray(d.analyses) && Array.isArray(d.favorites) && Array.isArray(d.reviews)) return { ...d, modelReports: d.modelReports ?? [], modelProfiles: d.modelProfiles ?? [] }; } catch { /* preserve invalid storage */ } throw new Error("Lokale Browserdaten nicht lesbar. Vor dem Zurücksetzen vorhandene Daten über die Browserfunktionen sichern."); }
function persist(data: BrowserData): void { try { localStorage.setItem(key, JSON.stringify(data)); } catch { throw new Error("Browserspeicher voll oder gesperrt. Exportiere wichtige Recherchen; neue Daten konnten nicht dauerhaft gespeichert werden."); } }
const cache = new Map<string, { at: number; value: unknown }>();
export async function githubText(url: string, maxBytes = 2_000_000): Promise<string> {
  const u = new URL(url); if (u.protocol !== "https:" || !["api.github.com", "raw.githubusercontent.com", "huggingface.co", "openrouter.ai"].includes(u.hostname) || u.username || u.password || u.port || (["huggingface.co", "openrouter.ai"].includes(u.hostname) && !u.pathname.startsWith("/api/"))) throw new Error("Die Online-Version liest nur öffentliche GitHub-Quelldateien und Modell-Metadaten von unterstützten APIs.");
  const old = cache.get(url); if (old && Date.now() - old.at < 15 * 60_000) return old.value as string;
  const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(18_000), headers: { Accept: "application/vnd.github+json, text/plain" } });
  if (!response.ok) throw new Error(`GitHub/Quelldatei: HTTP ${response.status}. ${[403,429].includes(response.status) ? "Abfragelimit möglich; später erneut prüfen." : "Quelle nicht verfügbar."}`);
  const reader = response.body?.getReader(); if (!reader) throw new Error("Leere Quellantwort.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > maxBytes) { await reader.cancel(); throw new Error("Quelldatei überschreitet das Analyse-Limit."); } chunks.push(item.value); }
  const result = new Uint8Array(size); let offset = 0; for (const c of chunks) { result.set(c, offset); offset += c.length; }
  const text = new TextDecoder().decode(result); cache.set(url, { at: Date.now(), value: text }); return text;
}
const json = async <T>(url: string): Promise<T> => JSON.parse(await githubText(url)) as T;
interface Meta { full_name: string; html_url: string; description: string | null; language: string | null; default_branch: string; license: { spdx_id: string } | null; stargazers_count: number; pushed_at: string; archived: boolean; open_issues_count: number }
function repoCandidate(m: Meta, terms: string[], input = false): Candidate { const match = relevance({ name: m.full_name, url: m.html_url, description: m.description ?? "" }, terms); return { id: canonical(m.html_url), name: m.full_name, url: m.html_url, description: m.description ?? "Repository ohne Beschreibung", sources: input ? ["github", "input"] : ["github"], score: input ? 100 : match.score, reasons: match.matches.map(t => "Suchbegriff: " + t), kind: "repository", license: m.license?.spdx_id, stars: m.stargazers_count, updated: m.pushed_at, archived: m.archived, cost: recognizedOpenSourceLicense(m.license?.spdx_id) ? "oss" : "unknown", evidence: [{ label: "GitHub-Metadaten", url: m.html_url, text: "Lizenzangabe und Aktivität; Kosten und Funktionen ungeprüft.", checkedAt: new Date().toISOString() }] }; }
export async function onlineSearch(input: string, localPreferred: boolean, openSourceOnly: boolean, options?: unknown): Promise<SearchResult> {
  const profile = makeProfile(input, localPreferred, openSourceOnly, options), candidates: Candidate[] = [], checkedAt = new Date().toISOString();
  if (profile.inputUrl?.startsWith("https://github.com/")) {
    const repo = parseRepo(profile.inputUrl), meta = await json<Meta>(`https://api.github.com/repos/${repo.owner}/${repo.repo}`);
    const derived = makeProfile(meta.description || meta.full_name); profile.title = meta.full_name; profile.terms = [...new Set([...profile.terms, ...derived.terms])].slice(0, 12); profile.githubQuery ||= derived.githubQuery; candidates.push(repoCandidate(meta, profile.terms, true));
  } else if (profile.inputUrl) profile.notes.push("Produktseiten werden online nicht automatisch abgerufen. Ergänze zum Link eine Beschreibung der gesuchten Funktion.");
  if (!profile.terms.length) throw new Error("Bitte zum Produktlink eine kurze Funktionsbeschreibung ergänzen.");
  const outcomes = await Promise.all(sources.map(async source => {
    const coverage: Coverage = { id: source.id, name: source.name, url: source.url, status: "reference", count: 0, checkedAt, detail: "Online als Recherchelink verfügbar. Kein vollständiger automatischer Seitenabruf." };
    const found: Candidate[] = [];
    try {
      if (source.kind === "github") {
        const term = profile.githubQuery === "bookmark" ? "bookmark manager" : profile.githubQuery;
        const data = await json<{ items: Meta[] }>("https://api.github.com/search/repositories?" + new URLSearchParams({ q: term + " in:name,description archived:false", per_page: "12" }));
        found.push(...data.items.map(m => repoCandidate(m, profile.terms)).filter(c => c.score > 0)); coverage.status = "searched"; coverage.count = found.length; coverage.detail = "Anonyme GitHub-Suche; bis zu zwölf Treffer, 15 Minuten Browser-Cache.";
      } else if (source.kind === "markdown" && source.feed) {
        const entries = markdownLinks(await githubText(source.feed), source);
        for (const entry of entries) {
          const match = relevance(entry, profile.terms); if (match.score < 4) continue;
          const isRepo = /^https:\/\/github\.com\/[^/]+\/[^/#?]+\/?$/.test(entry.url);
          found.push({ id: canonical(entry.url), ...entry, sources: [source.id], score: match.score + (localPreferred && source.id === "selfhosted" ? 8 : 0), reasons: match.matches.map(t => "Suchbegriff: " + t), kind: isRepo ? "repository" : "online", cost: isRepo && recognizedOpenSourceLicense(entry.license) ? "oss" : "catalog", licenseSource: entry.license ? source.name + " (Katalogangabe)" : undefined, evidence: [{ label: source.name, url: source.feed, text: "Katalogangabe; Originalbedingungen ungeprüft.", checkedAt }] });
        }
        coverage.status = "searched"; coverage.count = entries.length; coverage.detail = "Markdown-Quelldatei im Browser durchsucht; Quellenlizenz beibehalten.";
      }
    } catch (e) { coverage.status = "failed"; coverage.detail = (e as Error).message; }
    return { coverage, found: found.sort((a,b) => b.score - a.score).slice(0, 20) };
  }));
  const result: SearchResult = { id: crypto.randomUUID(), createdAt: checkedAt, profile, candidates: mergeCandidates([...candidates, ...outcomes.flatMap(o => o.found)], profile), coverage: outcomes.map(o => o.coverage), recommendation: "Prüfe vorhandene Kandidaten und Originalbedingungen. Die Online-Version durchsucht GitHub und die verfügbaren Markdown-Kataloge; weitere Quellen sind manuell verlinkt." };
  const state = load(); state.searches = [result, ...state.searches].slice(0, 12); persist(state); return result;
}
export async function onlineAnalyze(value: string, requestedRoot?: string): Promise<Analysis> {
  const repository = parseRepo(value), api = `https://api.github.com/repos/${repository.owner}/${repository.repo}`, meta = await json<Meta>(api);
  const commit = await json<{ sha: string; commit: { tree: { sha: string } } }>(api + "/commits/" + encodeURIComponent(repository.ref ?? meta.default_branch));
  const tree = await json<{ truncated: boolean; tree: { path: string; mode: string; type: string; size?: number }[] }>(api + "/git/trees/" + commit.commit.tree.sha + "?recursive=1");
  if (tree.truncated || tree.tree.length > 25_000) throw new Error("Repository zu groß für die begrenzte Analyse.");
  const roots = rootCandidates(tree.tree), root = requestedRoot === undefined ? (roots.includes("") ? "" : roots[0] ?? "") : normalizeRoot(requestedRoot);
  if (requestedRoot !== undefined && !roots.includes(root)) throw new Error("App-Verzeichnis nicht gefunden.");
  const files: Record<string, string> = {}, blockers: string[] = [], warnings = ["Online werden keine Programme ausgeführt. Lokale Container werden nur durch den lokalen aKlik-Deployer gestartet.", "Funktionen, Nutzungsrechte und Zusatzkosten bleiben separat zu prüfen."];
  const entries = tree.tree.filter(e => e.type === "blob" && (e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : "") === root && manifestNames.has(e.path.split("/").at(-1)!)).sort((a,b) => Number(a.path.endsWith("README.md")) - Number(b.path.endsWith("README.md"))).slice(0, 12);
  for (const entry of entries) { if ((entry.size ?? 0) > 80_000) { blockers.push("Datei zu groß: " + entry.path); continue; } files[entry.path] = await githubText(`https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${commit.sha}/${entry.path.split("/").map(encodeURIComponent).join("/")}`, 80_000); }
  const app = inferApp(files, root), configName = app.strategy === "compose" ? ["compose.yaml", "compose.yml", "docker-compose.yml", "docker-compose.yaml"].find(n => files[root ? root + "/" + n : n]) : app.strategy === "dockerfile" ? "Dockerfile" : undefined, configFile = configName ? (root ? root + "/" + configName : configName) : undefined;
  let env: Analysis["env"] = [];
  if (configFile && app.strategy === "compose") { const review = reviewCompose(files[configFile]!, configFile); env = review.env; blockers.push(...review.blockers); warnings.push(...review.warnings); }
  if (tree.tree.some(e => ["120000", "160000"].includes(e.mode))) blockers.push("Symlinks/Submodule: lokaler automatischer Start gesperrt.");
  if (!roots.includes("") && roots.length > 1 && requestedRoot === undefined) blockers.push("Mehrere Apps: App-Verzeichnis zuerst auswählen.");
  if (meta.archived) blockers.push("Repository archiviert.");
  if (app.strategy === "unsupported") blockers.push("Kein unterstützter Docker-Startweg erkannt. Native Optionen separat prüfen.");
  const result: Analysis = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), repository, commit: commit.sha, root, roots, name: meta.full_name, description: meta.description ?? "", ...app, language: app.language === "Unbekannt" ? meta.language ?? app.language : app.language, configFile, env, license: meta.license?.spdx_id ?? "Unbekannt", archived: meta.archived, updatedAt: meta.pushed_at, openIssues: meta.open_issues_count, warnings, blockers, files, evidence: entries.map(e => ({ label: e.path, url: `${repository.url}/blob/${commit.sha}/${e.path}`, text: "Öffentliche Datei statisch gelesen.", checkedAt: new Date().toISOString() })) };
  let release: GitHubRelease | undefined; try { release = await json<GitHubRelease>(api + "/releases/latest"); result.releaseNote = `Neuester stabiler Release: ${release.tag_name}. Release-Dateien können vom geprüften Quellcode-Commit abweichen. Signaturen und Installation ungeprüft.`; } catch (e) { result.releaseNote = "Release-Prüfung ohne vollständiges Ergebnis: " + (e as Error).message; }
  result.installOptions = installationOptions(result, release); result.onlineOptions = hostingOptions(result, tree.tree.map(e => e.path));
  const data = load(); data.analyses = [result, ...data.analyses].slice(0, 8); persist(data); return result;
}
export function onlineExport(result: SearchResult, format: string): void {
  const data = load(), reviews = data.reviews.filter(r => result.candidates.some(c => c.id === r.candidateId));
  const body = format === "json" ? JSON.stringify({ ...result, reviews, sourceRights: "Katalogtexte behalten ihre Quellenlizenzen. Awesome Selfhosted CC-BY-SA-3.0; Open SaaS Directory MIT. Siehe Quellenhinweise." }, null, 2) : [`# aKlik-Deployer-Recherche: ${result.profile.title}`, result.createdAt, "Texthinweise sind keine Funktions- oder Gratiszusage.", ...result.candidates.flatMap(c => [`\n## ${c.name}`, c.url, c.description, "Lizenzangabe: " + (c.license ?? "offen"), ...c.evidence.map(e => `${e.label}: ${e.url}`)]), "\n## Originalprüfungen", ...reviews.map(r => JSON.stringify(r, null, 2)), "\n## Suchabdeckung", ...result.coverage.map(c => `${c.name}: ${c.status} · ${c.detail}`), "\nKatalogtexte: Awesome Selfhosted CC-BY-SA-3.0, Autoren und Mitwirkende. Open SaaS Directory MIT, Copyright 2026. Quellenlizenzen beibehalten."].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: format === "json" ? "application/json" : "text/markdown;charset=utf-8" })), a = document.createElement("a"); a.href = url; a.download = `aklik-deployer-recherche.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export async function onlineAPI<T>(path: string, body?: unknown): Promise<T> {
  const data = load(), b = body as Record<string, any> ?? {}; let result: unknown;
  if (path === "/api/state") result = { sources, searches: data.searches, favorites: data.favorites, analyses: data.analyses.map(({ files, ...a }) => a), projects: [], modelReports: data.modelReports, modelProfiles: data.modelProfiles };
  else if (path === "/api/model/check") { const report = await inspectModel(b.url, json); data.modelReports = [report, ...data.modelReports].slice(0,12); persist(data); result = report; }
  else if (path === "/api/model/profile") { const report = data.modelReports.find(r => r.id === b.reportId); if (!report) throw new Error("Modellprüfung fehlt."); const profile = modelSetupProfile(report, b); data.modelProfiles = [profile, ...data.modelProfiles].slice(0,30); persist(data); result = profile; }
  else if (path === "/api/search") return await onlineSearch(b.input, b.localPreferred !== false, b.openSourceOnly === true, b.options) as T;
  else if (path === "/api/alternatives") { const analysis = data.analyses.find(a => a.id === b.analysisId); if (!analysis) throw new Error("Analyse nicht mehr im Browser gespeichert. Repository erneut prüfen."); return await findAlternatives(analysis, b.purpose, onlineSearch) as T; }
  else if (path === "/api/analyze") { const { files, ...a } = await onlineAnalyze(b.url, b.root); return a as T; }
  else if (path === "/api/tools") result = { docker: false, railpack: false, detail: "Online-Version: Recherche und Planung. PC-Installationen in der lokalen Version." };
  else if (path === "/api/diagnostics") result = { edition: "web", checkedAt: new Date().toISOString(), checks: [{ name: "Online-Version", status: "ok", detail: "Recherche und Planung im Browser; Rechner muss nicht eingeschaltet sein." }, { name: "Deine Daten", status: "ok", detail: "Verlauf und Merkliste in diesem Browser gespeichert. Kein automatischer Abgleich mit der lokalen PC-Version." }, { name: "Lokale Installation", status: "warn", detail: "Online kein Zugriff auf Docker oder Dateien deines PCs.", action: "Lokale Version herunterladen, entpacken und START-AKLIK-DEPLOYER.cmd öffnen." }, { name: "GitHub / Quellen", status: "warn", detail: "Öffentliche Abfragen ohne Anmeldung, mit Limits. Abdeckung pro Recherche sichtbar." }] };
  else if (path === "/api/favorite") { const search = data.searches.find(s => s.id === b.searchId), candidate = search?.candidates.find(c => c.id === b.candidateId); if (!candidate) throw new Error("Kandidat nicht mehr im Browserverlauf. Recherche erneut öffnen."); const old = data.favorites.find(f => f.candidate.id === candidate.id), favorite: Favorite = { id: old?.id ?? crypto.randomUUID(), candidate, searchId: b.searchId, notes: old?.notes ?? "", createdAt: old?.createdAt ?? new Date().toISOString(), hidden: false }; data.favorites = [favorite, ...data.favorites.filter(f => f.id !== favorite.id)]; if (data.favorites.length > 200) throw new Error("Merkliste auf 200 Einträge begrenzt."); persist(data); result = favorite; }
  else if (path === "/api/favorite/update") { const f = data.favorites.find(f => f.id === b.id); if (!f) throw new Error("Merkeintrag fehlt."); if (b.notes !== undefined) { if (typeof b.notes !== "string" || b.notes.length > 2000 || hasSecret(b.notes)) throw new Error("Notiz zu lang oder Geheimwertmuster erkannt."); f.notes = b.notes; } if (typeof b.hidden === "boolean") f.hidden = b.hidden; persist(data); result = f; }
  else if (path === "/api/review") {
    const search = data.searches.find(s => s.id === b.searchId), favorite = data.favorites.find(f => f.searchId === b.searchId && f.candidate.id === b.candidateId), candidate = search?.candidates.find(c => c.id === b.candidateId) ?? favorite?.candidate;
    if (!candidate) throw new Error("Kandidat nicht gefunden."); if (candidate.kind !== "repository") throw new Error("Online-Angebote bitte über Original öffnen prüfen. Die Online-Version liest keine beliebigen Webseiten automatisch.");
    const repo = parseRepo(candidate.url), api = `https://api.github.com/repos/${repo.owner}/${repo.repo}`, meta = await json<Meta>(api), doc = await json<{ content: string; encoding: string; size: number; sha: string; html_url: string }>(api + "/readme");
    if (doc.encoding !== "base64" || doc.size > 120_000) throw new Error("README außerhalb der Textprüfung.");
    const text = new TextDecoder().decode(Uint8Array.from(atob(doc.content.replace(/\s/g, "")), c => c.charCodeAt(0))), checkedAt = new Date().toISOString();
    const review: CandidateReview = { id: candidate.id, candidateId: candidate.id, checkedAt, title: meta.full_name, url: candidate.url, license: meta.license?.spdx_id, archived: meta.archived, updated: meta.pushed_at, readmeSha: doc.sha, checks: requirementChecks(search?.profile.requirements ?? [], [{ text, url: doc.html_url }]), evidence: [{ label: "README · Datei-SHA " + doc.sha.slice(0,12), url: doc.html_url, text: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 500), checkedAt }], cautions: ["Texthinweise sind keine bestätigten Funktionen. Gratisbedingungen und externe Pflichtdienste prüfen."] }; data.reviews = [review, ...data.reviews.filter(r => r.id !== review.id)].slice(0, 30); persist(data); result = review;
  } else throw new Error("Diese Aktion benötigt den lokalen aKlik-Deployer auf deinem Computer.");
  return result as T;
}
