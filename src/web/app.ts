import type { Analysis, Candidate, CandidateReview, Coverage, Favorite, InstallOption, ModelProfile, ModelReport, OnlineOption, Project, SearchResult, Source } from "../types";
import { onlineAPI, onlineExport } from "./online-api";
import { usageChoice, type AlternativeReport } from "../usage-guide";
import { buildAgentPackage } from "../agent-package";
import { setupExperience } from "./experience";
import {setupDashboard,renderDashboard} from './dashboard';
import {setupCompanion,shareAnalysis} from "./companion";
import {applicationPath} from './paths';
import {readiness,shareableDiagnostics,type DiagnosticReport} from '../readiness';
const onlineEdition = document.body.dataset.mode === "online";
if (onlineEdition) document.getElementById("edition-location")!.textContent = "In deinem Browser";
type PublicAnalysis = Omit<Analysis, "files">;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const motionBehavior = (): ScrollBehavior => matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node;
};
function link(text: string, url: string): HTMLAnchorElement {
  const a = el("a", text); a.href = url.startsWith('/')&&!url.startsWith('//')?applicationPath(url):url; a.target = "_blank"; a.rel = "noopener noreferrer"; return a;
}
function error(e: unknown): void { $("notice").textContent = e instanceof Error ? e.message : String(e); $("notice").hidden = false; }
async function api<T>(path: string, body?: unknown): Promise<T> {
  if (onlineEdition) return onlineAPI<T>(path, body);
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error((data.error ?? "Anfrage fehlgeschlagen.") + (data.help ? "\n" + data.help : "")); return data as T;
}
function view(name: string): void {
  if (!document.getElementById("view-" + name)) return;
  document.body.dataset.view = name;
  for (const item of document.querySelectorAll<HTMLElement>(".view")) item.hidden = item.id !== "view-" + name;
  for (const nav of document.querySelectorAll<HTMLElement>(".nav")) { nav.classList.toggle("active", nav.dataset.view === name); if (nav.dataset.view === name) nav.setAttribute("aria-current", "page"); else nav.removeAttribute("aria-current"); }
  const label = document.querySelector<HTMLElement>(`.nav[data-view="${name}"] span`); $("current-view").textContent = label?.textContent ?? "aKlik-Deployer";
  $("notice").hidden = true;
  const heading = document.querySelector<HTMLElement>(`#view-${name} h1`);
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  window.scrollTo({ top: 0, behavior: "instant" });
  document.dispatchEvent(new window.Event("aklik-deployer:viewchange"));
  if (name === "projects") void refreshProjects().catch(error);
  if (name === "library") void refreshLibrary().catch(error);
  if (name === "diagnostics") void refreshDiagnostics().catch(error);
  if (name === "models") void refreshModelProfiles().catch(error);
}
for (const nav of document.querySelectorAll<HTMLElement>(".nav")) nav.addEventListener("click", () => view(nav.dataset.view!));
for (const button of document.querySelectorAll<HTMLElement>("[data-example]")) button.addEventListener("click", () => { $<HTMLTextAreaElement>("search-input").value = button.dataset.example!; $<HTMLFormElement>("search-form").requestSubmit(); });
let sourceList: Source[] = [];
let saved: Favorite[] = [];
const selected = new Map<string, Candidate>();
const coverageLabels: Record<Coverage["status"], string> = { searched: "Durchsucht", cached: "Cache durchsucht", partial: "Auszug geprüft", reference: "Offene Recherchequelle", failed: "Nicht geprüft" };
const statusLabels: Record<Project["status"], string> = { queued: "Wird vorbereitet", fetching: "Repository wird geladen", building: "Build läuft", checking: "Start wird geprüft", running: "Erreichbar / Healthcheck bestanden", started: "Gestartet · Funktion ungeprüft", stopped: "Gestoppt", failed: "Fehlgeschlagen" };
function badge(text: string, color = ""): HTMLSpanElement { return el("span", text, "badge " + color); }
function callout(text: string, color = ""): HTMLDivElement { return el("div", text, "callout " + color); }
function renderSources(coverage?: Coverage[]): HTMLElement {
  const box = el("div");
  for (const source of [...sourceList, ...(coverage?.filter(c => !sourceList.some(s => s.id === c.id)).map(c => ({ id: c.id, name: c.name, url: c.url, purpose: c.detail })) ?? [])]) {
    const status = coverage?.find(c => c.id === source.id);
    const row = el("div", undefined, "source-row"), name = el("div"); name.append(link(source.name, source.url));
    const info = el("div");
    if (status) { info.append(badge(coverageLabels[status.status], ["searched", "cached"].includes(status.status) ? "green" : "amber")); info.append(el("p", `${status.detail} ${status.count} Einträge/Treffer. Stand: ${new Date(status.checkedAt).toLocaleString("de-DE")}`)); }
    else info.append(el("p", source.purpose));
    row.append(name, info); box.append(row);
  }
  return box;
}
function compare(candidates: Candidate[]): HTMLElement {
  const wrap = el("div", undefined, "scroll-x"), table = el("table", undefined, "compare-table");
  const header = el("tr"); for (const cell of ["Kandidat / Typ", "Merkmale: Hinweise und Lücken", "Kosten / Lizenz", "Nächster Schritt"]) header.append(el("th", cell));
  const thead = el("thead"); thead.append(header); const body = el("tbody");
  for (const candidate of candidates.slice(0, 4)) {
    const row = el("tr");
    for (const text of [candidate.name + " · " + (candidate.fit?.type ?? "Typ ungeprüft"), candidate.fit?.checks.length ? candidate.fit.checks.map(c => `${c.requirement}: ${c.status === "hint" ? "Texthinweis" : c.status === "conflict" ? "Gegenhinweis" : "offen"}`).join(" · ") : candidate.reasons.slice(0, 3).join(" · ") || "Eingegebener Kandidat", candidate.license ? `${candidate.license}; Pflichtdienste ungeprüft` : "Kataloghinweis; Anbieterbedingungen offen", candidate.kind === "repository" ? "Repo und Startweg prüfen" : "Originalangebot prüfen"]) row.append(el("td", text));
    body.append(row);
  }
  table.append(thead, body); wrap.append(table); return wrap;
}
function refreshComparison(): void {
  for (const node of document.querySelectorAll<HTMLElement>(".comparison-area")) {
    node.replaceChildren(); if (!selected.size) continue;
    const heading = el("div", undefined, "section-head"), clear = el("button", "Vergleich leeren", "secondary");
    clear.addEventListener("click", () => { selected.clear(); refreshComparison(); for (const c of document.querySelectorAll<HTMLInputElement>(".compare-check")) c.checked = false; });
    heading.append(el("h3", `${selected.size} Kandidaten im Vergleich`), clear); node.append(heading, compare([...selected.values()]));
  }
}
function renderReview(result: CandidateReview): HTMLElement {
  const output = el("div", undefined, "inspect-output");
  output.append(el("h3", result.title), el("p", `Prüfstand: ${new Date(result.checkedAt).toLocaleString("de-DE")}${result.cached ? " · aus Cache" : ""}. Lizenz: ${result.license ?? "offen"}${result.updated ? "; Code-Aktivität: " + new Date(result.updated).toLocaleDateString("de-DE") : ""}.`));
  for (const check of result.checks) output.append(callout(`${check.requirement}: ${check.status === "hint" ? "Texthinweis · praktisch ungeprüft" : check.status === "conflict" ? "Möglicher Gegenhinweis" : "Offen · kein Beleg im gelesenen Text"}${check.excerpt ? "\n" + check.excerpt : ""}`, check.status === "hint" ? "" : "warn"));
  for (const item of result.evidence) output.append(link(item.label, item.url), el("p", item.text));
  for (const note of result.cautions) output.append(el("p", note, "subline"));
  return output;
}
function candidateCard(candidate: Candidate, searchId: string, index?: number): HTMLElement {
  const card = el("article", undefined, "candidate"), top = el("div", undefined, "candidate-top");
  top.append(el("span", index === undefined ? "Merkliste" : `Treffer ${index + 1}`, "candidate-rank"), badge(candidate.fit?.type ?? (candidate.kind === "repository" ? "Repository" : "Online-Angebot")));
  card.append(top, el("h3", candidate.name), el("p", candidate.description.slice(0, 420), "candidate-description"));
  const facts = el("div", undefined, "candidate-facts");
  if (candidate.license) facts.append(el("span", candidate.license + (candidate.licenseSource ? " · " + candidate.licenseSource : "")));
  if (candidate.stars !== undefined) facts.append(el("span", `${candidate.stars.toLocaleString("de-DE")} Sterne`));
  if (candidate.updated) facts.append(el("span", "Code-Aktivität: " + new Date(candidate.updated).toLocaleDateString("de-DE")));
  facts.append(el("span", candidate.sources.map(s => sourceList.find(x => x.id === s)?.name ?? (s === "web" ? "Websuche" : s === "input" ? "Deine Eingabe" : s)).join(" · "))); card.append(facts);
  card.append(el("p", "Zusatzdienste und vollständiger Gratis-/Funktionsumfang ungeprüft.", "subline"));
  if (candidate.fit?.total) {
    const details = el("details"); details.append(el("summary", `${candidate.fit.hints}/${candidate.fit.total} Wunschmerkmale mit Texthinweis`));
    for (const check of candidate.fit.checks) details.append(el("p", `${check.requirement}: ${check.status === "hint" ? "Hinweis" : check.status === "conflict" ? "Gegenhinweis" : "offen"}${check.excerpt ? " · " + check.excerpt : ""}`)); card.append(details);
  }
  if (candidate.fit?.cautions.length) card.append(el("p", candidate.fit.cautions.join(" · "), "subline"));
  const controls = el("div", undefined, "candidate-controls"), compareLabel = el("label", undefined, "check-label"), check = el("input"); check.type = "checkbox"; check.className = "compare-check"; check.checked = selected.has(candidate.id);
  check.addEventListener("change", () => { if (check.checked && selected.size >= 4 && !selected.has(candidate.id)) { check.checked = false; error(new Error("Bis zu vier Kandidaten gleichzeitig vergleichen.")); return; } if (check.checked) selected.set(candidate.id, candidate); else selected.delete(candidate.id); refreshComparison(); });
  compareLabel.append(check, document.createTextNode(" Vergleichen"));
  const save = el("button", saved.some(f => f.candidate.id === candidate.id && !f.hidden) ? "Gemerkt" : "Merken", "secondary");
  save.addEventListener("click", async () => { save.disabled = true; try { const favorite = await api<Favorite>("/api/favorite", { searchId, candidateId: candidate.id }); saved = saved.filter(f => f.id !== favorite.id); saved.push(favorite); save.textContent = "Gemerkt"; } catch (e) { error(e); } finally { save.disabled = false; } });
  controls.append(compareLabel, save); card.append(controls);
  const actions = el("div", undefined, "candidate-actions"), review = el("button", "Belege prüfen", "secondary");
  review.addEventListener("click", async () => { review.disabled = true; review.textContent = "Quellen werden gelesen …"; try { const result = await api<CandidateReview>("/api/review", { searchId, candidateId: candidate.id }); card.querySelector(".inspect-output")?.remove(); card.append(renderReview(result)); } catch (e) { error(e); } finally { review.disabled = false; review.textContent = "Belege prüfen"; } }); actions.append(review);
  if (candidate.kind === "repository") { const start = el("button", "Startweg prüfen", "secondary"); start.addEventListener("click", () => { $<HTMLInputElement>("repo-url").value = candidate.url; view("analyze"); void runAnalysis(candidate.url); }); actions.append(start); }
  actions.append(link("Original ↗", candidate.url)); card.append(actions); return card;
}
function renderSearch(result: SearchResult): void {
  const box = $("search-results"); box.replaceChildren(); $("welcome").hidden = true;
  document.body.dataset.searchState = "results"; $("new-search").hidden = false;
  const resultTitle = el("h2", `${result.candidates.length} vorhandene Kandidaten`); resultTitle.tabIndex = -1;
  const heading = el("div", undefined, "section-head"); heading.append(resultTitle, el("small", "Keine bestätigte Gratis- oder Funktionszusage")); box.append(heading);
  const terms = el("div", undefined, "tags"); for (const term of result.profile.terms) terms.append(el("span", term, "tag")); box.append(terms, callout(result.recommendation));
  for (const note of result.profile.notes) box.append(el("p", note, "subline"));
  const toolbar = el("div", undefined, "result-toolbar"), filter = el("select"), sort = el("select"); filter.ariaLabel = "Trefferart filtern"; sort.ariaLabel = "Treffer sortieren";
  for (const [value, text] of [["all", "Alle Treffer"], ["repository", "Repositories"], ["online", "Online-Angebote"]]) { const o = el("option", text); o.value = value!; filter.append(o); }
  for (const [value, text] of [["relevance", "Nach Suchpassung"], ["stars", "Nach GitHub-Sternen"], ["updated", "Nach Code-Aktivität"]]) { const o = el("option", text); o.value = value!; sort.append(o); }
  toolbar.append(filter, sort);
  for (const [format, text] of [["md", "Als Markdown exportieren"], ["json", "Als JSON exportieren"]]) { const a = el("a", text, "export-link"); a.href = `/api/export?id=${encodeURIComponent(result.id)}&format=${format}`; a.download = ""; if (onlineEdition) a.addEventListener("click", event => { event.preventDefault(); onlineExport(result, format!); }); toolbar.append(a); }
  box.append(toolbar);
  const comparison = el("div", undefined, "comparison-area"); box.append(comparison);
  const grid = el("div", undefined, "result-grid");
  const more = el("details"), moreGrid = el("div", undefined, "result-grid");
  more.append(el("summary", `${Math.max(0, result.candidates.length - 6)} weitere Kandidaten ansehen`), moreGrid);
  function draw(): void {
    grid.replaceChildren(); moreGrid.replaceChildren();
    const items = result.candidates.filter(c => filter.value === "all" || c.kind === filter.value).sort((a, b) => sort.value === "stars" ? (b.stars ?? -1) - (a.stars ?? -1) : sort.value === "updated" ? (Date.parse(b.updated ?? "") || 0) - (Date.parse(a.updated ?? "") || 0) : b.score - a.score);
    items.forEach((c, index) => (index < 6 ? grid : moreGrid).append(candidateCard(c, result.id, index)));
    if (!items.length) grid.append(el("p", "Keine Treffer dieser Art. Filter ändern.", "empty"));
    more.hidden = items.length <= 6; more.querySelector("summary")!.textContent = `${Math.max(0, items.length - 6)} weitere Kandidaten ansehen`;
  }
  filter.addEventListener("change", draw); sort.addEventListener("change", draw); draw(); box.append(grid, more); refreshComparison();
  const details = el("details"), summary = el("summary", "Suchabdeckung und offene Quellen ansehen"); details.append(summary, renderSources(result.coverage)); box.append(details);
  if (result.coverage.some(s => s.status === "failed" || s.status === "reference" || s.status === "partial")) box.append(callout("Die Suche ist begrenzt. Einige Quellen liefern nur Auszüge oder müssen über den verlinkten Originalzugang weiter geprüft werden. Aus fehlenden Treffern folgt kein Neubau-Auftrag.", "warn"));
  resultTitle.focus({ preventScroll: true });
}
$("search-form").addEventListener("submit", async event => {
  event.preventDefault(); $("notice").hidden = true; $("search-progress").hidden = false; $<HTMLButtonElement>("search-submit").disabled = true;
  $<HTMLButtonElement>("new-search").disabled = true;
  $("search-results").setAttribute("aria-busy", "true");
  try { renderSearch(await api<SearchResult>("/api/search", { input: $<HTMLTextAreaElement>("search-input").value, localPreferred: $<HTMLInputElement>("prefer-local").checked, openSourceOnly: $<HTMLInputElement>("only-oss").checked, options: { requirements: $<HTMLInputElement>("requirements").value.split(",").map(s => s.trim()).filter(Boolean), excluded: $<HTMLInputElement>("excluded").value.split(",").map(s => s.trim()).filter(Boolean), target: $<HTMLSelectElement>("target").value } })); }
  catch (e) { error(e); } finally { $("search-progress").hidden = true; $("search-results").setAttribute("aria-busy", "false"); $<HTMLButtonElement>("search-submit").disabled = false; $<HTMLButtonElement>("new-search").disabled = false; }
});
async function runAnalysis(url: string, root?: string, mode: "local" | "online" = "local"): Promise<void> {
  const progress = mode === "online" ? "online-progress" : "analysis-progress", submit = mode === "online" ? "online-submit" : "analyze-submit";
  $(progress).hidden = false; $<HTMLButtonElement>(submit).disabled = true; $("notice").hidden = true;
  try { const analysis = await api<PublicAnalysis>("/api/analyze", { url, ...(root === undefined ? {} : { root }) }); shareAnalysis(analysis); if (mode === "online") renderOnlineAnalysis(analysis); else renderAnalysis(analysis); const state=await api<{analyses:PublicAnalysis[]}>('/api/state');renderDashboard(state.analyses,a=>{view('analyze');renderAnalysis(a);}); }
  catch (e) { error(e); } finally { $(progress).hidden = true; $<HTMLButtonElement>(submit).disabled = false; }
}
$("analyze-form").addEventListener("submit", async event => { event.preventDefault(); await runAnalysis($<HTMLInputElement>("repo-url").value); });
$("online-form").addEventListener("submit", async event => { event.preventDefault(); await runAnalysis($<HTMLInputElement>("online-repo-url").value, undefined, "online"); });
$("model-form").addEventListener("submit", async event => {
  event.preventDefault(); $("model-progress").hidden = false; $<HTMLButtonElement>("model-submit").disabled = true; $("notice").hidden = true;
  try { renderModel(await api<ModelReport>("/api/model/check", { url: $<HTMLInputElement>("model-url").value })); } catch (e) { error(e); } finally { $("model-progress").hidden = true; $<HTMLButtonElement>("model-submit").disabled = false; }
});
function promptPanel(profile: ModelProfile): HTMLElement {
  const box = el("details"); box.append(el("summary", `${profile.name} · ${profile.agent}`), el("p", profile.purpose, "subline"));
  const area = el("textarea"); area.rows = 12; area.readOnly = true; area.value = profile.prompt; area.className = "setup-prompt"; area.ariaLabel = "Einrichtungsprompt für " + profile.modelId;
  const copy = el("button", "Prompt kopieren", "secondary"), download = el("button", "Als Text herunterladen", "secondary"), message = el("span", "", "subline"); message.setAttribute("role", "status");
  copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(profile.prompt); message.textContent = "Prompt kopiert."; } catch { area.focus(); area.select(); message.textContent = "Text markiert. Mit Strg+C kopieren."; } });
  download.addEventListener("click", () => { const url = URL.createObjectURL(new Blob([profile.prompt], { type: "text/plain;charset=utf-8" })), a = el("a"); a.href = url; a.download = "aklik-deployer-modell-einrichtung.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000); });
  box.append(area, copy, download, message); return box;
}
async function refreshModelProfiles(): Promise<void> {
  const state = await api<{ modelProfiles: ModelProfile[]; modelReports: ModelReport[] }>("/api/state"), box = $("model-profile-list"); box.replaceChildren();
  for (const profile of state.modelProfiles ?? []) box.append(promptPanel(profile));
  if (!state.modelProfiles?.length) box.append(el("p", "Noch kein Modellvorschlag gespeichert.", "subline"));
  if (state.modelReports?.length) { const details = el("details"); details.append(el("summary", "Letzte Modellprüfungen öffnen")); for (const report of state.modelReports) { const button = el("button", report.modelId, "secondary"); button.addEventListener("click", () => { $<HTMLInputElement>("model-url").value = report.inputUrl; renderModel(report); }); details.append(button); } box.append(details); }
}
function renderModel(report: ModelReport): void {
  const box = $("model-result"); box.replaceChildren(el("h2", report.modelId), el("p", `${report.task} · Lizenzangabe: ${report.license} · Zugang: ${report.gated === false ? "öffentlich laut Metadaten" : report.gated === "unknown" ? "ungeprüft" : "Freigabe/Lizenzannahme prüfen"} · ${new Date(report.checkedAt).toLocaleString("de-DE")}`, "subline"));
  box.append(callout(report.recommendation));
  for (const provider of report.providers) { const card = el("article", undefined, "panel install-option"); card.append(el("h3", provider.name), badge(provider.state === "live" ? "Vom Anbieter-Mapping als live gemeldet" : "Im Modellkatalog gelistet", provider.state === "live" ? "green" : "amber"), el("p", `Modellkennung: ${provider.model} · Aufgabe: ${provider.task}`), el("p", `Tool-Aufrufe: ${provider.tools === undefined ? "ungeprüft" : provider.tools ? "laut Katalog unterstützt; praktisch ungeprüft" : "nicht im Katalog ausgewiesen"}`), callout(provider.pricing, "warn"), link("Anbieter / Bedingungen prüfen ↗", provider.docs)); box.append(card); }
  if (!report.providers.length) box.append(callout("In den geprüften Metadaten kein Cloud-Anbieter belegt. Dies bedeutet nicht, dass das Modell nirgendwo online nutzbar ist.", "warn"));
  if (report.source === "pirateface") box.append(callout("Pirate Face: Download/P2P und ZK Inference unterscheiden. ZK Inference ist ein Guthaben-Angebot über OpenRouter. Dieses konkrete Modell wurde dort nicht per API getestet.", "warn"), link("Pirate Face ZK Inference ansehen ↗", "https://pirateface.co/inference"));
  if (report.ggufFiles.length) box.append(bulletList("GGUF-Dateien gefunden · mögliche eigene Laufzeit separat prüfen", report.ggufFiles), el("p", "GGUF ist ein Dateiformat, keine Cloud-API. Hardwarebedarf und Kompatibilität sind hier nicht geprüft.", "subline"));
  const chat = report.providers.filter(p => p.task === "conversational" && p.endpoint);
  if (chat.length) {
    const form = el("form", undefined, "panel setup-form"), providerLabel = el("label", "Cloud-Zugang auswählen", "env-field"), provider = el("select");
    for (const p of chat) { const o = el("option", `${p.name} · ${p.model}`); o.value = p.id; provider.append(o); } providerLabel.append(provider);
    const modeLabel = el("label", "Wie möchtest du das Modell verwenden?", "env-field"), mode = el("select"); for (const [value, text] of [["model", "Zusätzliches Modell in der Modellauswahl"], ["profile", "Separates Aufgabenprofil"]]) { const o = el("option", text); o.value = value!; mode.append(o); } modeLabel.append(mode);
    const agentLabel = el("label", "Ziel-Agent", "env-field"), agent = el("select"); for (const name of ["KI-Agent", "Hermes Agent", "OpenCode"]) { const o = el("option", name); o.value = name; agent.append(o); } agentLabel.append(agent);
    const purposeLabel = el("label", "Wofür möchtest du es nutzen?", "env-field"), purpose = el("input"); purpose.type = "text"; purpose.maxLength = 300; purpose.placeholder = "z. B. Recherche, Programmieren oder Zusammenfassen"; purposeLabel.append(purpose);
    form.append(el("h3", "Einrichtung für deinen Agenten vorbereiten"), providerLabel, modeLabel, agentLabel, purposeLabel, callout("Modellauswahl: zusätzliche auswählbare Modellkennung. Profil: eigene Aufgabeneinstellungen, falls der Agent das unterstützt. Der Prompt lässt die tatsächliche Konfiguration prüfen. Hier werden keine Agent-Dateien geändert und keine Schlüssel abgefragt.", "warn"));
    const submit = el("button", "Einrichtungsprompt erzeugen & Vorschlag speichern", "primary"); submit.type = "submit"; form.append(submit);
    const packageButton = el("button", "Modell + OpenCode als Laptop-Startpaket herunterladen", "secondary"); packageButton.type = "button";
    packageButton.addEventListener("click", () => { try { const bytes = buildAgentPackage(report, provider.value), url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" })), a = el("a"); a.href = url; a.download = "aklik-deployer-modell-agent-windows.zip"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000); } catch (e) { error(e); } });
    form.append(el("h3", "Eigenen Laptop-Agenten mit diesem Modell starten"), el("p", "Startpaket für Windows 11 x64 / ARM64: entpacken und START-AGENT.cmd öffnen. Es lädt die geprüfte OpenCode-Version und öffnet eine lokale Browseroberfläche. Das gewählte Modell läuft weiterhin beim Cloud-Anbieter. Ein eigener Paketordner entspricht einem getrennten Aufgabenprofil."), packageButton, el("p", "Du brauchst einen Anbieterschlüssel und geklärte Kosten. Schlüssel erst beim Start lokal eingeben. Werkzeug-Kompatibilität bleibt modellabhängig. Keine Modellanfrage beim Download.", "subline"), link("OpenCode: Funktionsweise und Anbieter ↗", "https://opencode.ai/docs/providers/"));
    form.addEventListener("submit", async e => { e.preventDefault(); submit.disabled = true; try { const profile = await api<ModelProfile>("/api/model/profile", { reportId: report.id, providerId: provider.value, mode: mode.value, agent: agent.value, purpose: purpose.value }); const output = promptPanel(profile); (output as HTMLDetailsElement).open = true; box.append(output); await refreshModelProfiles(); } catch (errorValue) { error(errorValue); } finally { submit.disabled = false; } }); box.append(form);
  }
  const details = el("details"); details.append(el("summary", "Prüfgrenzen und Quellen")); for (const note of report.notes) details.append(el("p", note)); for (const source of report.evidence) details.append(link(source.label, source.url), el("p", source.text)); box.append(details);
}
function bulletList(title: string, items: string[]): HTMLElement { const box = el("div"); box.append(el("h4", title)); const list = el("ul"); for (const item of items) list.append(el("li", item)); box.append(list); return box; }
function installOption(option: InstallOption): HTMLElement {
  const card = el("article", undefined, "install-option panel"), head = el("div", undefined, "section-head"); head.append(el("h3", option.title), badge(option.status === "available" ? option.recommended ? "Empfohlener Startpunkt" : "Gefunden / Startplan" : option.status === "conditional" ? "Voraussetzungen prüfen" : "Nicht belegt", option.status === "available" ? "green" : "amber"));
  card.append(head, el("p", option.description), bulletList("Vorteile", option.advantages), bulletList("Grenzen", option.limitations), bulletList("Voraussetzungen", option.prerequisites));
  for (const asset of option.assets ?? []) { const row = el("div", undefined, "download-row"); row.append(link(asset.name, asset.url), el("small", `${asset.architecture} · ${(asset.size / 1048576).toFixed(1)} MB · Original-Download`)); card.append(row); }
  for (const item of option.links) card.append(link(item.label + " ↗", item.url));
  if (option.id === "docker" && option.status === "available" && !onlineEdition) { const button = el("button", "Zum Docker-Startplan", "secondary"); button.addEventListener("click", () => document.getElementById("docker-start-plan")?.scrollIntoView({ behavior: motionBehavior(), block: "start" })); card.append(button); }
  return card;
}
const alternativeRequests = new Map<string, Promise<AlternativeReport>>();
function alternativePanel(analysis: PublicAnalysis, automatic = false): HTMLElement {
  const panel = el("section", undefined, "panel alternatives"), form = el("form", undefined, "setup-form"), label = el("label", "Was soll die Alternative können?", "env-field"), purpose = el("input");
  purpose.type = "text"; purpose.maxLength = 300; purpose.value = analysis.description.slice(0, 300); purpose.placeholder = "z. B. Diagramme im Browser zeichnen"; label.append(purpose);
  const submit = el("button", "Online-Alternativen suchen", "secondary"); submit.type = "submit";
  const output = el("div"); output.setAttribute("aria-live", "polite");
  panel.append(el("h3", "Kostenlos im Browser: vergleichbare Werkzeuge"), el("p", "Ein möglicher Hosting-Plan bestätigt noch keinen vollständigen Gratisbetrieb. Deshalb suchen wir direkt auch nach bereits verfügbaren Browser-Alternativen. Du kannst den gewünschten Zweck präzisieren."), form, output); form.append(label, submit);
  let generation = 0;
  const run = async () => {
    const current = ++generation; submit.disabled = true; output.replaceChildren(callout("Suche in GitHub und den verfügbaren Katalogen läuft …"));
    const key = analysis.id + "|" + purpose.value.trim();
    let pending = alternativeRequests.get(key);
    if (!pending) { pending = api<AlternativeReport>("/api/alternatives", { analysisId: analysis.id, purpose: purpose.value.trim() }); alternativeRequests.set(key, pending); pending.catch(() => alternativeRequests.delete(key)); if (alternativeRequests.size > 20) alternativeRequests.delete(alternativeRequests.keys().next().value!); }
    try {
      const result = await pending; if (generation !== current) return; output.replaceChildren();
      for (const item of result.ready) {
        const card = el("article", undefined, "install-option"); card.append(el("h4", item.name), badge("Vorhandene Browser-App · laut Originalbeschreibung", "green"), el("p", item.features), el("p", item.cost), el("p", "Warum vorgeschlagen: passender Texthinweis „" + item.matched + "“."), el("p", `Unterschied zu ${analysis.name}: ${item.difference}`), el("p", `Ausgangsprojekt: ${analysis.projectType}. ${analysis.description.slice(0, 220)}`, "subline"), link("Jetzt im Browser verwenden ↗", item.url), link("Beleg und Bedingungen ↗", item.source), el("p", "Quellenstand " + item.checkedAt + "; vollständige Funktionsgleichheit ungeprüft.", "subline")); output.append(card);
      }
      for (const note of result.notes) output.append(callout(note, "warn"));
      if (result.candidates.length) { const details = el("details"); details.append(el("summary", "Weitere aktuelle Suchtreffer · Gratis-Online-Nutzung noch prüfen")); for (const candidate of result.candidates) details.append(candidateCard(candidate, result.searchId!)); output.append(details); }
      const coverage = el("details"); coverage.append(el("summary", "Suchanfrage und Quellenabdeckung"), el("p", result.query), renderSources(result.coverage)); output.append(coverage);
    } catch (e) { if (generation === current) { output.replaceChildren(callout((e as Error).message, "error")); } }
    finally { if (generation === current) submit.disabled = false; }
  };
  form.addEventListener("submit", e => { e.preventDefault(); void run(); });
  if (automatic) void run();
  return panel;
}
function simpleUsage(analysis: PublicAnalysis, mode: "local" | "online"): HTMLElement {
  const panel = el("section", undefined, "panel simple-usage"), button = el("button", "Egal wo und wie – ich will es einfach nutzen", "primary"), output = el("div"); output.hidden = true;
  button.type = "button"; button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    button.setAttribute("aria-expanded", "true"); output.hidden = false; if (output.childElementCount) { output.scrollIntoView({ behavior: motionBehavior(), block: "nearest" }); return; }
    const choice = usageChoice(analysis, onlineEdition); output.append(el("h3", "Mein Vorschlag für dich"), el("p", choice.reason));
    if (choice.url) output.append(link(choice.title + " ↗", choice.url));
    else {
      const next = el("button", choice.title, "secondary"); next.type = "button";
      next.addEventListener("click", () => {
        if (choice.kind === "docker") { if (mode === "online") { $<HTMLInputElement>("repo-url").value = analysis.repository.url; view("analyze"); renderAnalysis(analysis); } document.getElementById("docker-start-plan")?.scrollIntoView({ behavior: motionBehavior(), block: "start" }); }
        else if (choice.kind === "hosting") { if (mode !== "online") { $<HTMLInputElement>("online-repo-url").value = analysis.repository.url; view("online"); renderOnlineAnalysis(analysis); } document.querySelector("#online-result .online-hosting-option")?.scrollIntoView({ behavior: motionBehavior(), block: "start" }); }
        else { next.disabled = true; output.append(alternativePanel(analysis, true)); }
      }); output.append(next);
    }
    if (onlineEdition && choice.kind !== "browser" && choice.kind !== "download") output.append(el("p", "Möchtest du eine lokale Installation ausführen, lade den aKlik-Deployer für deinen PC herunter und öffne START-AKLIK-DEPLOYER.cmd.", "subline"), link("aKlik-Deployer für den PC herunterladen", "/aklik-deployer-local.zip"));
  });
  panel.append(el("h3", "Du musst die Technik nicht auswählen"), el("p", "Wir wählen aus der Analyse den einfachsten belegten nächsten Schritt."), button, output); return panel;
}
function renderOnlineAnalysis(analysis: PublicAnalysis): void {
  const box = $("online-result"); box.replaceChildren(el("h2", analysis.name), el("p", `${analysis.projectType} · ${analysis.framework} · Commit ${analysis.commit.slice(0,12)}`, "subline"));
  box.append(simpleUsage(analysis, "online"));
  box.append(callout("Dies ist eine Hosting-Eignungsprüfung. Es wurde noch keine App bei einem Anbieter veröffentlicht. „Kandidat“ bedeutet: passend erscheinender Weg, mit noch zu prüfenden Voraussetzungen und Free-Limits.", "warn"));
  if (analysis.roots.length > 1) { const label = el("label", "App-Verzeichnis auswählen", "env-field"), select = el("select"); for (const root of analysis.roots) { const o = el("option", root || "/ (Wurzel)"); o.value = root; o.selected = root === analysis.root; select.append(o); } select.addEventListener("change", () => { void runAnalysis(analysis.repository.url, select.value, "online"); }); label.append(select); box.append(label); }
  const options = analysis.onlineOptions ?? [];
  if (usageChoice(analysis, true).kind !== "browser") box.append(alternativePanel(analysis, true));
  if (!options.length) box.append(callout("Diese ältere Analyse enthält noch keinen Hosting-Vergleich. Repository erneut prüfen.", "warn"));
  for (const option of [...options].sort((a,b) => Number(b.status === "candidate") - Number(a.status === "candidate"))) {
    const card = el("article", undefined, "install-option panel online-hosting-option"), head = el("div", undefined, "section-head"); head.append(el("h3", option.title), badge(option.status === "candidate" ? "Möglicher Free-Weg" : "Eignung nicht belegt", option.status === "candidate" ? "green" : "amber")); card.append(head, el("p", option.description), bulletList("Vorteile", option.advantages), bulletList("Grenzen und mögliche Folgekosten", option.limitations), bulletList("So gehst du vor", option.steps), link("Offizielle Anleitung und aktuelle Bedingungen ↗", option.docs), el("p", "Anbieterhinweise geprüft am " + option.checkedAt, "subline")); box.append(card);
  }
  const local = el("button", "Stattdessen auf meinem Computer installieren", "secondary"); local.addEventListener("click", () => { $<HTMLInputElement>("repo-url").value = analysis.repository.url; view("analyze"); renderAnalysis(analysis); }); box.append(local);
}
function renderAnalysis(analysis: PublicAnalysis): void {
  const box = $("analysis-result"); box.replaceChildren();
  const heading = el("div", undefined, "section-head"); heading.append(el("h2", analysis.name), badge(analysis.blockers.length ? "Angaben / anderer Startweg nötig" : "Startplan vorhanden", analysis.blockers.length ? "amber" : "green")); box.append(heading);
  box.append(el("p", analysis.description, "subline"));
  box.append(simpleUsage(analysis, "local"));
  box.append(el("h2", "Installationsmöglichkeiten"));
  if (analysis.releaseNote) box.append(el("p", analysis.releaseNote, "subline"));
  if (analysis.installOptions?.length) {
    const unavailable = el("details"); unavailable.append(el("summary", "Weitere Wege ohne bestätigten Download ansehen"));
    for (const option of analysis.installOptions) { if (option.status === "unavailable") unavailable.append(installOption(option)); else box.append(installOption(option)); }
    box.append(unavailable);
  } else box.append(callout("Ältere Analyse ohne Release-Vergleich. Für Windows-Downloads das Repository erneut prüfen.", "warn"));
  const online = el("button", "GitHub Repository kostenlos online verwendbar machen", "secondary"); online.addEventListener("click", () => { $<HTMLInputElement>("online-repo-url").value = analysis.repository.url; view("online"); renderOnlineAnalysis(analysis); }); box.append(online);
  const panel = el("section", undefined, "panel"), facts = el("div", undefined, "facts-grid");
  panel.id = "docker-start-plan"; panel.append(el("h2", "Technischer Docker-Startplan"));
  for (const [label, value] of [["Projekttyp", analysis.projectType], ["Framework", analysis.framework], ["Startweg", analysis.strategy], ["Lizenzangabe", analysis.license], ["App-Verzeichnis", analysis.root || "/"], ["Prüfstand", analysis.commit.slice(0, 12)]]) { const cell = el("div", undefined, "fact"); cell.append(el("small", label), el("strong", value)); facts.append(cell); } panel.append(facts);
  if (analysis.roots.length > 1) {
    const label = el("label", "App-Verzeichnis auswählen", "env-field"), select = el("select");
    for (const root of analysis.roots) { const option = el("option", root || "/ (Wurzel)"); option.value = root; option.selected = root === analysis.root; select.append(option); }
    select.addEventListener("change", () => { void runAnalysis(analysis.repository.url, select.value); }); label.append(select); panel.append(label);
  }
  for (const blocker of analysis.blockers) panel.append(callout(blocker, "error"));
  const warnings = el("details"), summary = el("summary", `${analysis.warnings.length} Hinweise und Grenzen`), list = el("ul"); for (const warning of analysis.warnings) list.append(el("li", warning)); warnings.append(summary, list); panel.append(warnings);
  const proof = el("details"); proof.append(el("summary", "Dateiquellen und erkannte Befehle"));
  for (const [kind, value] of Object.entries(analysis.commands)) proof.append(el("p", `${kind}: ${value}`, "subline"));
  for (const item of analysis.evidence) { const a = link(item.label, item.url); a.className = "proof-link"; proof.append(a); }
  proof.append(link("Repository in DeepWiki ansehen ↗", `https://deepwiki.com/${analysis.repository.owner}/${analysis.repository.repo}`)); panel.append(proof);
  if (onlineEdition) { panel.append(callout("Die Online-Version startet keine Prozesse auf deinem PC. Öffne die lokale Version und prüfe dort dasselbe Repository erneut."), link("Lokalen aKlik-Deployer herunterladen", "/aklik-deployer-local.zip")); }
  if (analysis.strategy !== "unsupported" && !onlineEdition) {
    const form = el("form", undefined, "start-form"), portLabel = el("label", "Port innerhalb des Containers (erkannter Wert oder Annahme)"), port = el("input");
    port.type = "number"; port.min = "1"; port.max = "65535"; port.value = String(analysis.ports[0] ?? 3000); port.required = true; port.id = "container-port"; portLabel.htmlFor = port.id;
    form.append(portLabel, port);
    const inputs: { name: string; input: HTMLInputElement }[] = [];
    if (analysis.env.length) form.append(el("h3", "Projektangaben"));
    for (const env of analysis.env) {
      const label = el("label", env.name + (env.required ? " · erforderlich" : " · Hinweis aus Vorlage"), "env-field"), input = el("input"); input.type = "password"; input.autocomplete = "off"; input.required = env.required; input.name = env.name; input.placeholder = env.required ? "Wert erforderlich" : "Leer lassen, wenn nicht benötigt"; label.append(input, el("small", env.source)); inputs.push({ name: env.name, input }); form.append(label);
    }
    form.append(callout("„In Docker starten“ führt den Code dieses Projekts aus. Werte werden nicht in der aKlik-Deployer-Datenbank gespeichert; die gestartete App erhält die angegebenen Werte. Daten und Container bleiben bis zum gezielten Stoppen bestehen.", "warn"));
    const button = el("button", "In Docker starten ↗", "primary"); button.type = "submit"; button.disabled = analysis.blockers.length > 0; form.append(button);
    form.addEventListener("submit", async event => {
      event.preventDefault(); button.disabled = true;
      try {
        await api<Project>("/api/start", { analysisId: analysis.id, port: Number(port.value), env: Object.fromEntries(inputs.map(i => [i.name, i.input.value])) });
        for (const { input } of inputs) input.value = ""; view("projects");
      } catch (e) { error(e); } finally { button.disabled = analysis.blockers.length > 0; }
    }); panel.append(form);
  }
  box.append(panel);
}
let activeLogs: string | undefined;
let lastProjects = "";
async function showLogs(id: string): Promise<void> {
  activeLogs = id; const data = await api<{ project: Project; logs: string }>("/api/project/" + id);
  $("logs-panel").hidden = false; $("logs-title").textContent = data.project.name; $("project-logs").textContent = data.logs || "Noch keine Logs vorhanden.";
}
async function refreshProjects(): Promise<void> {
  const state = await api<{ projects: Project[] }>("/api/state"), box = $("project-list");
  const signature = JSON.stringify(state.projects);
  if (signature === lastProjects) return;
  lastProjects = signature; box.replaceChildren();
  if (!state.projects.length) box.append(el("div", "Hier erscheinen deine gestarteten Projekte. Prüfe zuerst ein Repository.", "empty"));
  for (const project of state.projects) {
    const card = el("article", undefined, "project-card"), heading = el("div", undefined, "section-head");
    heading.append(el("h3", project.name), badge(statusLabels[project.status], project.status === "running" ? "green" : project.status === "failed" ? "red" : "amber"));
    card.append(heading, el("p", `${project.strategy} · Commit ${project.commit.slice(0, 12)} · ${new Date(project.createdAt).toLocaleString("de-DE")}`, "subline"));
    const last = project.logs.at(-1); if (last) card.append(el("p", last.slice(0, 320), "subline"));
    if (project.error) card.append(callout(project.error, "error"));
    const actions = el("div", undefined, "actions"), logs = el("button", "Logs ansehen", "secondary"); logs.addEventListener("click", () => { void showLogs(project.id).catch(error); }); actions.append(logs);
    if (["running", "started", "stopped", "failed"].includes(project.status)) { const check = el("button", "Erreichbarkeit prüfen", "secondary"); check.addEventListener("click", async () => { check.disabled = true; try { await api("/api/project/check", { id: project.id }); await refreshProjects(); } catch (e) { error(e); } finally { check.disabled = false; } }); actions.append(check); }
    if (["running", "started", "stopped", "failed"].includes(project.status)) {
      const stop = el("button", "Stoppen", "secondary"); stop.disabled = project.status === "stopped"; stop.addEventListener("click", async () => { stop.disabled = true; try { await api("/api/stop", { id: project.id }); await refreshProjects(); } catch (e) { error(e); stop.disabled = false; } }); actions.append(stop);
    }
    if (project.status === "stopped") {
      const restart = el("button", "Wieder starten", "secondary"); restart.addEventListener("click", async () => { restart.disabled = true; try { await api("/api/restart", { id: project.id }); await refreshProjects(); } catch (e) { error(e); restart.disabled = false; } }); actions.append(restart);
    }
    if (project.url && ["running", "started"].includes(project.status)) actions.append(link("Lokal öffnen ↗", project.url)); card.append(actions); box.append(card);
  }
}
$("refresh-projects").addEventListener("click", () => { void refreshProjects().catch(error); });
$("close-logs").addEventListener("click", () => { activeLogs = undefined; $("logs-panel").hidden = true; });
setInterval(() => { if (!$("view-projects").hidden) { void refreshProjects().catch(error); if (activeLogs) void showLogs(activeLogs).catch(error); } }, 3500);
function openSearch(previous: SearchResult): void {
  $<HTMLTextAreaElement>("search-input").value = previous.profile.original;
  $<HTMLInputElement>("requirements").value = (previous.profile.requirements ?? []).join(", ");
  $<HTMLInputElement>("excluded").value = (previous.profile.excluded ?? []).join(", ");
  $<HTMLSelectElement>("target").value = previous.profile.target ?? "any";
  $<HTMLInputElement>("prefer-local").checked = previous.profile.localPreferred;
  $<HTMLInputElement>("only-oss").checked = previous.profile.openSourceOnly;
  view("discover"); renderSearch(previous);
}
async function refreshLibrary(): Promise<void> {
  const state = await api<{ favorites: Favorite[]; searches: SearchResult[] }>("/api/state"); saved = state.favorites;
  const box = $("favorite-list"), grid = el("div", undefined, "result-grid"); box.replaceChildren();
  if (!saved.some(f => !f.hidden)) box.append(el("p", "Noch keine Kandidaten gemerkt. Unter Entdecken bei einem Treffer „Merken“ wählen.", "empty"));
  for (const favorite of saved.filter(f => !f.hidden)) {
    const card = candidateCard(favorite.candidate, favorite.searchId), label = el("label", "Deine Notiz", "env-field"), notes = el("textarea"); notes.rows = 2; notes.maxLength = 2000; notes.value = favorite.notes; notes.placeholder = "Zum Beispiel: Für mein Projekt genauer prüfen"; label.append(notes);
    const actions = el("div", undefined, "actions"), saveNote = el("button", "Notiz speichern", "secondary"), archive = el("button", "Archivieren", "secondary"), message = el("span", "", "subline"); message.setAttribute("role", "status");
    saveNote.addEventListener("click", async () => { saveNote.disabled = true; try { await api("/api/favorite/update", { id: favorite.id, notes: notes.value }); message.textContent = "Notiz gespeichert."; } catch (e) { error(e); } finally { saveNote.disabled = false; } });
    archive.addEventListener("click", async () => { archive.disabled = true; try { await api("/api/favorite/update", { id: favorite.id, hidden: true, notes: notes.value }); await refreshLibrary(); } catch (e) { error(e); archive.disabled = false; } });
    actions.append(saveNote, archive, message); card.append(label, actions); grid.append(card);
  }
  box.append(grid);
  const hidden = saved.filter(f => f.hidden);
  if (hidden.length) { const details = el("details"); details.append(el("summary", `${hidden.length} archivierte Merkeinträge wiederherstellen`)); for (const favorite of hidden) { const row = el("div", undefined, "history-row"), restore = el("button", "Wiederherstellen", "secondary"); restore.addEventListener("click", async () => { try { await api("/api/favorite/update", { id: favorite.id, hidden: false }); await refreshLibrary(); } catch (e) { error(e); } }); row.append(el("span", favorite.candidate.name), restore); details.append(row); } box.append(details); }
  const history = $("research-history"); history.replaceChildren();
  for (const previous of state.searches) { const row = el("div", undefined, "history-row"), open = el("button", "Recherche öffnen", "secondary"); open.addEventListener("click", () => openSearch(previous)); row.append(el("span", `${previous.profile.title} · ${new Date(previous.createdAt).toLocaleString("de-DE")} · ${previous.candidates.length} Treffer`), open); history.append(row); }
  if (!state.searches.length) history.append(el("p", "Noch keine Recherche vorhanden.", "subline")); refreshComparison();
}
async function refreshDiagnostics(): Promise<void> {
  const button=$<HTMLButtonElement>('refresh-diagnostics'),download=$<HTMLButtonElement>('download-diagnostics');
  button.disabled=true;download.disabled=true;diagnosticReport=undefined;
  $('diagnostic-readiness').replaceChildren();$('diagnostic-list').textContent='Voraussetzungen werden geprüft …';
  try {
    const data=await api<DiagnosticReport>('/api/diagnostics');diagnosticReport=data;
    const ready=$('diagnostic-readiness');ready.append(el('h2','Was kannst du jetzt nutzen?'));
    for(const item of readiness(data)){const row=el('div',undefined,'diagnostic-row');row.append(badge(item.status==='ready'?'Verfügbar':'Einrichtung nötig',item.status==='ready'?'green':'amber'),el('strong',item.name),el('p',item.detail));ready.append(row);}
    const box=$('diagnostic-list');box.replaceChildren(el('h2','Prüfergebnisse'),el('p','Prüfstand: '+new Date(data.checkedAt).toLocaleString('de-DE'),'subline'));
    for(const check of data.checks){const row=el('div',undefined,'diagnostic-row');row.append(badge(check.status==='ok'?'Bereit':'Hinweis',check.status==='ok'?'green':'amber'),el('strong',check.name),el('p',check.detail));if(check.action)row.append(callout(check.action,'warn'));box.append(row);}
    download.disabled=false;
  }catch(e){$('diagnostic-list').textContent='Prüfung nicht abgeschlossen. Bitte erneut versuchen.';throw e;}
  finally{button.disabled=false;}
}
let diagnosticReport:DiagnosticReport|undefined;
$('download-diagnostics').addEventListener('click',()=>{
  if(!diagnosticReport)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(shareableDiagnostics(diagnosticReport),null,2)],{type:'application/json'}));
  const a=el('a');a.href=url;a.download='aklik-deployer-pruefbericht.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
$("refresh-diagnostics").addEventListener("click", () => { void refreshDiagnostics().catch(error); });
async function init(): Promise<void> {
  if (onlineEdition) { $("online-edition").hidden = false; }
  const state = await api<{ sources: Source[]; searches: SearchResult[]; favorites: Favorite[]; analyses: PublicAnalysis[] }>("/api/state"); sourceList = state.sources; saved = state.favorites; $("source-list").replaceChildren(renderSources());
  renderDashboard(state.analyses,a=>{view('analyze');renderAnalysis(a);});
  if (state.searches.length) {
    const history = el("div", undefined, "history");
    const seen = new Set<string>();
    const unique = state.searches.filter(s => {
      if (seen.has(s.profile.original)) return false;
      seen.add(s.profile.original); return true;
    });
    for (const previous of unique.slice(0, 4)) { const button = el("button", previous.profile.title, "secondary"); button.addEventListener("click", () => openSearch(previous)); history.append(button); }
    $("search-results").append(el("p", "Zuletzt recherchiert", "subline"), history);
  }
  if (state.analyses.length) { const box = $("recent-analyses"), details = el("details"); details.append(el("summary", "Letzte Repository-Prüfungen öffnen")); for (const analysis of state.analyses) { const button = el("button", `${analysis.name} · ${analysis.commit.slice(0, 8)}`, "secondary"); button.addEventListener("click", () => { $<HTMLInputElement>("repo-url").value = analysis.repository.url; renderAnalysis(analysis); }); details.append(button); } box.append(details); }
  try { const tools = await api<{ docker: boolean; detail: string; railpack: boolean }>("/api/tools"); const badge = $("docker-status"); badge.textContent = onlineEdition ? "● Online · Recherche & Planung" : tools.docker ? "● Docker bereit" : "Docker nicht erreichbar"; badge.className = "badge " + (onlineEdition || tools.docker ? "green" : "amber"); badge.title = tools.detail; }
  catch { $("docker-status").textContent = "Docker-Status ungeprüft"; }
}
setupExperience(view, () => { $<HTMLInputElement>("repo-url").value = "https://github.com/jgraph/drawio-desktop"; void runAnalysis("https://github.com/jgraph/drawio-desktop"); });
setupDashboard(view,runAnalysis);
void init().then(()=>setupCompanion(view,url=>runAnalysis(url),url=>{ $<HTMLTextAreaElement>("search-input").value=url; $("search-input").focus(); })).catch(error);
