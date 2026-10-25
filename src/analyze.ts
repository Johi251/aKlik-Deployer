import { manifestNames, parseRepo, normalizeRoot, rootCandidates, inferApp, type RepoMetadata, type TreeEntry } from "./repo-model";
export { parseRepo, normalizeRoot, rootCandidates, inferApp } from "./repo-model";
const posix = { basename: (path: string) => path.split("/").at(-1)!, dirname: (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "." };
import { randomUUID } from "node:crypto";
import { getJSON, getPublic, mapLimit } from "./network";
import { extractEnv, reviewCompose } from "./compose";
import { read, save } from "./store";
import { hostingOptions, installationOptions, type GitHubRelease } from "./repo-options";
import type { Analysis, RepoRef } from "./types";

export async function analyze(url: string, requestedRoot?: string): Promise<Analysis> {
  const repository = parseRepo(url), api = `https://api.github.com/repos/${repository.owner}/${repository.repo}`;
  const meta = await getJSON<RepoMetadata>(api);
  const commit = await getJSON<{ sha: string; commit: { tree: { sha: string } } }>(`${api}/commits/${encodeURIComponent(repository.ref ?? meta.default_branch)}`);
  const treeResult = await getJSON<{ truncated: boolean; tree: TreeEntry[] }>(`${api}/git/trees/${commit.commit.tree.sha}?recursive=1`);
  if (treeResult.truncated || treeResult.tree.length > 25_000) throw new Error("Repository-Baum zu groß für die begrenzte Analyse. Keine automatische Startfreigabe.");
  const tree = treeResult.tree, roots = rootCandidates(tree);
  const root = requestedRoot === undefined ? (roots.includes("") ? "" : roots[0] ?? "") : normalizeRoot(requestedRoot);
  if (requestedRoot !== undefined && !roots.includes(root)) throw new Error("Dieses App-Verzeichnis wurde im Repository nicht gefunden.");
  const selected = tree.filter(t => t.type === "blob" && (posix.dirname(t.path) === (root || ".") && manifestNames.has(posix.basename(t.path))))
    .sort((a, b) => (posix.basename(a.path) === "README.md" ? 1 : 0) - (posix.basename(b.path) === "README.md" ? 1 : 0)).slice(0, 12);
  const warnings: string[] = [], blockers: string[] = [];
  if (tree.some(t => t.mode === "120000" || t.mode === "160000")) blockers.push("Repository enthält Symlinks oder Submodule; automatische Ausführung im Prototyp gesperrt.");
  if (requestedRoot === undefined && !roots.includes("") && roots.length > 1) blockers.push("Mehrere App-Verzeichnisse: zuerst eines auswählen und erneut prüfen.");
  const files: Record<string, string> = {};
  await mapLimit(selected, 3, async entry => {
    if ((entry.size ?? 0) > 80_000) { blockers.push(`${entry.path}: Datei überschreitet das Analyse-Limit.`); return; }
    const raw = `https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${commit.sha}/${entry.path.split("/").map(encodeURIComponent).join("/")}`;
    files[entry.path] = (await getPublic(raw, { maxBytes: 80_000 })).body.toString("utf8");
  });
  const app = inferApp(files, root);
  const configName = app.strategy === "compose" ? ["compose.yaml", "compose.yml", "docker-compose.yml", "docker-compose.yaml"].find(n => files[root ? root + "/" + n : n]) : app.strategy === "dockerfile" ? "Dockerfile" : undefined;
  const configFile = configName ? (root ? root + "/" + configName : configName) : undefined;
  let env = configFile && app.strategy === "compose" ? extractEnv(files[configFile]!, configFile) : [];
  if (configFile && app.strategy === "compose") { const review = reviewCompose(files[configFile]!, configFile); env = review.env; blockers.push(...review.blockers); warnings.push(...review.warnings); }
  for (const [path, text] of Object.entries(files)) if (/\.env\.(example|sample)$/.test(path)) {
    for (const match of text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) if (!env.some(v => v.name === match[1])) env.push({ name: match[1]!, required: false, source: `${path} (Bedarf ungeprüft)` });
  }
  env = env.filter(e => e.required || !["PORT", "NODE_ENV"].includes(e.name));
  if (env.filter(e => e.required).length > 40) blockers.push("Mehr als 40 erforderliche Variablen: automatische Konfiguration nicht unterstützt.");
  env = env.sort((a, b) => Number(b.required) - Number(a.required)).slice(0, 40);
  const license = meta.license?.spdx_id ?? "Unbekannt";
  if (meta.archived) blockers.push("Repository ist archiviert; keine automatische Startfreigabe.");
  if (license === "Unbekannt" || license === "NOASSERTION") warnings.push("Lizenz nicht eindeutig erkannt. Nutzung und Weitergabe am Original prüfen.");
  if (app.strategy === "unsupported") blockers.push("Kein unterstützter automatischer Startweg erkannt. CLI, Bibliothek und Desktop-App erfordern andere Adapter.");
  warnings.push("Statische Analyse: Funktionsumfang, Sicherheitsrisiken und kostenlose Zusatzdienste sind nicht vollständig geprüft.");
  if (app.strategy === "railpack") warnings.push("Port ist eine Framework-Annahme. Die Railpack-Planung läuft im Linux-Container; Buildzeit-Secrets werden noch nicht unterstützt.");
  if (roots.length > 1) warnings.push("Weitere App-Verzeichnisse sind vorhanden. Ein einzelner Build startet nicht automatisch das gesamte Monorepo.");
  const result: Analysis = {
    id: randomUUID(), createdAt: new Date().toISOString(), repository, commit: commit.sha,
    root, roots, name: meta.full_name, description: meta.description ?? "", ...app,
    language: app.language === "Unbekannt" ? meta.language ?? app.language : app.language,
    configFile, env, license, archived: meta.archived, updatedAt: meta.pushed_at, openIssues: meta.open_issues_count,
    warnings, blockers, files,
    evidence: [
      { label: "Repository und Lizenzangabe", url: repository.url, text: `Lizenzangabe von GitHub: ${license}. Offene Issues inklusive Pull Requests: ${meta.open_issues_count}.`, checkedAt: new Date().toISOString() },
      ...selected.map(file => ({ label: file.path, url: `${repository.url}/blob/${commit.sha}/${file.path}`, text: "Statisch gelesen; keine Projektskripte ausgeführt.", checkedAt: new Date().toISOString() })),
    ],
  };
  let release: GitHubRelease | undefined;
  const releaseId = repository.owner.toLowerCase() + "/" + repository.repo.toLowerCase();
  const previousRelease = read<{ id: string; at: number; release: GitHubRelease }>("release", releaseId);
  try {
    release = previousRelease && Date.now() - previousRelease.at < 3600_000 ? previousRelease.release : await getJSON<GitHubRelease>(api + "/releases/latest");
    if (release !== previousRelease?.release) save("release", { id: releaseId, at: Date.now(), release });
    result.releaseNote = `Neuester stabiler Release ${release.tag_name}, veröffentlicht ${release.published_at}. Release-Dateien sind getrennt vom geprüften Quellcode-Commit zu betrachten. Keine Signatur-/Installationsprüfung durchgeführt.`;
  } catch (e) { result.releaseNote = `Release-Prüfung ohne vollständiges Ergebnis: ${(e as Error).message} Release-Seite manuell prüfen; keine EXE-Verfügbarkeit bestätigt.`; }
  result.installOptions = installationOptions(result, release);
  result.onlineOptions = hostingOptions(result, tree.map(e => e.path));
  return save("analysis", result);
}
export async function visibleWebsiteText(html: string): Promise<string> {
  let text = "";
  const clean = html.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  await new HTMLRewriter().on("body", { text(t) { text += t.text + " "; } }).transform(new Response(clean)).text();
  return text.replace(/\s+/g, " ").trim();
}
export async function inspectWebsite(url: string): Promise<{ url: string; title: string; evidence: { url: string; text: string }[]; warning: string }> {
  const page = await getPublic(url); let title = "", description = ""; const pricing: string[] = [];
  await new HTMLRewriter().on("title", { text(t) { title += t.text; } })
    .on('meta[name="description"]', { element(el) { description = el.getAttribute("content") ?? ""; } })
    .on("a[href]", { element(el) { try { const u = new URL(el.getAttribute("href")!, page.url); if (u.origin === new URL(page.url).origin && /pricing|plans|preise/i.test(u.pathname)) pricing.push(u.href); } catch { /* invalid link */ } } })
    .transform(new Response(page.body.toString("utf8"))).text();
  const evidence = [{ url: page.url, text: (title + " · " + description).slice(0, 1000) }];
  const mainText = await visibleWebsiteText(page.body.toString("utf8"));
  evidence.push({ url: page.url, text: mainText.slice(0, 4500) });
  if (pricing[0]) {
    try {
      const text = await visibleWebsiteText((await getPublic(pricing[0])).body.toString("utf8"));
      const windows = [...text.matchAll(/(?:free|gratis|trial|credit card|kreditkarte|\$\s*\d|€\s*\d)/gi)].slice(0, 8).map(m => text.slice(Math.max(0, m.index! - 100), m.index! + 350));
      evidence.push({ url: pricing[0], text: (windows.length ? [...new Set(windows)].join("\n") : text).slice(0, 4500) });
    } catch { evidence.push({ url: pricing[0], text: "Tarifseite gefunden, aber nicht auslesbar." }); }
  }
  return { url: page.url, title: title.trim(), evidence, warning: "Originalseite gelesen. Preistext ist ein Prüfhinweis; Gratis-Funktionsumfang, Anmeldung, Datenschutz und Laufzeit sind noch nicht bestätigt." };
}
