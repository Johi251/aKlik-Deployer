import { join } from "node:path";
import { DATA } from "../src/store";
import type { CandidateReview, SearchResult } from "../src/types";

const base = "http://127.0.0.1:43110", page = await fetch(base), cookie = page.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Lokalen aKlik-Deployer zuerst starten.");
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(base + path, { method: "POST", headers: { cookie: cookie!, Origin: base, "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text()); return await response.json() as T;
}
const search = await post<SearchResult>("/api/search", { input: "Docker für Lesezeichen Verwaltung", localPreferred: true, options: { requirements: ["Docker", "Import", "Export", "Deutsch"], excluded: ["WordPress"], target: "selfhosted" } });
const candidate = search.candidates.find(c => c.url.includes("sissbruecker/linkding"));
if (!candidate?.fit || search.profile.githubQuery !== "bookmark" || candidate.fit.total !== 4) throw new Error("Bedarfsprofil oder bekannter Kandidat fehlt.");
const review = await post<CandidateReview>("/api/review", { searchId: search.id, candidateId: candidate.id });
if (!review.readmeSha || review.checks.length !== 4 || !review.checks.some(c => c.requirement === "Docker" && c.status === "hint")) throw new Error("README-/Merkmalsbeleg fehlt.");
for (const format of ["md", "json"]) {
  const response = await fetch(`${base}/api/export?id=${search.id}&format=${format}`, { headers: { cookie } });
  const text = await response.text();
  if (!response.ok || !response.headers.get("content-disposition")?.includes("attachment") || !text.includes(review.readmeSha.slice(0, 12))) throw new Error("Export enthält den Prüfbeleg nicht.");
}
const diagnosticResponse = await fetch(base + "/api/diagnostics", { headers: { cookie } });
const diagnostics = await diagnosticResponse.json() as { checks: { name: string; status: string }[] };
if (!diagnosticResponse.ok || !diagnostics.checks.some(c => c.name === "Docker" && c.status === "ok")) throw new Error("Lokale Docker-Diagnose fehlt.");
const result = { checkedAt: new Date().toISOString(), status: "passed", searchId: search.id, candidate: candidate.url, candidateCount: search.candidates.length, sourceChecks: search.coverage.length, primaryQuery: search.profile.githubQuery, review: { readmeSha: review.readmeSha, checks: review.checks, license: review.license, updated: review.updated, cached: review.cached ?? false }, exports: ["md", "json"], diagnostics: diagnostics.checks };
await Bun.write(join(DATA, "verification/research-v02.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, searchId: search.id, candidates: result.candidateCount, readme: review.readmeSha, checks: review.checks.map(c => [c.requirement, c.status]), exports: result.exports }, null, 2));
