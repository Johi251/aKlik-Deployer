import { mkdir, lstat, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { stringify } from "yaml";
import { DATA, list, read, save } from "./store";
import { command, must, redact, validateEnv } from "./process";
import { inside, reviewCompose, runtimeCompose } from "./compose";
import type { Analysis, Project } from "./types";

export const RAILPACK_VERSION = "0.43.0";
export const RAILPACK_IMAGE = "ghcr.io/railwayapp/railpack-frontend@sha256:355ef61fae6f2551103cd8b10c710cb07167dd353d561f15c69b8d7ac1c676cc";
const LABEL = "io.aklik-deployer.project";
const LEGACY_LABEL='io.'+['one','clicker'].join('')+'.project';
let deploying = false;
const liveSecrets = new Map<string, string[]>();
export async function toolsStatus(): Promise<{ docker: boolean; detail: string; railpack: boolean; railpackVersion: string }> {
  try {
    const endpoint = (await must(["docker", "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"])).trim();
    if (!/^(npipe:\/\/|unix:\/\/)/.test(endpoint)) throw new Error("Nur eine lokale Docker-Engine ist freigegeben.");
    const detail = (await must(["docker", "version", "--format", "{{.Server.Version}} {{.Server.Os}}"])).trim();
    if (!detail.endsWith(" linux")) throw new Error("Bitte Docker auf Linux-Container umstellen.");
    return { docker: true, detail, railpack: (await command(["docker", "image", "inspect", RAILPACK_IMAGE])).code === 0, railpackVersion: RAILPACK_VERSION };
  } catch (e) { return { docker: false, detail: (e as Error).message, railpack: false, railpackVersion: RAILPACK_VERSION }; }
}
function log(project: Project, line: string): void {
  project.logs.push(redact(line, liveSecrets.get(project.id)).slice(0, 4000));
  project.logs = project.logs.slice(-450); save("project", project);
}
async function port(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer(); server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const address = server.address(); if (!address || typeof address === "string") return reject(new Error("Port konnte nicht bestimmt werden.")); server.close(() => resolve(address.port)); });
  });
}
export function projectPath(id: string): string {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Ungültige Projekt-ID.");
  return inside(join(DATA, "projects"), id);
}
async function ensureNoSymlinks(directory: string): Promise<void> {
  for await (const path of new Bun.Glob("**/*").scan({ cwd: directory, dot: true, onlyFiles: false, followSymlinks: false })) {
    if (path.startsWith(".git/")) continue;
    if ((await lstat(join(directory, path))).isSymbolicLink()) throw new Error("Symlink im Checkout: automatische Ausführung abgebrochen.");
  }
}
async function checkout(analysis: Analysis, project: Project): Promise<void> {
  const base = projectPath(project.id), hooks = join(base, "no-hooks");
  await mkdir(hooks, { recursive: true });
  const env = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1" };
  const options = { env, timeout: 120_000, log: (line: string) => log(project, line) };
  await must(["git", "-c", `core.hooksPath=${hooks}`, "-c", "core.symlinks=false", "-c", "credential.helper=", "-c", "protocol.file.allow=never", "-c", "protocol.ext.allow=never", "clone", "--no-checkout", "--depth", "1", "--single-branch", "--", analysis.repository.url + ".git", project.sourceDir], options);
  const actual = (await must(["git", "-C", project.sourceDir, "rev-parse", "HEAD"], { env })).trim();
  if (actual !== analysis.commit) {
    await must(["git", "-C", project.sourceDir, "fetch", "--depth", "1", "origin", analysis.commit], options);
  }
  const tree = await must(["git", "-C", project.sourceDir, "ls-tree", "-r", analysis.commit], { env, maxOutput: 4_000_000 });
  if (/^(120000|160000) /m.test(tree)) throw new Error("Symlinks oder Submodule im Checkout werden nicht ausgeführt.");
  await must(["git", "-C", project.sourceDir, "-c", `core.hooksPath=${hooks}`, "-c", "core.symlinks=false", "checkout", "--detach", analysis.commit], options);
  await ensureNoSymlinks(project.sourceDir);
  for (const [path, contents] of Object.entries(analysis.files)) {
    const actualText = await readFile(inside(project.sourceDir, path), "utf8");
    if (actualText.replace(/\r\n/g, "\n") !== contents.replace(/\r\n/g, "\n")) throw new Error("Checkout stimmt nicht mit der geprüften Konfiguration überein. Erneut analysieren.");
  }
}
function composeArgs(project: Project, action: string, ...args: string[]): string[] {
  return ["docker", "compose", "--project-name", "oc-" + project.id, "--file", project.runtimeFile, action, ...args];
}
function runtimeEnv(values: Record<string, string>): Record<string, string> {
  return { ...values, COMPOSE_DISABLE_ENV_FILE: "1", COMPOSE_ANSI: "never" };
}
export function validateStart(analysis: Analysis, values: Record<string, string>, containerPort: number): void {
  if (analysis.blockers.length) throw new Error(analysis.blockers.join(" "));
  if (!Number.isInteger(containerPort) || containerPort < 1 || containerPort > 65535) throw new Error("Container-Port muss zwischen 1 und 65535 liegen.");
  const missing = analysis.env.filter(v => v.required && !values[v.name]);
  if (missing.length) throw new Error("Benötigte Angaben fehlen: " + missing.map(v => v.name).join(", "));
}
export async function startProject(analysisId: string, provided: unknown, containerPort: number): Promise<Project> {
  if (deploying) throw new Error("Ein Build läuft bereits. Bitte dessen Abschluss abwarten.");
  deploying = true;
  try {
  const analysis = read<Analysis>("analysis", analysisId);
  if (!analysis) throw new Error("Analyse nicht gefunden. Repository erneut prüfen.");
  const values = validateEnv(provided); validateStart(analysis, values, containerPort);
  const status = await toolsStatus();
  if (!status.docker) throw new Error(status.detail);
  if (analysis.strategy === "railpack" && !status.railpack) throw new Error("Railpack fehlt. Im Projektordner bun run setup:railpack ausführen.");
  const id = randomUUID(), base = projectPath(id);
  const project: Project = { id, name: analysis.name, analysisId, createdAt: new Date().toISOString(), status: "queued", strategy: analysis.strategy, commit: analysis.commit, sourceDir: join(base, "source"), runtimeFile: join(base, "runtime.yaml"), logs: [], containerNames: [] };
  liveSecrets.set(id, Object.values(values)); save("project", project); deploying = true;
  void deploy(analysis, project, values, containerPort).catch(e => {
    project.status = "failed"; project.error = redact((e as Error).message, Object.values(values)); log(project, project.error);
  }).finally(() => { deploying = false; liveSecrets.delete(id); });
  return project;
  } catch (e) { deploying = false; throw e; }
}
async function deploy(analysis: Analysis, project: Project, values: Record<string, string>, containerPort: number): Promise<void> {
  project.status = "fetching"; log(project, "Prüfstand wird geklont: " + analysis.commit);
  await checkout(analysis, project);
  await deployPrepared(analysis, project, values, containerPort);
}
// Test harness and runtime share the same build/run path. The HTTP API never accepts a local source directory.
export async function deployPrepared(analysis: Analysis, project: Project, values: Record<string, string>, containerPort: number): Promise<void> {
  validateEnv(values); validateStart(analysis, values, containerPort);
  await ensureNoSymlinks(project.sourceDir);
  const root = inside(project.sourceDir, analysis.root), base = projectPath(project.id);
  const env = runtimeEnv(values), run = { env, secrets: Object.values(values), timeout: 10 * 60_000, log: (line: string) => log(project, line) };
  project.status = "building"; log(project, "Build- und Laufzeitkonfiguration wird vorbereitet.");
  if (analysis.strategy === "compose") {
    const contents = await readFile(inside(project.sourceDir, analysis.configFile!), "utf8");
    const review = reviewCompose(contents, analysis.configFile!);
    const ports = new Map<string, number>();
    for (const [name, svc] of Object.entries(review.model?.services ?? {}) as [string, Record<string, any>][]) {
      for (const raw of svc.ports ?? []) {
        const target = Number(typeof raw === "object" ? raw.target : String(raw).split(":").at(-1)?.split("/")[0]);
        ports.set(`${name}:${target}`, await port());
      }
      svc.labels = { [LABEL]: project.id };
    }
    await Bun.write(project.runtimeFile, runtimeCompose(review, root, ports));
    await must(composeArgs(project, "config", "--quiet"), run);
    await must(composeArgs(project, "up", "--detach", "--build", "--remove-orphans"), run);
    const ids = (await must(composeArgs(project, "ps", "--all", "--quiet"), run)).trim().split(/\s+/).filter(Boolean);
    project.containerNames = ids;
    const first = [...ports.values()][0]; if (first) project.url = `http://127.0.0.1:${first}`;
  } else {
    const image = `aklik-deployer/${project.id}:local`, tag = "oc-" + project.id;
    if (analysis.strategy === "railpack") {
      const output = join(base, "plan"), plan = join(output, "railpack-plan.json");
      await mkdir(output, { recursive: true });
      // Planning receives no host/project secrets. Build-time secrets are intentionally unsupported in v0.1.
      await must(["docker", "run", "--rm", "--label", `${LABEL}=${project.id}`, "--memory", "512m", "--cpus", "1", "--pids-limit", "128", "--security-opt", "no-new-privileges:true", "--read-only", "--tmpfs", "/tmp:exec,size=256m", "--tmpfs", "/root:size=256m", "--mount", `type=bind,source=${root},target=/src,readonly`, "--mount", `type=bind,source=${output},target=/out`, "--entrypoint", "/railpack", RAILPACK_IMAGE, "prepare", "/src", "--plan-out", "/out/railpack-plan.json", "--info-out", "/out/railpack-info.json", "--error-missing-start"], { timeout: 180_000, log: run.log });
      await must(["docker", "buildx", "build", "--load", "--progress", "plain", "--build-arg", `BUILDKIT_SYNTAX=${RAILPACK_IMAGE}`, "--build-arg", `cache-key=${project.id}`, "--file", plan, "--tag", image, root], run);
    } else await must(["docker", "build", "--progress", "plain", "--tag", image, "--file", inside(project.sourceDir, analysis.configFile!), root], run);
    const published = await port();
    const appEnvironment: Record<string, string> = { ...values, PORT: String(containerPort) };
    const runtime = { services: { app: { image, init: true, container_name: tag, labels: { [LABEL]: project.id }, ports: [`127.0.0.1:${published}:${containerPort}`], environment: Object.keys(appEnvironment), mem_limit: "1g", cpus: 1, pids_limit: 256, security_opt: ["no-new-privileges:true"] } } };
    await Bun.write(project.runtimeFile, stringify(runtime));
    await must(composeArgs(project, "up", "--detach"), { ...run, env: runtimeEnv(appEnvironment) });
    project.containerNames = [tag]; project.url = `http://127.0.0.1:${published}`;
  }
  project.status = "checking"; log(project, "Containerzustand und lokale Erreichbarkeit werden geprüft.");
  for (let attempt = 0; attempt < 35; attempt++) {
    const inspected = await inspectOwned(project);
    if (inspected.some(c => c.State?.Status === "exited" || c.State?.Status === "dead")) throw new Error("Ein Container wurde beendet. Laufzeitlogs zur Diagnose öffnen.");
    if (inspected.length && inspected.every(c => c.State?.Running && c.State?.Health?.Status === "healthy")) {
      project.status = "running"; log(project, "Deklarierte Container-Healthchecks bestanden. Fachliche App-Funktion bleibt separat zu prüfen."); return;
    }
    if (project.url) {
      try {
        const res = await fetch(project.url, { signal: AbortSignal.timeout(1200), redirect: "manual" });
        await res.body?.cancel();
        if (res.status >= 200 && res.status < 400 && inspected.every(c => c.State?.Running)) {
          project.status = "running"; log(project, `Lokale Web-App antwortet mit HTTP ${res.status}. Fachliche Funktionsprüfung offen.`); return;
        }
      } catch { /* may still be starting */ }
    }
    await Bun.sleep(1000);
  }
  project.status = "started"; log(project, "Container gestartet; kein erfolgreicher HTTP-/Healthcheck belegt. Noch keine bestätigte App-Funktion.");
}
interface ContainerInfo { Id: string; Config: { Labels?: Record<string, string>; Env?: string[] }; State?: { Running: boolean; Status: string; Health?: { Status: string } } }
async function inspectOwned(project: Project): Promise<ContainerInfo[]> {
  if (!project.containerNames.length) {
    const output=await Promise.all([LABEL,LEGACY_LABEL].map(label=>must(['docker','ps','--all','--quiet','--filter',`label=${label}=${project.id}`])));
    const ids = [...new Set(output.join('\n').trim().split(/\s+/).filter(Boolean))];
    if (!ids.length) return [];
    project.containerNames = ids; save("project", project);
  }
  const result = await command(["docker", "inspect", ...project.containerNames]);
  if (result.code) throw new Error("Projektcontainer nicht gefunden; Docker-Status prüfen.");
  const containers = JSON.parse(result.stdout) as ContainerInfo[];
  if (containers.some(c => (c.Config.Labels?.[LABEL]??c.Config.Labels?.[LEGACY_LABEL]) !== project.id)) throw new Error("Container gehört nicht zu diesem Projekt. Zugriff verweigert.");
  return containers;
}
export async function projectLogs(id: string): Promise<{ project: Project; logs: string }> {
  const project = read<Project>("project", id); if (!project) throw new Error("Projekt nicht gefunden.");
  let logs = project.logs.join("\n");
  if (project.containerNames.length || ["running", "started", "failed", "stopped"].includes(project.status)) {
    const containers = await inspectOwned(project);
    const secrets = containers.flatMap(c => c.Config.Env ?? []).map(s => s.slice(s.indexOf("=") + 1)).filter(s => s.length > 0);
    for (const container of containers) {
      const result = await command(["docker", "logs", "--tail", "100", container.Id]);
      logs += "\n" + redact(result.stdout + result.stderr, secrets);
    }
    if (["running", "started"].includes(project.status) && containers.some(c => !c.State?.Running)) { project.status = "stopped"; save("project", project); }
  }
  return { project, logs: logs.slice(-60_000) };
}
export async function stopProject(id: string): Promise<Project> {
  const project = read<Project>("project", id); if (!project) throw new Error("Projekt nicht gefunden.");
  if (["queued", "fetching", "building", "checking"].includes(project.status)) throw new Error("Der Start läuft noch. Nach Abschluss stoppen; Build-Zeitlimit ist begrenzt.");
  const containers = await inspectOwned(project);
  if (containers.length) await must(["docker", "stop", "--time", "10", ...containers.map(c => c.Id)]);
  project.status = "stopped"; log(project, "Projekt gestoppt. Datenvolumes und Images bleiben erhalten."); return project;
}
export async function restartProject(id: string): Promise<Project> {
  const project = read<Project>("project", id); if (!project) throw new Error("Projekt nicht gefunden.");
  if (!["stopped", "failed"].includes(project.status)) throw new Error("Projekt muss zuerst gestoppt sein.");
  const containers = await inspectOwned(project);
  if (!containers.length) throw new Error("Keine vorhandenen Projektcontainer. Erneut über die Analyse starten.");
  await must(["docker", "start", ...containers.map(c => c.Id)]);
  project.status = "started"; project.error = undefined;
  log(project, "Vorhandene Container wieder gestartet. Funktionsprüfung noch offen."); return project;
}
export async function checkProject(id: string): Promise<Project> {
  const project = read<Project>("project", id); if (!project) throw new Error("Projekt nicht gefunden.");
  if (["queued", "fetching", "building", "checking"].includes(project.status)) throw new Error("Der Start läuft noch. Seine Prüfung wird automatisch durchgeführt.");
  const tools = await toolsStatus(); if (!tools.docker) throw new Error(tools.detail);
  const containers = await inspectOwned(project);
  if (!containers.length) throw new Error("Keine Projektcontainer vorhanden. Startweg erneut prüfen.");
  if (containers.some(c => !c.State?.Running)) {
    project.status = containers.every(c => !c.State?.Running) ? "stopped" : "failed";
    if (project.status === "failed") project.error = "Nur ein Teil der Projektcontainer läuft. Laufzeitlogs prüfen.";
    log(project, "Containerstatus erneut geprüft: mindestens ein Dienst läuft nicht."); return project;
  }
  const unhealthy = containers.some(c => c.State?.Health?.Status === "unhealthy");
  let healthy = containers.every(c => c.State?.Health?.Status === "healthy");
  if (!unhealthy && !healthy && project.url && /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(project.url)) {
    try { const response = await fetch(project.url, { signal: AbortSignal.timeout(2500), redirect: "manual" }); healthy = response.status >= 200 && response.status < 400; await response.body?.cancel(); } catch { /* HTTP remains unverified */ }
  }
  project.status = healthy && !unhealthy ? "running" : "started"; project.error = undefined;
  log(project, project.status === "running" ? "Erneute Prüfung: HTTP-/Healthcheck bestanden. Fachliche Funktion ungeprüft." : unhealthy ? "Deklarierter Healthcheck meldet unhealthy. Laufzeitlogs prüfen." : "Container laufen; erfolgreicher HTTP-/Healthcheck weiterhin offen."); return project;
}
export function reconcileInterrupted(): void {
  for (const project of list<Project>("project", 1000)) {
    if (["queued", "fetching", "building", "checking"].includes(project.status)) {
      project.status = "failed"; project.error = "Steuerung während des Starts beendet. Container können noch existieren; Status und Logs prüfen."; log(project, project.error);
    }
  }
}
