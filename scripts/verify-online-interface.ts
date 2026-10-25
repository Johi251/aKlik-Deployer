import { Window, HTMLElement } from "happy-dom";
import { resolve } from "node:path";

// Execute the actual deployed bundle with the actual built HTML in a DOM runtime.
// This is integration evidence, not a browser rendering or pixel comparison.
const dist = resolve(import.meta.dir, "../sites/aklik-deployer-online/dist");
const window = new Window({ url: "https://aklik-deployer.example/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
const originals = new Map<string, PropertyDescriptor | undefined>();
const intervals: ReturnType<typeof setInterval>[] = [];
const startInterval = globalThis.setInterval;
try {
  const html = await Bun.file(resolve(dist, "index.html")).text();
  window.document.write(html);
  if (window.document.body.dataset.mode !== "online") throw new Error("Online-Modus fehlt im Hosting-Build.");
  const requests: string[] = [];
  const fetch = async (url: string) => { requests.push(String(url)); throw new Error("Unerwarteter Netzwerkaufruf beim Start."); };
  const trackedInterval = (callback: () => void, delay: number) => { const id = startInterval(callback, delay); intervals.push(id); return id; };
  for (const [name, value] of Object.entries({ window, document: window.document, navigator: window.navigator, localStorage: window.localStorage, matchMedia: window.matchMedia.bind(window), requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window), fetch, setInterval: trackedInterval })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  new Function(await Bun.file(resolve(dist, "app.js")).text())();
  for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0));
  const get = (id: string) => window.document.getElementById(id)! as HTMLElement;
  if (get("notice").textContent) throw new Error("Online-Initialisierung meldet Fehler: " + get("notice").textContent);
  if (get("online-edition").hidden || get("edition-location").textContent !== "In deinem Browser") throw new Error("Falscher Laufzeit-Hinweis.");
  if (window.document.querySelectorAll("#source-list .source-row").length < 10) throw new Error("Suchquellen wurden nicht initialisiert.");
  if (!["true", "false"].includes(get("hero-scroll").dataset.enhanced ?? "") || window.document.querySelectorAll("[data-journey-scene]").length !== 4) throw new Error("Scroll-Geschichte im Online-Bundle nicht initialisiert.");
  if (get("view-home").hidden || window.document.body.dataset.view !== "home") throw new Error("Hero-Startseite fehlt.");
  if (!["true", "false"].includes(get("hero-scroll").dataset.enhanced ?? "")) throw new Error("Hero nicht initialisiert.");
  (window.document.querySelector('.landing-header [data-open-view="models"]') as any).click();
  if (get("view-models").hidden || !get("view-discover").hidden) throw new Error("Online-Navigation fehlgeschlagen.");
  get("menu-toggle").click();
  window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  if (get("menu-toggle").getAttribute("aria-expanded") !== "false") throw new Error("Menü schließt nicht.");
  for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0));
  if (get("notice").textContent) throw new Error("Online-Bedienung meldet Fehler: " + get("notice").textContent);
  const proof = { checkedAt: new Date().toISOString(), passed: true, actualHostedHtmlAndBundle: true, sources: window.document.querySelectorAll("#source-list .source-row").length, initialNetworkRequests: requests, navigation: true, menuEscape: true, heroInitialized: true, storyInitialized: true, storyScenes: 4, browserRendering: false };
  await Bun.write(resolve(import.meta.dir, "../.data/verification/online-interface-v09.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
} finally {
  for (const id of intervals) clearInterval(id);
  await window.happyDOM.abort(); window.close();
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as any)[name]; }
}
