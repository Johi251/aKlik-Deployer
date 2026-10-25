import { describe, expect, test } from "bun:test";
import { unzipSync, strFromU8 } from "fflate";
import { inferApp } from "../src/repo-model";
import { installationOptions, hostingOptions } from "../src/repo-options";
import { alternativeQuery, findAlternatives, usageChoice } from "../src/usage-guide";
import { agentPackageFiles, buildAgentPackage } from "../src/agent-package";
import { buildModelReport } from "../src/model-planner";
import type { Analysis, SearchResult } from "../src/types";

function base(description = "A desktop flowchart editor"): Analysis {
  const files = { "package.json": '{"dependencies":{"electron":"1"},"scripts":{"start":"electron ."}}' };
  const a: Analysis = { id: "test-analysis", createdAt: "2026-10-23", repository: { owner: "example", repo: "flow", url: "https://github.com/example/flow" }, commit: "a".repeat(40), root: "", roots: [""], name: "example/flow", description, ...inferApp(files, ""), env: [], license: "MIT", archived: false, updatedAt: "2026-10-23", openIssues: 0, warnings: [], blockers: [], evidence: [], files };
  a.installOptions = installationOptions(a); a.onlineOptions = hostingOptions(a); return a;
}
const chat = () => buildModelReport("https://huggingface.co/Qwen/Qwen2.5-7B-Instruct", { gated: false, inferenceProviderMapping: { example: { status: "live", providerId: "x", task: "conversational" } } });
describe("Einfach verwenden und Alternativen", () => {
  test("belegte Browser-App hat Vorrang vor Installation", () => { const a = base(); a.repository.url = "https://github.com/gchq/CyberChef"; expect(usageChoice(a, true).kind).toBe("browser"); expect(usageChoice(a, true).url).toBe("https://gchq.github.io/CyberChef/"); });
  test("Desktop wird ohne Download oder Webweg zu Alternativen geführt", () => expect(usageChoice(base(), false).kind).toBe("alternatives"));
  test("blockierter Container wird nicht als einfacher Start angeboten", () => { const a = base(); a.strategy = "dockerfile"; a.blockers = ["Unsicherer Startplan"]; expect(usageChoice(a, false).kind).not.toBe("docker"); });
  test("Online-Version bietet keinen lokalen Prozessstart an", () => { const a = base(); a.strategy = "dockerfile"; expect(usageChoice(a, false).kind).toBe("docker"); expect(usageChoice(a, true).kind).not.toBe("docker"); });
  test("Repositorylinks werden nicht zur festgenagelten Alternativsuche", () => expect(alternativeQuery(base("Diagram editor https://github.com/example/flow"))).toBe("diagram editor"));
  test("Geheimwerte werden vor Suchaufruf abgewiesen", async () => { let called = false; await expect(findAlternatives(base(), "hf_" + "a".repeat(35), async () => { called = true; throw Error(); })).rejects.toThrow(); expect(called).toBe(false); });
  test("Live-Suche läuft auch bei vorhandenem Browser-Vorschlag, Original wird ausgeschlossen", async () => { const a = base(); const result = await findAlternatives(a, undefined, async (input, local, oss, options) => { expect(input).toBe("diagram editor"); expect(options).toEqual({ target: "online" }); return { id: "search", candidates: [{ id: "x", url: a.repository.url, score: 99 }, { id: "y", url: "https://github.com/new/tool", score: 3 }], coverage: [] } as unknown as SearchResult; }); expect(result.ready.map(x => x.name)).toContain("draw.io"); expect(result.candidates.map(x => x.id)).toEqual(["y"]); expect(result.ready[0]?.difference).toBeTruthy(); });
  test("Unbekannte Kategorie und Netzfehler erfinden keine Gratisalternative", async () => { const r = await findAlternatives(base("GPU protein folding inference"), undefined, async () => { throw Error("Offline"); }); expect(r.ready).toHaveLength(0); expect(r.notes.join(" ")).toContain("unvollständig"); });
  test("Originalprojekt wird nicht als eigene Alternative vorgeschlagen", async () => { const a = base(); a.repository.url = "https://github.com/jgraph/drawio"; const r = await findAlternatives(a, undefined, async () => ({ id: "s", candidates: [], coverage: [] }) as unknown as SearchResult); expect(r.ready.some(x => x.name === "draw.io")).toBe(false); });
});
describe("Modell mit herunterladbarem Agenten", () => {
  test("ZIP enthält ausführbaren Startweg und korrekt zugeordneten Cloud-Zugang", () => { const r = chat(), files = unzipSync(buildAgentPackage(r, r.providers[0]!.id)); const config = JSON.parse(strFromU8(files["opencode.json"]!)); expect(files["START-AGENT.cmd"]).toBeDefined(); expect(config.model).toBe("aklik-deployer/Qwen/Qwen2.5-7B-Instruct:example"); expect(config.provider["aklik-deployer"].options.apiKey).toBe("{env:HF_TOKEN}"); expect(config.provider["aklik-deployer"].options.baseURL).toBe("https://router.huggingface.co/v1"); expect(config.permission).toEqual({ "*": "ask", external_directory: "deny" }); expect(config.enabled_providers).toEqual(["aklik-deployer"]); });
  test("OpenRouter verwendet seine exakte Modellkennung und eigene Schlüsselvariable", () => { const r = buildModelReport("https://huggingface.co/Qwen/Qwen2.5-7B-Instruct", {}, [{ id: "qwen/qwen-2.5-7b-instruct:free", hugging_face_id: "Qwen/Qwen2.5-7B-Instruct", supported_parameters: ["tools"] }]); const c = JSON.parse(agentPackageFiles(r, r.providers[0]!.id)["opencode.json"]!); expect(c.model).toBe("aklik-deployer/qwen/qwen-2.5-7b-instruct:free"); expect(c.provider["aklik-deployer"].options.apiKey).toBe("{env:OPENROUTER_API_KEY}"); });
  test("Kein Agentenpaket für reine Embeddings oder unbekannten Provider", () => { const r = chat(); r.providers[0]!.task = "feature-extraction"; expect(() => buildAgentPackage(r, r.providers[0]!.id)).toThrow(); expect(() => buildAgentPackage(chat(), "unbekannt")).toThrow(); });
  test("Fremdendpunkt und eingeschleuste Konfigurationsvariablen blockiert", () => { const r = chat(); r.providers[0]!.endpoint = "https://evil.example"; expect(() => buildAgentPackage(r, r.providers[0]!.id)).toThrow(); r.providers[0]!.endpoint = "https://router.huggingface.co/v1"; r.providers[0]!.model = "{env:SECRET}"; expect(() => buildAgentPackage(r, r.providers[0]!.id)).toThrow(); });
  test("Launcher prüft Hash, beschränkt Webserver und fordert lokale Schlüssel an", () => { const r = chat(), ps = agentPackageFiles(r, r.providers[0]!.id)["START.ps1"]!; expect(ps).toContain("ComputeHash"); expect(ps).toContain("-AsSecureString"); expect(ps).toContain("--hostname 127.0.0.1"); expect(ps).toContain("OPENCODE_DISABLE_PROJECT_CONFIG"); expect(ps.indexOf("-cne 'START'")).toBeLessThan(ps.indexOf("if ($Terminal) { & $exe }")); expect(ps).not.toContain("Invoke-Expression"); });
});
