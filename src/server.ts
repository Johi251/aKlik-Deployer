import { randomBytes, timingSafeEqual } from "node:crypto";
import {APP_VERSION} from './version';
import {createBridge} from './bridge';
import { motionStyleHash } from "./motion-policy";
import { search } from "./search";
import { analyze, inspectWebsite } from "./analyze";
import { sources } from "./sources";
import { list, read, save } from "./store";
import { getJSON } from "./network";
import { inspectModel, modelSetupProfile } from "./model-planner";
import { findAlternatives } from "./usage-guide";
import { exportResearch, favorites, reviewCandidate, reviewsFor, saveFavorite, updateFavorite } from "./research";
import { diagnostics, explainError } from "./diagnostics";
import { checkProject, projectLogs, reconcileInterrupted, restartProject, startProject, stopProject, toolsStatus } from "./runtime";
import type { Analysis, ModelProfile, ModelReport, Project, SearchResult } from "./types";

export function publicAnalysis(analysis: Analysis): Omit<Analysis, "files"> {
  const { files: _files, ...rest } = analysis; return rest;
}
export function authorized(request: Request, session: string, port: number): boolean {
  if (!["127.0.0.1:" + port, "localhost:" + port].includes(request.headers.get("host") ?? "")) return false;
  const cookie = /(?:^|;\s*)oc_session=([a-f0-9]+)/.exec(request.headers.get("cookie") ?? "")?.[1] ?? "";
  if (cookie.length !== session.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(session))) return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== `http://${request.headers.get("host")}`) return false;
  if (request.method !== "GET" && (!origin || request.headers.get("x-aklik-deployer") !== "1" || !request.headers.get("content-type")?.startsWith("application/json"))) return false;
  return true;
}
export function createApp(port = 43110, embedded:Record<string,string>={}) {
  let bridge:ReturnType<typeof createBridge>|undefined;
  const session = randomBytes(32).toString("hex");
  let heavy = 0;
  const headers = {
    "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' ${motionStyleHash}; img-src 'self' data:; connect-src 'self' https://api.github.com https://huggingface.co https://api.microlink.io; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
  const server = Bun.serve({ hostname: "127.0.0.1", port, idleTimeout: 120, maxRequestBodySize: 128_000,
    async fetch(request):Promise<Response> {
      const url = new URL(request.url);
      const allowed = ["127.0.0.1:" + server.port, "localhost:" + server.port];
      if (!allowed.includes(request.headers.get("host") ?? "")) return json({ error: "Unzulässiger Host." }, 403);
      if(url.pathname.startsWith('/bridge/'))return (bridge??=createBridge(server.port!))(request);
      if (!url.pathname.startsWith("/api/")) {
        const asset = { "/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/workflow.js": "workflow.js", "/style.css": "style.css", "/landing.css": "landing.css", "/manifest.webmanifest": "manifest.webmanifest", "/sw.js": "sw.js", "/icon-192.png": "icon-192.png", "/icon-512.png": "icon-512.png", "/favicon.svg": "favicon.svg", "/fonts/ibm-plex-sans-latin.woff2": "fonts/ibm-plex-sans-latin.woff2", "/fonts/OFL.txt": "fonts/OFL.txt", "/fonts/manrope-latin.woff2": "fonts/manrope-latin.woff2", "/fonts/Manrope-OFL.txt": "fonts/Manrope-OFL.txt" }[url.pathname];
        const embeddedPath=embedded[url.pathname];
        const bookmarkAsset=/^\/bookmarks\/(?:index\.html|favicon\.svg|manifest\.webmanifest|sw\.js|icons\/[\w.-]+|assets\/[\w.-]+)$/.test(url.pathname)?url.pathname.slice("/bookmarks/".length):url.pathname==="/bookmarks/"?"index.html":undefined;
        const noticeAsset=url.pathname==="/licenses.txt"?"licenses.txt":undefined;
        if (request.method !== "GET" || (!asset && !embeddedPath && !bookmarkAsset && !noticeAsset)) return json({ error: "Nicht gefunden." }, 404);
        const file = Bun.file(embeddedPath ?? new URL(bookmarkAsset?"../integrations/bookmarks-manager/dist/"+bookmarkAsset:"../public/"+(asset??noticeAsset), import.meta.url));
        if (!await file.exists()) return json({ error: "Oberfläche fehlt. bun run build ausführen." }, 503);
        return new Response(file, { headers: { ...headers, ...(asset === "index.html" ? { "Set-Cookie": `oc_session=${session}; HttpOnly; SameSite=Strict; Path=/` } : {}) } });
      }
      if (!authorized(request, session, server.port!)) return json({ error: "Lokale Sitzung fehlt oder Anfrage kommt von einer fremden Seite. aKlik-Deployer neu öffnen." }, 403);
      try {
        if (request.method === "GET") {
          if (url.pathname === "/api/state") return json({ sources, searches: list<SearchResult>("search", 100).filter(s => !s.testOnly).slice(0, 20), favorites: favorites(true).filter(f => !f.testOnly), analyses: list<Analysis>("analysis", 40).filter(a => !a.testOnly).slice(0, 10).map(publicAnalysis), projects: list<Project>("project", 100).filter(p => !p.testOnly).slice(0, 20), modelReports: list<ModelReport>("model-report", 12), modelProfiles: list<ModelProfile>("model-profile", 30) });
          if (url.pathname === "/api/tools") return json(await toolsStatus());
          if (url.pathname === "/api/diagnostics") return json(await diagnostics());
          if (url.pathname === "/api/export") {
            const id = url.searchParams.get("id") ?? "", format = url.searchParams.get("format");
            if (!/^[a-f0-9-]{36}$/.test(id) || !["md", "json"].includes(format ?? "")) throw new Error("Ungültige Exportanfrage.");
            const result = read<SearchResult>("search", id); if (!result) return json({ error: "Recherche nicht gefunden." }, 404);
            const content = format === "md" ? exportResearch(result) : JSON.stringify({ ...result, reviews: reviewsFor(result), sourceRights: "Katalogtexte behalten ihre Quellenlizenzen. Siehe THIRD_PARTY_NOTICES.md; Awesome Selfhosted CC-BY-SA-3.0; Open SaaS Directory MIT." }, null, 2);
            return new Response(content, { headers: { ...headers, "Content-Type": format === "md" ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="aklik-deployer-recherche-${id.slice(0, 8)}.${format}"` } });
          }
          if (url.pathname.startsWith("/api/project/")) return json(await projectLogs(url.pathname.slice("/api/project/".length)));
          if (url.pathname === "/api/health") return json({ name: "aKlik-Deployer", version: APP_VERSION, status: "ok" });
        }
        if (request.method !== "POST") return json({ error: "Nicht gefunden." }, 404);
        const body = await request.json() as Record<string, unknown>;
        if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Ungültige Eingabe." }, 400);
        const string = (key: string, max = 3000) => { const v = body[key]; if (typeof v !== "string" || v.length > max) throw new Error("Ungültiges Eingabefeld: " + key); return v; };
        if (["/api/search", "/api/alternatives", "/api/analyze", "/api/website", "/api/review", "/api/model/check"].includes(url.pathname)) {
          if (heavy >= 2) return json({ error: "Zwei Prüfungen laufen bereits. Bitte kurz warten." }, 429);
          heavy++;
          try {
            if (url.pathname === "/api/search") return json(await search(string("input"), body.localPreferred !== false, body.openSourceOnly === true, body.options));
            if (url.pathname === "/api/alternatives") { const analysis = read<Analysis>("analysis", string("analysisId", 100)); if (!analysis) throw new Error("Analyse nicht gefunden. Repository erneut pruefen."); return json(await findAlternatives(analysis, body.purpose, search)); }
            if (url.pathname === "/api/review") return json(await reviewCandidate(string("searchId", 100), string("candidateId")));
            if (url.pathname === "/api/model/check") return json(save("model-report", await inspectModel(string("url", 1500), getJSON)));
            if (url.pathname === "/api/analyze") return json(publicAnalysis(await analyze(string("url"), body.root === undefined ? undefined : string("root", 220))));
            return json(await inspectWebsite(string("url")));
          } finally { heavy--; }
        }
        if (url.pathname === "/api/model/profile") { const report = read<ModelReport>("model-report", string("reportId", 100)); if (!report) throw new Error("Modellprüfung nicht gefunden."); return json(save("model-profile", modelSetupProfile(report, body))); }
        if (url.pathname === "/api/favorite") return json(saveFavorite(string("searchId", 100), string("candidateId")));
        if (url.pathname === "/api/favorite/update") return json(updateFavorite(string("id", 100), body.notes, body.hidden));
        if (url.pathname === "/api/start") return json(await startProject(string("analysisId", 100), body.env, Number(body.port)));
        if (url.pathname === "/api/stop") return json(await stopProject(string("id", 100)));
        if (url.pathname === "/api/restart") return json(await restartProject(string("id", 100)));
        if (url.pathname === "/api/project/check") return json(await checkProject(string("id", 100)));
        if (url.pathname === "/api/analysis") { const item = read<Analysis>("analysis", string("id", 100)); return item ? json(publicAnalysis(item)) : json({ error: "Analyse nicht gefunden." }, 404); }
        return json({ error: "Nicht gefunden." }, 404);
      } catch (e) { const message = (e as Error).message.slice(0, 3000); return json({ error: message, help: explainError(message) }, 400); }
    },
  });
  return server;
}
if (import.meta.main) {
  reconcileInterrupted();
  const port = Number(process.env.AKLIK_DEPLOYER_PORT ?? 43110);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Ungültiger lokaler Port.");
  const server = createApp(port);
  console.log(`aKlik-Deployer lokal geöffnet: http://127.0.0.1:${server.port}`);
  console.log("Nur lokaler Zugriff. Mit Strg+C beenden. Laufende Apps werden dabei nicht gestoppt.");
}
