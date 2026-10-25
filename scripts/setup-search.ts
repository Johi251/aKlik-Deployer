import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import { DATA } from "../src/store";
import { command, must } from "../src/process";
import { toolsStatus } from "../src/runtime";

const status = await toolsStatus(); if (!status.docker) throw new Error(status.detail);
const directory = join(DATA, "search"), config = join(directory, "config"), pin = Bun.file(join(directory, "image.json"));
await mkdir(config, { recursive: true });
const settings = Bun.file(join(config, "settings.yml"));
if (!await settings.exists()) await Bun.write(settings, stringify({
  use_default_settings: { engines: { keep_only: ["bing", "brave", "google", "duckduckgo"] } },
  general: { instance_name: "aKlik-Deployer lokale Websuche" },
  search: { formats: ["html", "json"] },
  server: { secret_key: randomBytes(32).toString("hex"), limiter: false, image_proxy: false, bind_address: "0.0.0.0", port: 8080 },
  outgoing: { request_timeout: 8.0, max_request_timeout: 12.0 },
}));
const found = await command(["docker", "container", "inspect", "aklik-deployer-search"]);
if (found.code === 0) {
  const details = JSON.parse(found.stdout)[0];
  if (details.Config?.Labels?.["io.aklik-deployer.service"] !== "search") throw new Error("Containername wird von einem anderen Projekt verwendet. Nichts verändert.");
  await must(["docker", "start", "aklik-deployer-search"]);
} else {
  let image: string;
  if (await pin.exists()) image = (await pin.json()).image;
  else {
    console.log("Lade den offiziellen SearXNG-Container. Keine kostenpflichtige Such-API.");
    await must(["docker", "pull", "docker.io/searxng/searxng:latest"], { timeout: 240_000, log: console.log });
    const images = JSON.parse(await must(["docker", "image", "inspect", "docker.io/searxng/searxng:latest"]));
    image = images[0]?.RepoDigests?.[0];
    if (!image || !/^searxng\/searxng@sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Kein eindeutiger offizieller Image-Digest verfügbar.");
    await Bun.write(pin, JSON.stringify({ image, checkedAt: new Date().toISOString(), source: "https://docs.searxng.org/admin/installation-docker.html" }, null, 2));
  }
  if (!/^searxng\/searxng@sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Ungültiger Image-Pin.");
  await must(["docker", "run", "--detach", "--name", "aklik-deployer-search", "--label", "io.aklik-deployer.service=search", "--publish", "127.0.0.1:43111:8080", "--mount", `type=bind,source=${config},target=/etc/searxng`, "--memory", "512m", "--cpus", "1", "--pids-limit", "256", "--security-opt", "no-new-privileges:true", image]);
}
for (let i = 0; i < 20; i++) {
  try { const response = await fetch("http://127.0.0.1:43111/healthz", { signal: AbortSignal.timeout(1500) }); if (response.ok) { console.log("Lokale Websuche bereit: 127.0.0.1:43111 (SearXNG)."); process.exit(0); } } catch { /* service starting */ }
  await Bun.sleep(1000);
}
throw new Error("Suchcontainer gestartet, aber noch nicht erreichbar. docker logs aklik-deployer-search prüfen.");
