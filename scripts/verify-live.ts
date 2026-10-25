import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA } from "../src/store";
import type { Analysis, SearchResult } from "../src/types";

const base = "http://127.0.0.1:43110";
const page = await fetch(base), cookie = page.headers.get("set-cookie")?.split(";")[0];
if (!cookie || !page.ok) throw new Error("aKlik-Deployer muss bereits laufen (bun run start).");
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(base + path, { method: "POST", headers: { cookie: cookie!, Origin: base, "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(JSON.stringify(result)); return result as T;
}
const searched = await post<SearchResult>("/api/search", { input: "Lesezeichen-Verwaltung mit Docker", localPreferred: true });
if (!searched.candidates.some(c => c.url.toLowerCase().includes("sissbruecker/linkding"))) throw new Error("Bekannter vorhandener Kandidat wurde nicht gefunden.");
if (!searched.coverage.some(c => c.id === "web" && ["searched", "partial", "cached"].includes(c.status))) throw new Error("Seitenübergreifende Websuche liefert keinen Prüfstand.");
const analysis = await post<Analysis>("/api/analyze", { url: "https://github.com/docker/welcome-to-docker" });
if (analysis.strategy !== "dockerfile" || analysis.blockers.length || !/^[a-f0-9]{40}$/.test(analysis.commit)) throw new Error("Offizielles Docker-Beispiel wurde nicht startfähig erkannt.");
const evidence = { checkedAt: new Date().toISOString(), search: { id: searched.id, candidateCount: searched.candidates.length, knownCandidate: "sissbruecker/linkding", coverage: searched.coverage }, analysis: { id: analysis.id, repository: analysis.repository.url, commit: analysis.commit, strategy: analysis.strategy, ports: analysis.ports, blockers: analysis.blockers } };
await mkdir(join(DATA, "verification"), { recursive: true });
await Bun.write(join(DATA, "verification/live.json"), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ status: "passed", candidates: searched.candidates.length, sourceChecks: searched.coverage.length, analysisId: analysis.id, commit: analysis.commit }, null, 2));
