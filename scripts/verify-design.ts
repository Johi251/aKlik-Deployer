import { createApp } from "../src/server";
import { resolve } from "node:path";

const server = createApp(0);
try {
  const base = `http://127.0.0.1:${server.port}`, page = await fetch(base), html = await page.text();
  const ids: string[] = [], labels: string[] = [];
  await new HTMLRewriter().on("[id]", { element(e) { ids.push(e.getAttribute("id")!); } }).on("label[for]", { element(e) { labels.push(e.getAttribute("for")!); } }).transform(new Response(html)).text();
  if (new Set(ids).size !== ids.length || labels.some(id => !ids.includes(id))) throw new Error("Doppelte IDs oder verwaiste Formularlabels.");
  const baselinePath = resolve(import.meta.dir, "../.data/design/before-ids.json");
  const baseline: string[] = await Bun.file(baselinePath).exists() ? await Bun.file(baselinePath).json() : ["search-form", "search-input", "repo-url", "online-repo-url", "model-url", "project-list", "favorite-list", "source-list", "diagnostic-list"];
  if (baseline.some(id => !ids.includes(id))) throw new Error("Bestehender Bedienweg fehlt: " + baseline.filter(id => !ids.includes(id)).join(", "));
  if (/\son\w+=|<style\b|style=/i.test(html)) throw new Error("Inline-Skript/-Style widerspricht der bestehenden CSP.");
  const assets: { path: string; status: number; type: string | null; bytes: number }[] = [];
  for (const path of ["/app.js", "/workflow.js", "/style.css", "/landing.css", "/favicon.svg", "/manifest.webmanifest", "/sw.js", "/icon-192.png", "/icon-512.png", "/fonts/ibm-plex-sans-latin.woff2", "/fonts/OFL.txt", "/fonts/manrope-latin.woff2", "/fonts/Manrope-OFL.txt"]) {
    const response = await fetch(base + path), bytes = (await response.arrayBuffer()).byteLength;
    if (!response.ok || bytes < 100) throw new Error("Statisches Asset fehlt: " + path);
    assets.push({ path, status: response.status, type: response.headers.get("content-type"), bytes });
  }
  if (assets.find(a => a.path.endsWith("woff2"))?.type !== "font/woff2") throw new Error("Schriftdatei wird nicht als WOFF2 ausgeliefert.");
  const css = await Bun.file(new URL("../public/style.css", import.meta.url)).text() + "\n" + await Bun.file(new URL("../public/landing.css", import.meta.url)).text();
  const styleBuild = await Bun.build({ entrypoints: [resolve(import.meta.dir, "../public/style.css"), resolve(import.meta.dir, "../public/landing.css")], target: "browser", external: ["/fonts/*"], minify: true });
  if (!styleBuild.success) throw new Error("CSS kann nicht verarbeitet werden: " + styleBuild.logs.map(l => l.message).join("; "));
  const componentStyles = [".inline-form", ".panel", ".progress", ".result-grid", ".candidate", ".compare-table", ".source-row", ".install-option", ".setup-form", ".simple-usage", ".discovery-layout", ".home-guide"];
  if (componentStyles.some(selector => !css.includes(selector + " {"))) throw new Error("Stilfamilie fehlt: " + componentStyles.filter(selector => !css.includes(selector + " {")).join(", "));
  const root = [...css.matchAll(/:root\s*\{([\s\S]*?)\}/g)].map(m=>m[1]).join("\n");
  const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const missing = [...css.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]!).filter(name => !declared.has(name));
  if (missing.length) throw new Error("Nicht deklarierte CSS-Token: " + [...new Set(missing)].join(", "));
  const colors = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(m => [m[1]!, m[2]!]));
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i]!, 0);
  const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const contrast = [["Fließtext", "ink", "paper"], ["Sekundärtext", "muted", "paper"], ["Platzhalter", "faint", "paper"], ["Link / primäre Aktion", "accent", "paper"], ["Navigation", "nav-text", "nav"], ["Navigation aktiv", "paper", "accent"], ["Story-Akzent", "story-accent", "nav"]].map(([name, fg, bg]) => ({ name, foreground: colors[fg!]!, background: colors[bg!]!, ratio: Number(ratio(colors[fg!]!, colors[bg!]!).toFixed(2)) }));
  if (contrast.some(c => c.ratio < 4.5)) throw new Error("Text-Kontrast unter 4,5:1.");
  if (!css.includes("prefers-reduced-motion") || /https?:\/\//.test(css)) throw new Error("Bewegungs-Fallback fehlt oder externe Schrift-/Styleanfrage vorhanden.");
  const cookie = page.headers.get("set-cookie")?.split(";")[0] ?? "";
  const health = await fetch(base + "/api/health", { headers: { cookie } }).then(r => r.json());
  const proof = { checkedAt: new Date().toISOString(), status: "passed", version: health.version, existingIdsPreserved: baseline.length, uniqueIds: ids.length, labels: labels.length, assets, contrast, cssParserValid: true, componentStylesPresent: componentStyles.length, undeclaredCssTokens: missing, inlineScriptsOrStyles: false, remoteFontRequests: false, browserVisualTest: false, browserBlocker: "Keine Browser-Tabs exponiert; natives Chrome-Fenster ist minimiert und kann über den aktuellen Adapter nicht gebunden werden", domFlowTests: "tests/interface.test.ts", motionImplementation: "Remotion Player frame seeking, four workflow scenes, responsive composition, HTML fallback, reduced-motion scene cuts" };
  await Bun.write(resolve(import.meta.dir, "../.data/verification/design-v09.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
} finally { server.stop(true); }
