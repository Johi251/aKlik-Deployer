import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA, read, save } from "../src/store";
import { checkProject, deployPrepared, projectPath, projectLogs, restartProject, stopProject, startProject } from "../src/runtime";
import { inferApp } from "../src/analyze";
import type { Analysis, Project } from "../src/types";

const results: Record<string, unknown>[] = [];
const only = process.argv[2];
for (const strategy of ["dockerfile", "compose", "railpack"] as const) {
  if (only && only !== strategy) continue;
  const id = randomUUID(), base = projectPath(id), source = join(base, "source");
  await mkdir(source, { recursive: true });
  const server = "require('node:http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/plain'});res.end('aklik-deployer-fixture-ok')}).listen(Number(process.env.PORT||3000),'0.0.0.0');\n";
  const files: Record<string, string> = { "package.json": JSON.stringify({ name: "aklik-deployer-verification", version: "1.0.0", engines: { node: "22" }, scripts: { start: "node server.cjs" } }), "server.cjs": server };
  if (strategy !== "railpack") files.Dockerfile = "FROM node:22-alpine\nWORKDIR /app\nCOPY server.cjs .\nEXPOSE 3000\nCMD [\"node\",\"server.cjs\"]\n";
  if (strategy === "compose") files["compose.yaml"] = "services:\n  web:\n    build: .\n    ports: ['3000:3000']\n";
  for (const [path, content] of Object.entries(files)) await Bun.write(join(source, path), content);
  const analysis: Analysis = { id: randomUUID(), createdAt: new Date().toISOString(), repository: { owner: "", repo: "", url: "" }, commit: "local-fixture", root: "", roots: [""], name: "Prüf-App · " + strategy, description: "Eigene kontrollierte Prüffixture; kein fremdes GitHub-Projekt.", ...inferApp(files, ""), strategy, configFile: strategy === "compose" ? "compose.yaml" : strategy === "dockerfile" ? "Dockerfile" : undefined, env: [], license: "Eigene Prüffixture", archived: false, updatedAt: new Date().toISOString(), openIssues: 0, warnings: [], blockers: [], files, evidence: [] };
  const project: Project = { id, analysisId: analysis.id, name: analysis.name, createdAt: new Date().toISOString(), status: "queued", strategy, commit: analysis.commit, sourceDir: source, runtimeFile: join(base, "runtime.yaml"), logs: [], containerNames: [] };
  analysis.testOnly = true; project.testOnly = true;
  save("analysis", analysis); save("project", project);
  console.log(`Prüfe ${strategy}: ${id}`);
  try {
    await deployPrepared(analysis, project, {}, 3000);
    if (project.status !== "running" || !project.url) throw new Error("Laufzeitnachweis fehlt.");
    const response = await fetch(project.url); if (await response.text() !== "aklik-deployer-fixture-ok") throw new Error("Unerwartete App-Antwort.");
    await stopProject(id); await restartProject(id);
    let restarted = false;
    for (let i = 0; i < 10; i++) {
      try { if ((await (await fetch(project.url)).text()) === "aklik-deployer-fixture-ok") { restarted = true; break; } } catch { /* starting */ }
      await Bun.sleep(500);
    }
    if (!restarted) throw new Error("Neustart nicht belegt.");
    if ((await checkProject(id)).status !== "running") throw new Error("Erneute Erreichbarkeitsprüfung nach Neustart nicht bestanden.");
    await stopProject(id);
    if ((await checkProject(id)).status !== "stopped") throw new Error("Erneute Zustandsprüfung erkennt Stop nicht.");
    results.push({ strategy, id, status: "passed", http: 200, exactResponse: true, stoppedAndRestarted: true, manualRecheck: true, finalState: read<Project>("project", id)?.status });
    console.log(`${strategy}: Build, exakte HTTP-Antwort, Stop und Neustart bestanden.`);
  } catch (e) {
    project.status = "failed"; project.error = (e as Error).message; save("project", project);
    try { const logs = await projectLogs(id); console.error(logs.logs.slice(-4000)); await stopProject(id); } catch { /* error retained */ }
    results.push({ strategy, id, status: "failed", error: (e as Error).message });
    await mkdir(join(DATA, "verification"), { recursive: true });
    await Bun.write(join(DATA, "verification/docker.json"), JSON.stringify(results, null, 2)); throw e;
  }
}
if (only === "public") {
  const verification = await Bun.file(join(DATA, "verification/live.json")).json();
  const project = await startProject(verification.analysis.id, {}, 3000);
  console.log("Öffentlicher Checkout, Build und Start: " + project.id);
  for (let i = 0; i < 180; i++) {
    const current = read<Project>("project", project.id)!;
    if (current.status === "failed") throw new Error(current.error);
    if (current.status === "running") { await stopProject(current.id); results.push({ strategy: "public-dockerfile", status: "passed", id: current.id, commit: current.commit, finalState: "stopped" }); break; }
    if (i % 10 === 0) console.log(current.status + ": " + (current.logs.at(-1) ?? ""));
    await Bun.sleep(2000);
  }
  if (!results.length) throw new Error("Zeitlimit für öffentlichen Build überschritten.");
}
await mkdir(join(DATA, "verification"), { recursive: true });
await Bun.write(join(DATA, `verification/docker${only ? "-" + only : ""}.json`), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify(results, null, 2));
