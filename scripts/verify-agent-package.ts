import { join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { agentPackageFiles, agentRelease } from "../src/agent-package";
import { buildModelReport } from "../src/model-planner";

const root = resolve(import.meta.dir, "../.data/verification/Agent Paket Test");
await mkdir(root, { recursive: true });
const report = buildModelReport("https://huggingface.co/Qwen/Qwen2.5-7B-Instruct", {}, [{ id: "qwen/qwen-2.5-7b-instruct", hugging_face_id: "Qwen/Qwen2.5-7B-Instruct", supported_parameters: ["tools"] }]);
for (const [name, text] of Object.entries(agentPackageFiles(report, report.providers[0]!.id))) await Bun.write(join(root, name), text);
async function run(args: string[], env?: Record<string, string | undefined>) {
  const p = Bun.spawn(args, { cwd: root, env: env ?? process.env, stdout: "pipe", stderr: "pipe", windowsHide: true });
  const timer = setTimeout(() => p.kill(), 240_000);
  try { const [exit, stdout, stderr] = await Promise.all([p.exited, new Response(p.stdout).text(), new Response(p.stderr).text()]); if (exit !== 0) throw new Error(`Laufzeitpruefung ${exit}: ${stderr.slice(0, 1000)} ${stdout.slice(0, 1000)}`); return stdout; }
  finally { clearTimeout(timer); }
}
const output = await run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "START.ps1"), "-CheckOnly"]);
if (!output.includes(agentRelease.version)) throw new Error("Falsche Laufzeitversion.");
const state = join(root, ".agent-state");
const env = { ...process.env, XDG_CONFIG_HOME: join(state, "config"), XDG_DATA_HOME: join(state, "data"), XDG_CACHE_HOME: join(state, "cache"), XDG_STATE_HOME: join(state, "state"), OPENCODE_CONFIG: join(root, "opencode.json"), OPENCODE_CONFIG_CONTENT: undefined, OPENCODE_CONFIG_DIR: join(state, "config/opencode"), OPENCODE_DISABLE_PROJECT_CONFIG: "true", OPENCODE_DISABLE_AUTOUPDATE: "true", OPENCODE_DISABLE_MODELS_FETCH: "true", OPENCODE_PERMISSION: undefined, OPENCODE_DB: undefined, OPENROUTER_API_KEY: "aklik-deployer-local-test-placeholder" };
const configText = await run([join(root, ".runtime/opencode.exe"), "debug", "config"], env);
// debug config may contain the test placeholder; never write the raw result to disk or logs.
const config = JSON.parse(configText.slice(configText.indexOf("{")));
if (config.model !== "aklik-deployer/qwen/qwen-2.5-7b-instruct" || config.provider?.["aklik-deployer"]?.options?.baseURL !== "https://openrouter.ai/api/v1" || config.permission?.external_directory !== "deny") throw new Error("Agent-Konfiguration nicht korrekt geladen.");
const proof = { checkedAt: new Date().toISOString(), status: "passed", runtime: agentRelease.version, windowsPowerShell: true, pathWithSpaces: true, hashVerified: true, configurationLoadedByRealRuntime: true, model: config.model, noModelRequest: true, uiInteractionTested: false };
await Bun.write(resolve(root, "../agent-package-v04.json"), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
