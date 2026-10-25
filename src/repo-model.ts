import { reviewCompose } from "./compose-review";
import type { Analysis, RepoRef } from "./types";
const posix = { basename: (path: string) => path.split("/").at(-1)!, dirname: (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "." };
export function parseRepo(value: string): RepoRef {
  const u = new URL(value.startsWith("https://") ? value : "https://" + value);
  if (u.protocol !== "https:" || u.hostname !== "github.com" || u.username || u.password || u.port || u.search || u.hash) throw new Error("Bitte eine öffentliche GitHub-Repository-URL ohne Zugangsdaten eingeben.");
  const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const owner = parts[0] ?? "", repo = (parts[1] ?? "").replace(/\.git$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || [".", ".."].includes(repo) || ![2, 4].includes(parts.length) || (parts.length === 4 && parts[2] !== "tree")) throw new Error("Unterstützt werden github.com/owner/repo und /tree/branch. App-Verzeichnis separat wählen.");
  const ref = parts[3];
  if (ref && !/^[A-Za-z0-9_.-]{1,150}$/.test(ref)) throw new Error("Ungültiger Git-Ref.");
  return { owner, repo, ref, url: `https://github.com/${owner}/${repo}` };
}
export function normalizeRoot(value: string): string {
  value = value.trim().replace(/\\/g, "/").replace(/\/$/, "");
  if (value === ".") return "";
  if (value.length > 220 || value.startsWith("/") || value.split("/").some(p => p === ".." || p === ".git" || /[:\x00-\x1f]/.test(p))) throw new Error("Ungültiges App-Verzeichnis.");
  return value;
}
export const manifestNames = new Set(["package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod", "Dockerfile", "compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml", ".env.example", ".env.sample", "Procfile", "README.md", "index.html"]);
export interface RepoMetadata { full_name: string; description: string | null; language: string | null; default_branch: string; license: { spdx_id: string } | null; archived: boolean; pushed_at: string; open_issues_count: number }
export interface TreeEntry { path: string; mode: string; type: string; size?: number }
export function rootCandidates(tree: TreeEntry[]): string[] {
  return [...new Set(tree.filter(t => t.type === "blob" && ["package.json", "pyproject.toml", "requirements.txt", "Dockerfile", "compose.yaml", "compose.yml", "docker-compose.yml", "docker-compose.yaml"].includes(posix.basename(t.path)) && !/(^|\/)(test[s]?|fixtures|node_modules|vendor|\.github|examples?)\//.test(t.path)).map(t => posix.dirname(t.path) === "." ? "" : posix.dirname(t.path)))]
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)).slice(0, 20);
}
export function inferApp(files: Record<string, string>, root: string): Pick<Analysis, "language" | "framework" | "projectType" | "commands" | "strategy" | "ports"> {
  const at = (name: string) => files[root ? root + "/" + name : name];
  let language = "Unbekannt", framework = "Nicht erkannt", projectType = "Unbekannt", strategy: Analysis["strategy"] = "unsupported";
  const commands: Analysis["commands"] = {}; const ports: number[] = [];
  const compose = ["compose.yaml", "compose.yml", "docker-compose.yml", "docker-compose.yaml"].find(n => at(n));
  if (compose) strategy = "compose";
  else if (at("Dockerfile")) strategy = "dockerfile";
  if (at("package.json")) {
    language = "JavaScript / TypeScript";
    try {
      const pkg = JSON.parse(at("package.json")!);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const scripts = pkg.scripts ?? {};
      framework = deps.next ? "Next.js" : deps.nuxt ? "Nuxt" : deps["@sveltejs/kit"] ? "SvelteKit" : deps.astro ? "Astro" : deps.vite ? "Vite" : deps.express ? "Express" : deps.fastify ? "Fastify" : deps.hono ? "Hono" : "Node.js";
      const manager = /^(bun|pnpm|yarn)@/.exec(pkg.packageManager ?? "")?.[1] ?? "npm";
      commands.install = manager === "npm" ? "npm install" : `${manager} install`;
      if (scripts.build) commands.build = `${manager} run build`;
      if (scripts.start) commands.start = `${manager} run start`;
      projectType = pkg.bin ? "CLI-Werkzeug" : deps.electron || deps["@tauri-apps/api"] ? "Desktop-App" : scripts.start || ["Vite", "Astro", "Next.js", "Nuxt", "SvelteKit"].includes(framework) ? "Web-App" : "Bibliothek oder uneindeutiges Node-Projekt";
      if (strategy === "unsupported" && projectType === "Web-App") strategy = "railpack";
      if (projectType === "Web-App") ports.push(framework === "Vite" || framework === "Astro" ? 80 : 3000);
    } catch { framework = "package.json nicht lesbar"; }
  } else if (at("requirements.txt") || at("pyproject.toml")) {
    language = "Python";
    const text = (at("requirements.txt") ?? "") + (at("pyproject.toml") ?? "");
    framework = /fastapi/i.test(text) ? "FastAPI" : /django/i.test(text) ? "Django" : /flask/i.test(text) ? "Flask" : /streamlit/i.test(text) ? "Streamlit" : "Python";
    projectType = framework === "Python" ? "Python-Projekt, Startzweck ungeklärt" : "Web-App";
    commands.install = at("pyproject.toml") ? "Paketmanager wird durch Railpack bestimmt" : "pip install -r requirements.txt";
    if (strategy === "unsupported" && projectType === "Web-App") strategy = "railpack";
    if (projectType === "Web-App") ports.push(framework === "Streamlit" ? 8501 : 8000);
  } else if (at("go.mod")) { language = "Go"; projectType = "Go-Projekt"; }
  else if (at("Cargo.toml")) { language = "Rust"; projectType = "Rust-Projekt"; }
  if (at("Dockerfile")) for (const match of at("Dockerfile")!.matchAll(/^\s*EXPOSE\s+(\d+)/gmi)) ports.unshift(Number(match[1]));
  if (compose) ports.unshift(...reviewCompose(at(compose)!, compose).ports);
  if (strategy === "dockerfile" && projectType === "Unbekannt") projectType = "Container-Anwendung";
  if (strategy === "compose") projectType = "Compose-Anwendung mit mehreren Diensten";
  return { language, framework, projectType, commands, strategy, ports: [...new Set(ports)].filter(p => p > 0 && p <= 65535) };
}
