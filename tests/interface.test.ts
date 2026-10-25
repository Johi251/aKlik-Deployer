import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Window, HTMLElement, HTMLInputElement, HTMLButtonElement, HTMLTextAreaElement, HTMLSelectElement } from "happy-dom";
import { sources } from "../src/sources";
import { inferApp } from "../src/repo-model";
import { installationOptions, hostingOptions } from "../src/repo-options";
import { buildModelReport } from "../src/model-planner";
import type { Analysis, SearchResult } from "../src/types";

// DOM integration tests run without a browser. They do not assert layout, pixels or scroll rendering.
const window = new Window({ url: "http://127.0.0.1:43110/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true, disableComputedStyleRendering: true } });
const document = window.document;
const originals = new Map<string, PropertyDescriptor | undefined>();
const calls: { path: string; body?: Record<string, any> }[] = [];
let searchFails = false;
const files = { "package.json": '{"dependencies":{"electron":"1"},"scripts":{"start":"electron ."}}' };
const analysis: Analysis = { id: "interface-analysis", createdAt: "2026-10-23", repository: { owner: "jgraph", repo: "drawio-desktop", url: "https://github.com/jgraph/drawio-desktop" }, commit: "a".repeat(40), root: "", roots: [""], name: "jgraph/drawio-desktop", description: "Official electron build of draw.io", ...inferApp(files, ""), env: [], license: "Apache-2.0", archived: false, updatedAt: "2026-10-23", openIssues: 0, warnings: [], blockers: [], evidence: [], files };
analysis.installOptions = installationOptions(analysis, { tag_name: "test", html_url: analysis.repository.url + "/releases", published_at: "2026-10-23", draft: false, prerelease: false, assets: [{ name: "drawio-x64.exe", browser_download_url: analysis.repository.url + "/releases/download/test/drawio-x64.exe", size: 100 }] });
analysis.onlineOptions = hostingOptions(analysis);
const candidate = { id: "interface-candidate", name: '<img src=x onerror="alert(1)">', description: "Untrusted source text", url: "https://github.com/jgraph/drawio", sources: ["github"], score: 10, reasons: [], kind: "repository" as const, cost: "oss" as const, evidence: [] };
const search: SearchResult = { id: "interface-search", createdAt: "2026-10-23", profile: { original: "PDF Werkzeuge", title: "PDF Werkzeuge", terms: ["pdf"], githubQuery: "pdf", localPreferred: false, openSourceOnly: false, notes: [] }, candidates: [candidate], coverage: [], recommendation: "Quellen und Bedingungen prüfen." };
const report = buildModelReport("https://huggingface.co/Qwen/Qwen2.5-7B-Instruct", { gated: false, inferenceProviderMapping: { test: { status: "live", providerId: "test", task: "conversational" } } });
let favorites: any[] = [];
function bind(name: string, value: unknown) { originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
const get = (id: string) => document.getElementById(id)! as HTMLElement;
const click = (selector: string) => { const button = document.querySelector<HTMLElement>(selector); if (!button) throw Error("Bedienelement fehlt: " + selector); button.click(); };
async function settle() { for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0)); }
beforeAll(async () => {
  document.write(await Bun.file(new URL("../public/index.html", import.meta.url)).text());
  for (const [name, value] of Object.entries({ window, document, navigator: window.navigator, innerHeight: 900, matchMedia: window.matchMedia.bind(window), requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window), addEventListener: window.addEventListener.bind(window), IntersectionObserver: window.IntersectionObserver })) bind(name, value);
  bind("fetch", async (path: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined; calls.push({ path, body });
    if (path === "/api/state") return Response.json({ sources, searches: [], favorites, analyses: [], projects: [], modelReports: [], modelProfiles: [] });
    if (path === "/api/tools") return Response.json({ docker: false, detail: "Testlauf", railpack: false });
    if (path === "/api/search") return searchFails ? Response.json({ error: "Suchquelle nicht erreichbar." }, { status: 503 }) : Response.json(search);
    if (path === "/api/analyze") return Response.json(analysis);
    if (path === "/api/alternatives") return Response.json({ analysisId: analysis.id, query: "diagram editor", checkedAt: "2026-10-23", ready: [{ name: "draw.io", url: "https://app.diagrams.net/", repository: "https://github.com/jgraph/drawio", features: "Diagramme im Browser", cost: "Laut Projekt kostenlos", difference: "Browser statt Desktop-Integration", source: "https://www.drawio.com/", matched: "draw.io", checkedAt: "2026-10-23" }], candidates: [], coverage: [], notes: ["Keine aktuelle Funktionsprüfung."] });
    if (path === "/api/model/check") return Response.json(report);
    if (path === "/api/favorite") { const f = { id: "f", searchId: search.id, candidate, notes: "", hidden: false, createdAt: "2026-10-23" }; favorites = [f]; return Response.json(f); }
    if (path === "/api/projects") return Response.json([]);
    throw Error("Unerwartete Testanfrage: " + path);
  });
  await import("../src/web/app"); await settle();
});
afterAll(async () => { await window.happyDOM.abort(); window.close(); for (const [name, value] of originals) { if (value) Object.defineProperty(globalThis, name, value); else delete (globalThis as any)[name]; } });
describe("Neue Oberfläche erhält die Bedienwege", () => {
  test("Die Hero-Eingabe startet die echte Werkzeugsuche", async () => { (get("hero-idea") as HTMLInputElement).value="Diagramme zeichnen"; get("hero-idea-form").dispatchEvent(new window.Event("submit",{cancelable:true})); await settle(); expect(get("view-discover").hidden).toBe(false); expect(calls.some(c=>c.path==="/api/search" && c.body?.input==="Diagramme zeichnen")).toBe(true); click('.nav[data-view="home"]'); });
  test("Hero-Beispiel startet die echte Analyse", async () => { click("#hero-inspect"); await settle(); expect(get("view-analyze").hidden).toBe(false); expect(calls.some(c => c.path === "/api/analyze")).toBe(true); click('.nav[data-view="home"]'); });
  test("Startansicht führt direkt zur Aufgabe und erklärt die Grenzen", () => { expect(get("view-home").hidden).toBe(false); expect(document.body.dataset.view).toBe("home"); click('.landing-header [data-open-view="discover"]'); expect(get("view-home").hidden).toBe(true); expect(get("view-discover").hidden).toBe(false); expect(get("search-form").getAttribute("id")).toBe("search-form"); expect(document.querySelector(".home-guide")?.textContent).toContain("nicht automatisch kostenlos"); expect(document.querySelectorAll("[aria-current=page]")).toHaveLength(1); });
  test("Navigation klappt auf und Escape setzt den Fokus zurück", () => { click("#menu-toggle"); expect(get("menu-toggle").getAttribute("aria-expanded")).toBe("true"); document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })); expect(get("menu-toggle").getAttribute("aria-expanded")).toBe("false"); expect(document.activeElement).toBe(get("menu-toggle")); });
  test("Geschichten-Link führt aus dem Werkzeugkasten zur sichtbaren Startseite", () => { click(".story-entry"); expect(get("view-home").hidden).toBe(false); expect(document.activeElement).toBe(get("journey-title")); click('.landing-header [data-open-view="discover"]'); });
  test("Suchkürzel führt zur Eingabe und greift nicht in Texteingaben ein", () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(get("search-input"));
    const typing = new window.KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    get("search-input").dispatchEvent(typing); expect(typing.defaultPrevented).toBe(false);
  });
  test("Schnelleinstieg öffnet den richtigen Arbeitsbereich mit Titel und Fokus", () => { click('.shortcut[data-open-view="models"]'); expect(get("view-models").hidden).toBe(false); expect(get("view-discover").hidden).toBe(true); expect(get("current-view").textContent).toBe("KI-Modell verbinden"); expect(document.activeElement?.tagName).toBe("H1"); expect(document.querySelector('.nav[data-view="models"]')?.getAttribute("aria-current")).toBe("page"); });
  test("Modellprüfung führt weiterhin zum Agenten-Download", async () => { (get("model-url") as HTMLInputElement).value = report.url; get("model-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await settle(); expect(get("model-result").textContent).toContain("Laptop-Startpaket herunterladen"); expect(get("model-result").querySelectorAll("select").length).toBeGreaterThan(0); });
  test("Das Beispiel öffnet die echte Repository-Analyse und Windows-Option", async () => { click('.nav[data-view="discover"]'); click("#story-try"); await settle(); expect((get("repo-url") as HTMLInputElement).value).toBe(analysis.repository.url); expect(calls.some(c => c.path === "/api/analyze" && c.body?.url === analysis.repository.url)).toBe(true); expect(get("analysis-result").textContent).toContain("EXE / MSI"); });
  test("Der Geschichten-Abschluss führt zur eigenen Eingabe oder echten Beispielanalyse", async () => {
    click('.nav[data-view="home"]'); click("#journey-start"); expect(document.activeElement).toBe(get("search-input"));
    const count = calls.filter(c => c.path === "/api/analyze").length;
    click('.nav[data-view="home"]'); click("#journey-inspect"); await settle(); expect(get("view-analyze").hidden).toBe(false);
    expect(calls.filter(c => c.path === "/api/analyze")).toHaveLength(count + 1); expect(get("analysis-result").textContent).toContain("EXE / MSI");
  });
  test("Einfach-nutzen führt nach der Analyse zum offiziellen Download", () => { const button = [...get("analysis-result").querySelectorAll("button")].find(b => b.textContent?.includes("Egal wo")); button!.click(); expect([...get("analysis-result").querySelectorAll("a")].some(a => a.textContent?.includes("Windows-Download") && a.href === analysis.repository.url + "/releases")).toBe(true); });
  test("Online-Analyse startet ihre Alternativsuche automatisch", async () => { click('.nav[data-view="online"]'); (get("online-repo-url") as HTMLInputElement).value = analysis.repository.url; get("online-form").dispatchEvent(new window.Event("submit", { cancelable: true })); await settle(); expect(calls.some(c => c.path === "/api/alternatives" && c.body?.analysisId === analysis.id)).toBe(true); expect(get("online-result").textContent).toContain("Browser statt Desktop-Integration"); const button = [...get("online-result").querySelectorAll("button")].find(b => b.textContent?.includes("Egal wo")); button!.click(); expect(get("online-result").textContent).toContain("Mein Vorschlag für dich"); });
  test("Suche erhält Filter und rendert Quelleninhalt als Text", async () => { click('.nav[data-view="discover"]'); (get("search-input") as HTMLTextAreaElement).value = "PDF Werkzeuge"; (get("requirements") as HTMLInputElement).value = "Import, Export"; (get("target") as HTMLSelectElement).value = "online"; get("search-form").dispatchEvent(new window.Event("submit", { cancelable: true })); await settle(); expect(calls.filter(c => c.path === "/api/search").at(-1)?.body?.options).toEqual({ requirements: ["Import", "Export"], excluded: [], target: "online" }); expect(get("search-results").textContent).toContain(candidate.name); expect(get("search-results").querySelector("img")).toBeNull(); expect(get("search-results").getAttribute("aria-busy")).toBe("false"); });
  test("Merken und die Merkliste bleiben vom Suchergebnis erreichbar", async () => { const save = [...get("search-results").querySelectorAll("button")].find(b => b.textContent?.includes("Merken")); save!.click(); await settle(); click('.nav[data-view="library"]'); await settle(); expect(get("favorite-list").textContent).toContain(candidate.name); expect(get("favorite-list").querySelector("textarea")).not.toBeNull(); });
  test("Neue Suche gibt den Einstieg frei und erhält Filter sowie Merkliste", () => {
    expect(document.body.dataset.searchState).toBe("results"); click("#new-search");
    expect(get("view-discover").hidden).toBe(false); expect(get("welcome").hidden).toBe(false);
    expect(get("search-results").children.length).toBe(0); expect(get("new-search").hidden).toBe(true);
    expect(document.activeElement).toBe(get("search-input")); expect((get("requirements") as HTMLInputElement).value).toBe("Import, Export"); expect(favorites).toHaveLength(1);
  });
  test("Strg+Enter sperrt Neue Suche bis zum Ende und setzt den Ergebnisfokus", async () => {
    get("search-input").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true })); await settle();
    const count = calls.filter(c => c.path === "/api/search").length;
    get("search-input").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
    expect((get("new-search") as HTMLButtonElement).disabled).toBe(true); click("#new-search");
    expect(get("welcome").hidden).toBe(true); await settle();
    expect(calls.filter(c => c.path === "/api/search")).toHaveLength(count + 1);
    expect(document.activeElement?.textContent).toBe("1 vorhandene Kandidaten"); expect(get("search-results").getAttribute("aria-busy")).toBe("false"); expect((get("new-search") as HTMLButtonElement).disabled).toBe(false);
  });
  test("Suchfehler zeigen eine Meldung und geben den Knopf wieder frei", async () => { click('.nav[data-view="discover"]'); searchFails = true; get("search-form").dispatchEvent(new window.Event("submit", { cancelable: true })); await settle(); expect(get("notice").hidden).toBe(false); expect(get("notice").textContent).toContain("Suchquelle nicht erreichbar"); expect((get("search-submit") as HTMLButtonElement).disabled).toBe(false); expect(get("search-results").getAttribute("aria-busy")).toBe("false"); });
});
