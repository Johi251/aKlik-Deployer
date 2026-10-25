import { join } from "node:path";
import { DATA } from "../src/store";
import { onlineAPI } from "../src/web/online-api";
import { usageChoice, type AlternativeReport } from "../src/usage-guide";
import type { Analysis, ModelReport } from "../src/types";
import { buildAgentPackage } from "../src/agent-package";
import { unzipSync } from "fflate";

const base = "http://127.0.0.1:43110", page = await fetch(base), cookie = page.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Lokale App zuerst starten.");
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(base + path, { method: "POST", headers: { cookie: cookie!, Origin: base, "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text()); return await response.json() as T;
}
const analysis = await post<Omit<Analysis, "files">>("/api/analyze", { url: "https://github.com/jgraph/drawio-desktop" });
const alternatives = await post<AlternativeReport>("/api/alternatives", { analysisId: analysis.id });
if (!alternatives.ready.some(t => t.name === "draw.io") || alternatives.candidates.some(c => c.url.toLowerCase() === analysis.repository.url.toLowerCase()) || !alternatives.coverage.some(c => ["searched", "cached", "partial"].includes(c.status))) throw new Error("Alternativen oder echte Suchabdeckung fehlen.");
const report = await post<ModelReport>("/api/model/check", { url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct" });
const provider = report.providers.find(p => p.endpoint && p.task === "conversational");
if (!provider) throw new Error("Kein gemeldeter Chat-Anbieter in echten Modellmetadaten.");
const files = unzipSync(buildAgentPackage(report, provider.id));
if (!files["START-AGENT.cmd"] || !files["opencode.json"]) throw new Error("Downloadpaket unvollständig.");
// Exercise the same browser adapter with isolated in-memory storage. No UI claim.
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) } });
const onlineAnalysis = await onlineAPI<Omit<Analysis, "files">>("/api/analyze", { url: analysis.repository.url });
const onlineAlternatives = await onlineAPI<AlternativeReport>("/api/alternatives", { analysisId: onlineAnalysis.id });
if (!onlineAlternatives.ready.some(t => t.name === "draw.io") || !onlineAlternatives.coverage.some(c => c.status === "searched")) throw new Error("Online-Adapter liefert keine belegte Alternative/Suchabdeckung.");
const foreign = await fetch(base + "/api/alternatives", { method: "POST", headers: { cookie, Origin: "https://example.com", "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: JSON.stringify({ analysisId: analysis.id }) });
if (foreign.status !== 403) throw new Error("Fremde Website darf lokale Alternativsuche nicht auslösen.");
const proof = { checkedAt: new Date().toISOString(), status: "passed", local: { repository: analysis.repository.url, simpleChoice: usageChoice(analysis, false), alternatives: alternatives.ready.map(a => ({ name: a.name, url: a.url, difference: a.difference })), searchQuery: alternatives.query, sourceCount: alternatives.coverage.length, searchCandidates: alternatives.candidates.length }, onlineAdapter: { alternatives: onlineAlternatives.ready.map(a => a.name), sourceCount: onlineAlternatives.coverage.length, noDockerAccess: true, uiClickTested: false }, model: { model: report.modelId, provider: provider.id, zipEntries: Object.keys(files), noInferenceCall: true }, foreignOriginBlocked: true };
await Bun.write(join(DATA, "verification/usage-v04.json"), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
