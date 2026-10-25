import { validatePublicUrl } from "./public-url";
export { validatePublicUrl } from "./public-url";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  if (isIP(address) === 6) {
    // Only globally routable unicast; excludes mapped IPv4, ULA and link-local.
    return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(db8|0|2|10|20):/i.test(address);
  }
  return false;
}
export async function getPublic(value: string, options: { maxBytes?: number; timeout?: number; redirects?: number } = {}): Promise<{ body: Buffer; url: string; type: string }> {
  const url = validatePublicUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error("Lokale oder private Netzwerkadresse wurde blockiert.");
  const selected = addresses.find(a => a.family === 4) ?? addresses[0]!;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const result = await new Promise<{ body: Buffer; status: number; location?: string; type: string }>((resolve, reject) => {
    const req = request(url, {
      agent: false,
      headers: { "User-Agent": "AklikDeployer-Local/0.1 (+local research tool)", "Accept": "application/json, text/html, text/plain, */*", "Accept-Encoding": "identity" },
      // Pin the validated address. A second DNS lookup would allow rebinding.
      lookup: (_host, opts, callback) => {
        if (opts.all) (callback as unknown as (error: null, entries: typeof addresses) => void)(null, [selected]);
        else callback(null, selected.address, selected.family);
      },
    }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { req.destroy(new Error("Antwort überschreitet das Größenlimit.")); return; }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({ body: Buffer.concat(chunks), status: res.statusCode ?? 0, location: res.headers.location, type: String(res.headers["content-type"] ?? "") }));
    });
    const timer = setTimeout(() => req.destroy(new Error("Zeitlimit beim Abruf überschritten.")), options.timeout ?? 12_000);
    req.on("error", reject); req.on("close", () => clearTimeout(timer)); req.end();
  });
  if (result.status >= 300 && result.status < 400 && result.location) {
    const remaining = options.redirects ?? 3;
    if (remaining <= 0) throw new Error("Zu viele Weiterleitungen.");
    return getPublic(new URL(result.location, url).href, { ...options, redirects: remaining - 1 });
  }
  if (result.status < 200 || result.status >= 300) {
    const message = result.status === 403 || result.status === 429 ? "Zugang oder Abfragelimit; Quelle unvollständig" : "Quelle nicht abrufbar";
    throw new Error(`${message} (HTTP ${result.status}).`);
  }
  return { body: result.body, url: url.href, type: result.type };
}
export async function getJSON<T>(url: string): Promise<T> {
  return JSON.parse((await getPublic(url)).body.toString("utf8")) as T;
}
export async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await run(items[index]!); }
  }));
  return results;
}
