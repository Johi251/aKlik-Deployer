import { describe, expect, test } from "bun:test";
import { hostingOptions, installationOptions, windowsAssets, type GitHubRelease } from "../src/repo-options";
import { buildModelReport, modelSetupProfile, parseModelLink } from "../src/model-planner";
import { hasSecret } from "../src/matching";
import { inferApp } from "../src/repo-model";
import type { Analysis } from "../src/types";

const repo = "https://github.com/example/tool";
const base = (files: Record<string,string> = {}): Analysis => ({ id: "fixture", createdAt: "", repository: { owner: "example", repo: "tool", url: repo }, commit: "a".repeat(40), root: "", roots: [""], name: "example/tool", description: "", ...inferApp(files, ""), env: [], license: "MIT", archived: false, updatedAt: "", openIssues: 0, warnings: [], blockers: [], evidence: [], files });
const release = (assets: GitHubRelease["assets"]): GitHubRelease => ({ tag_name: "v1", html_url: repo + "/releases/tag/v1", published_at: "", draft: false, prerelease: false, assets });
const asset = (name: string, url = repo + "/releases/download/v1/" + name) => ({ name, browser_download_url: url, size: 1234 });

describe("Installationsmöglichkeiten", () => {
  test("EXE und MSI als Windows-Option, Linux-Dateien ausgeschlossen", () => { const files = windowsAssets(release([asset("tool-x64.exe"), asset("tool-arm64.msi"), asset("tool-linux.zip"), asset("tool.tar.gz")]), repo); expect(files).toHaveLength(2); expect(files[0]?.architecture).toBe("x64"); expect(files[1]?.architecture).toBe("ARM64"); });
  test("Windows-ZIP wird als möglicher portabler Weg gekennzeichnet", () => { const options = installationOptions(base(), release([asset("tool-windows-x64.zip")])); expect(options.find(o => o.id === "windows-portable")?.status).toBe("available"); expect(options.find(o => o.id === "windows-installer")?.status).toBe("unavailable"); });
  test("Fremde oder irreführende Download-URLs werden verworfen", () => expect(windowsAssets(release([asset("tool.exe", "https://evil.example/tool.exe"), asset("other.exe", "https://github.com/other/repo/releases/download/x/other.exe")]), repo)).toHaveLength(0));
  test("Drafts und Vorabversionen werden nicht empfohlen", () => expect(windowsAssets({ ...release([asset("tool.exe")]), prerelease: true }, repo)).toHaveLength(0));
  test("EXE-Fund erlaubt keine unbelegte Docker-Pflicht", () => { const options = installationOptions(base({ Dockerfile: "FROM alpine" }), release([asset("tool.exe")])); expect(options.find(o => o.id === "windows-installer")?.recommended).toBe(true); expect(options.find(o => o.id === "docker")?.recommended).toBe(false); });
  test("Blockierter Compose-Plan bleibt bedingt", () => { const a = base({ "compose.yaml": "services:\n  app:\n    image: nginx" }); a.blockers = ["Bind-Mount gesperrt"]; expect(installationOptions(a).find(o => o.id === "docker")?.status).toBe("conditional"); });
});
describe("Online-Eignung", () => {
  test("Statische Startseite erzeugt Free-Hosting-Kandidat", () => expect(hostingOptions(base({ "index.html": "<h1>Hello</h1>" }), ["index.html"]).find(o => o.id === "static")?.status).toBe("candidate"));
  test("Desktop-App wird nicht als deploybare Website angeboten", () => { const a = base({ "package.json": JSON.stringify({ dependencies: { electron: "1" }, scripts: { start: "electron ." } }) }); expect(hostingOptions(a).every(o => o.status === "unsuitable")).toBe(true); });
  test("Compose-Gesamtstack wird nicht als einzelner Free-Webdienst behandelt", () => expect(hostingOptions(base({ "compose.yaml": "services:\n  app:\n    image: nginx" })).find(o => o.id === "render")?.status).toBe("unsuitable"));
  test("SQLite wird als fehlende Dauerhaftigkeit benannt", () => { const a = base({ Dockerfile: "FROM alpine", "README.md": "Stores in SQLite" }); expect(hostingOptions(a).find(o => o.id === "render")?.limitations.some(s => s.includes("Datenhaltung"))).toBe(true); });
});
describe("Modelllink, Cloud und Agent-Profil", () => {
  test("Modellanbieter-Schlüssel werden auch ohne Feldnamen erkannt", () => { for (const key of ["hf_" + "a".repeat(32), "pf-gw-" + "b".repeat(24), "sk-or-v1-" + "c".repeat(32)]) expect(hasSecret(key)).toBe(true); });
  test("HF- und Pirateface-Links ergeben dieselbe Modellkennung", () => { expect(parseModelLink("https://pirateface.co/Qwen/Example").modelId).toBe(parseModelLink("https://huggingface.co/Qwen/Example").modelId); });
  test("Fremdhosts, Geheimwerte und Spaces werden abgelehnt", () => { for (const u of ["https://huggingface.co.evil.example/Qwen/Model", "https://huggingface.co/spaces/user", "https://huggingface.co/a/b?token=example", "https://pirateface.co/models", "https://user:secret@huggingface.co/a/b"]) expect(() => parseModelLink(u)).toThrow(); });
  test("Staging ist kein verfügbarer Cloud-Zugang", () => { const r = buildModelReport("https://huggingface.co/a/b", { inferenceProviderMapping: { provider: { status: "staging", providerId: "a/b", task: "conversational" } } }); expect(r.providers).toHaveLength(0); });
  test("GGUF ist keine Cloud-API und erzeugt kein Chat-Profil", () => { const r = buildModelReport("https://pirateface.co/a/b", { siblings: [{ rfilename: "model.gguf" }] }); expect(r.ggufFiles).toHaveLength(1); expect(r.providers).toHaveLength(0); expect(() => modelSetupProfile(r, { mode: "model", providerId: "none" })).toThrow(); });
  test("Embedding-Anbieter wird nicht zum Haupt-Chatmodell erklärt", () => { const r = buildModelReport("https://huggingface.co/a/b", { inferenceProviderMapping: { provider: { status: "live", providerId: "a/b", task: "feature-extraction" } } }); expect(() => modelSetupProfile(r, { mode: "profile", providerId: "hf:provider" })).toThrow(); });
  test("OpenRouter-Zuordnung erfordert exakte HF-ID", () => { const r = buildModelReport("https://huggingface.co/a/b", {}, [{ id: "vendor/b", hugging_face_id: "a/b-other" }]); expect(r.providers).toHaveLength(0); });
  test("Einrichtungsprompt enthält nur Variablennamen und begrenzt Ausführung", () => { const r = buildModelReport("https://huggingface.co/a/b", { inferenceProviderMapping: { provider: { status: "live", providerId: "a/b", task: "conversational" } } }); const p = modelSetupProfile(r, { mode: "profile", providerId: "hf:provider", agent: "Hermes Agent", purpose: "Recherche" }); expect(p.prompt).toContain("HF_TOKEN"); expect(p.prompt).toContain("unbekannten Kosten"); expect(p.prompt).toContain("bestehende"); expect(p.prompt).toContain("trust_remote_code"); expect(p.mode).toBe("profile"); });
  test("Profilzweck nimmt keine Schlüsselwerte an", () => { const r = buildModelReport("https://huggingface.co/a/b", {}); expect(() => modelSetupProfile(r, { mode: "model", purpose: "password=example-secret" })).toThrow(); });
});
