export function childEnvironment(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "HOME", "LOCALAPPDATA", "APPDATA", "ProgramFiles", "ProgramData"]) {
    const value = process.env[key]; if (value !== undefined) env[key] = value;
  }
  return { ...env, ...extra };
}
export function redact(text: string, secrets: string[] = []): string {
  for (const secret of [...secrets].filter(s => s.length > 0).sort((a, b) => b.length - a.length)) text = text.split(secret).join("[geschützt]");
  return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/(?:gh[pousr]_[A-Za-z0-9]{15,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,})/g, "[geschützt]")
    .replace(/((?:password|api[_-]?key|secret|token)\s*[=:]\s*)[^\s,;]+/gi, "$1[geschützt]");
}
export function validateEnv(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  if (entries.length > 40) throw new Error("Höchstens 40 Umgebungsvariablen sind erlaubt.");
  const result: Record<string, string> = Object.create(null);
  for (const [key, val] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(key) || /^(DOCKER|COMPOSE|GIT|BUN|NODE_OPTIONS|LD_|DYLD_|PATH$|HOME$|USERPROFILE$|SYSTEMROOT$|COMSPEC$)/i.test(key) || typeof val !== "string" || val.length > 8000 || /[\x00\r\n]/.test(val)) throw new Error("Ungültiger oder für die Steuerung reservierter Variablenname/-wert.");
    if (val) result[key] = val;
  }
  return result;
}
export interface CommandResult { code: number; stdout: string; stderr: string }
export async function command(args: string[], options: { cwd?: string; env?: Record<string, string>; timeout?: number; log?: (line: string) => void; secrets?: string[]; maxOutput?: number } = {}): Promise<CommandResult> {
  if (!args.length || args.some(s => s.includes("\0"))) throw new Error("Ungültiger Prozessaufruf.");
  const proc = Bun.spawn(args, { cwd: options.cwd, env: childEnvironment(options.env), stdout: "pipe", stderr: "pipe", stdin: "ignore", windowsHide: true });
  let timedOut = false, overflow = false;
  const timer = setTimeout(() => { timedOut = true; proc.kill(); }, options.timeout ?? 30_000);
  const max = options.maxOutput ?? 3_000_000;
  async function consume(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader(), decoder = new TextDecoder(); let text = "", pending = "";
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      const chunk = decoder.decode(value, { stream: true }); text += chunk; pending += chunk;
      if (text.length > max || pending.length > 100_000) { overflow = true; proc.kill(); break; }
      const lines = pending.split(/\r?\n|\r/); pending = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) options.log?.(redact(line, options.secrets));
    }
    pending += decoder.decode();
    if (pending.trim()) options.log?.(redact(pending, options.secrets));
    return text;
  }
  try {
    const [stdout, stderr, code] = await Promise.all([consume(proc.stdout), consume(proc.stderr), proc.exited]);
    if (timedOut) throw new Error("Prozesszeitlimit überschritten. Laufzeitstatus prüfen; gestartete Container werden nicht automatisch gelöscht.");
    if (overflow) throw new Error("Prozessausgabe überschreitet das Limit.");
    return { code, stdout, stderr };
  } finally { clearTimeout(timer); }
}
export async function must(args: string[], options: Parameters<typeof command>[1] = {}): Promise<string> {
  const result = await command(args, options);
  if (result.code !== 0) throw new Error(`Schritt ${args[0]?.split(/[\\/]/).at(-1)} ${args[1] ?? ""} fehlgeschlagen (Exit ${result.code}). ${redact((result.stderr || result.stdout).slice(-2000), options.secrets)}`);
  return result.stdout;
}
