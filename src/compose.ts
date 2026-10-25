import { stringify } from "yaml";
import { isAbsolute, relative, resolve } from "node:path";
import type { ComposeReview } from "./compose-review";
export * from "./compose-review";
export function inside(base: string, path: string): string {
  const target = resolve(base, path), rel = relative(base, target);
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel)) throw new Error("Pfad verlässt das Projektverzeichnis.");
  return target;
}
export function runtimeCompose(review: ComposeReview, sourceRoot: string, ports: Map<string, number>): string {
  if (review.blockers.length || !review.model) throw new Error("Compose-Konfiguration ist nicht freigegeben.");
  const model = structuredClone(review.model);
  delete model.name; delete model.version;
  for (const [name, svc] of Object.entries(model.services) as [string, Record<string, any>][]) {
    svc.mem_limit = "1g"; svc.cpus = 1; svc.pids_limit = 256;
    svc.init ??= true;
    svc.security_opt = ["no-new-privileges:true"];
    if (svc.build) {
      const build = typeof svc.build === "string" ? { context: svc.build } : svc.build;
      svc.build = { ...build, context: inside(sourceRoot, build.context ?? ".") };
    }
    svc.ports = (svc.ports ?? []).map((raw: unknown) => {
      const obj = raw && typeof raw === "object" ? raw as Record<string, any> : undefined;
      const target = Number(obj ? obj.target : String(raw).split(":").at(-1)?.split("/")[0]);
      const protocol = obj?.protocol ?? String(raw).split("/")[1] ?? "tcp";
      if (!["tcp", "udp"].includes(protocol)) throw new Error("Nicht unterstütztes Portprotokoll.");
      const published = ports.get(`${name}:${target}`);
      if (!published) throw new Error("Lokaler Port wurde nicht zugeteilt.");
      return { target, published: String(published), host_ip: "127.0.0.1", protocol };
    });
  }
  return stringify(model);
}
