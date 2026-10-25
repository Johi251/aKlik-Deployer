import { describe, expect, test } from "bun:test";
import { canonical, makeProfile, markdownLinks, mergeCandidates, recognizedOpenSourceLicense, relevance } from "../src/search";
import { normalizeRoot, parseRepo, inferApp } from "../src/analyze";
import { extractEnv, inside, reviewCompose, runtimeCompose } from "../src/compose";
import { publicAddress, validatePublicUrl, getPublic } from "../src/network";
import { command, redact, validateEnv } from "../src/process";
import { validateStart } from "../src/runtime";
import { createApp } from "../src/server";
import type { Analysis, Candidate } from "../src/types";

describe("Bedarf vor Neubau", () => {
  test("deutsche Aufgabenbeschreibung liefert englische Suchbegriffe", () => expect(makeProfile("Ich mÃ¶chte Rechnungen erstellen").terms).toContain("invoice"));
  test("Link ohne eigene Beschreibung kann spÃ¤ter eingeordnet werden", () => expect(makeProfile("https://github.com/foo/bar").inputUrl).toBe("https://github.com/foo/bar"));
  test("vermeidet SchlÃ¼sselÃ¼bertragung an Suchanbieter", () => expect(() => makeProfile("mein " + "ghp" + "_" + "123456789012345678901234567890")).toThrow("SchlÃ¼ssel"));
  test("Metadaten mit restriktiver Lizenz werden nicht als OSS freigegeben", () => {
    expect(recognizedOpenSourceLicense("BUSL-1.1")).toBe(false); expect(recognizedOpenSourceLicense("NOASSERTION")).toBe(false);
    expect(recognizedOpenSourceLicense("AGPL-3.0-only")).toBe(true);
  });
  test("gleicher Kandidat in mehreren Katalogen wird zusammengefÃ¼hrt", () => {
    const make = (url: string, source: string): Candidate => ({ id: url, url, name: "Tool", description: "", sources: [source], score: 4, reasons: [], kind: "repository", cost: "unknown", evidence: [] });
    const result = mergeCandidates([make("https://github.com/owner/repo/", "first"), make("https://github.com/owner/repo", "second")], makeProfile("bookmark"));
    expect(result).toHaveLength(1); expect(result[0]!.sources).toEqual(["first", "second"]);
  });
  test("OSS-Filter schlieÃŸt ungeprÃ¼ften Gratis-Katalogfund aus", () => {
    const c: Candidate = { id: "x", name: "x", url: "https://example.com", description: "Free", sources: [], score: 99, reasons: [], kind: "online", cost: "catalog", evidence: [] };
    expect(mergeCandidates([c], makeProfile("bookmark", true, true))).toHaveLength(0);
  });
  test("kanonische Repo-IdentitÃ¤t ignoriert .git und Fragment", () => expect(canonical("https://github.com/A/B.git#readme")).toBe("https://github.com/a/b"));
  test("Docker allein erfÃ¼llt eine Suche nach Lesezeichen nicht", () => expect(relevance({ name: "Docker Mailserver", url: "https://example.com", description: "Docker deployment" }, ["bookmark", "docker"]).score).toBe(0));
  test("Katalog-Quellcode wird als Produkt und nicht als zweiter Source-Code-Treffer gefÃ¼hrt", () => {
    const entries = markdownLinks("# Bookmarks\nProse [definition](https://example.com/definition).\n- Tool - Bookmark manager. ([Source Code](https://github.com/example/tool))", { id: "selfhosted", name: "Selfhosted", url: "https://example.com", kind: "markdown", purpose: "test" });
    expect(entries).toHaveLength(1); expect(entries[0]?.url).toBe("https://github.com/example/tool");
  });
});
describe("Kein interner Netzzugriff aus Links", () => {
  for (const url of ["http://example.com", "https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://user:pass@example.com", "https://example.com:2375", "https://printer.local"]) {
    test("blockiert " + url, () => expect(() => validatePublicUrl(url)).toThrow());
  }
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.1.1", "192.168.2.1", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "2001:db8::1"]) {
    test("blockiert IP " + address, () => expect(publicAddress(address)).toBe(false));
  }
  test("Ã¶ffentliche Adressen sind zulÃ¤ssig", () => { expect(publicAddress("1.1.1.1")).toBe(true); expect(publicAddress("2606:4700:4700::1111")).toBe(true); });
  test("Abruf lehnt private URL vor Netzwerkoperation ab", async () => { await expect(getPublic("https://127.0.0.1")).rejects.toThrow(); });
});
describe("TypabhÃ¤ngiger Startweg", () => {
  test("Node-Bibliothek wird nicht als Web-App gestartet", () => expect(inferApp({ "package.json": JSON.stringify({ name: "lib", main: "index.js" }) }, "").strategy).toBe("unsupported"));
  test("Desktop-App wird nicht an Railpack weitergegeben", () => expect(inferApp({ "package.json": JSON.stringify({ dependencies: { electron: "1" }, scripts: { start: "electron ." } }) }, "").strategy).toBe("unsupported"));
  test("Next-App bekommt Container-Strategie", () => expect(inferApp({ "package.json": JSON.stringify({ dependencies: { next: "1" }, scripts: { build: "next build", start: "next start" } }) }, "").strategy).toBe("railpack"));
  test("vorhandenes Dockerfile hat Vorrang", () => expect(inferApp({ Dockerfile: "FROM alpine\nEXPOSE 8080", "package.json": JSON.stringify({ scripts: { start: "node ." } }) }, "").strategy).toBe("dockerfile"));
  test("Git-Argumente sind keine Shellbefehle", () => expect(() => parseRepo("https://github.com/a/b;whoami")).toThrow());
  test("App-Pfadausbruch wird blockiert", () => { expect(() => normalizeRoot("../../etc")).toThrow(); expect(() => inside("C:/repo", "../../Windows")).toThrow(); });
});
describe("Compose vor AusfÃ¼hrung", () => {
  const prefix = "services:\n  app:\n    image: nginx:alpine\n";
  for (const [name, yaml] of [
    ["Docker-Socket", prefix + "    volumes: [/var/run/docker.sock:/var/run/docker.sock]\n"],
    ["Privilegiert", prefix + "    privileged: true\n"],
    ["Hostnetz", prefix + "    network_mode: host\n"],
    ["Includes", "include: /etc/compose.yaml\n" + prefix],
    ["Env-Datei", prefix + "    env_file: /home/user/.env\n"],
    ["Build-Ausbruch", "services:\n  app:\n    build: ../outside\n"],
    ["Volume-Treiber", prefix + "volumes:\n  data:\n    driver_opts: {device: /}\n"],
    ["Alias", "services:\n  app: &app\n    image: nginx\n  other: *app\n"],
    ["Doppelte SchlÃ¼ssel", prefix + "    image: attacker\n"],
  ]) test("blockiert " + name, () => expect(reviewCompose(yaml!, "compose.yaml").blockers.length).toBeGreaterThan(0));
  test("Loopback und getrennte Ports fÃ¼r gleiche Zielports", () => {
    const review = reviewCompose("services:\n  a:\n    image: nginx\n    ports: ['80:80']\n  b:\n    image: nginx\n    ports: ['81:80']\n", "compose.yaml");
    expect(review.blockers).toEqual([]);
    const runtime = runtimeCompose(review, "C:/repo", new Map([["a:80", 41000], ["b:80", 41001]]));
    expect(runtime.match(/127\.0\.0\.1/g)).toHaveLength(2); expect(runtime).toContain('"41000"'); expect(runtime).toContain('"41001"'); expect(runtime).toContain("no-new-privileges");
  });
  test("erforderliche Variablen und Defaults werden unterschieden", () => {
    const vars = extractEnv('A=${TOKEN:?required} B=${PORT:-8000} C=$${IGNORED}', "compose.yaml");
    expect(vars.find(v => v.name === "TOKEN")?.required).toBe(true); expect(vars.find(v => v.name === "PORT")?.required).toBe(false); expect(vars.find(v => v.name === "IGNORED")).toBeUndefined();
  });
  test("Start ohne erforderliches Secret bleibt vor Docker blockiert", () => expect(() => validateStart({ blockers: [], env: [{ name: "KEY", required: true }] } as unknown as Analysis, {}, 3000)).toThrow("KEY"));
  test("nackte Compose-Env-Namen werden nicht still aus dem Host Ã¼bernommen", () => {
    const result = reviewCompose("services:\n  app:\n    image: nginx\n    environment: [API_KEY]\n", "compose.yaml");
    expect(result.env.find(v => v.name === "API_KEY")?.required).toBe(true);
  });
});
describe("Sitzung und Geheimwerte", () => {
  test("Projekt-Env darf Docker-Endpunkt nicht umleiten", () => expect(() => validateEnv({ DOCKER_HOST: "tcp://attacker:2375" })).toThrow());
  test("Variablenwerte mit Newline werden abgelehnt", () => expect(() => validateEnv({ KEY: "a\nb" })).toThrow());
  test("bekannte Werte und Token werden maskiert", () => expect(redact("my-value password=hidden ghp_12345678901234567890", ["my-value"])).not.toContain("hidden"));
  test("Ã¼ber Stream-Chunks geteilte Werte gelangen nicht in Logs", async () => {
    const lines: string[] = [];
    // Cross-platform verification may use a compiled engine as its Bun interpreter.
    const env=process.env.BUN_BE_BUN==='1'?{BUN_BE_BUN:'1'}:undefined;
    const result = await command([process.execPath, "-e", "process.stdout.write('dummy-');setTimeout(()=>console.log('sensitive'),20)"], { env, secrets: ["dummy-sensitive"], log: l => lines.push(l) });
    expect(result.code).toBe(0); expect(lines.join("")).toBe("[geschÃ¼tzt]");
  });
  test("API erfordert Sitzung und verweigert fremde Origins", async () => {
    const server = createApp(0), base = `http://127.0.0.1:${server.port}`;
    try {
      expect((await fetch(base + "/api/state")).status).toBe(403);
      const page = await fetch(base), cookie = page.headers.get("set-cookie")!.split(";")[0]!;
      expect((await fetch(base + "/api/health", { headers: { cookie } })).status).toBe(200);
      expect((await fetch(base + "/api/search", { method: "POST", headers: { cookie, Origin: "https://attacker.example", "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: JSON.stringify({ input: "bookmark" }) })).status).toBe(403);
      expect((await fetch(base + "/api/start", { method: "POST", headers: { cookie, Origin: base, "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: JSON.stringify({ analysisId: "missing", port: 3000 }) })).status).toBe(400);
    } finally { await server.stop(true); }
  });
});
