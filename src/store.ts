import { Database } from "bun:sqlite";
import { mkdirSync,existsSync } from "node:fs";
import { resolve } from "node:path";

export const DATA = process.env.AKLIK_DEPLOYER_DATA_DIR ? resolve(process.env.AKLIK_DEPLOYER_DATA_DIR) : resolve(import.meta.dir, "../.data");
mkdirSync(DATA, { recursive: true });
const dbPath=resolve(DATA,'aklik-deployer.sqlite'),previousPath=resolve(DATA,['one','clicker.sqlite'].join(''));
const db = new Database(!existsSync(dbPath)&&existsSync(previousPath)?previousPath:dbPath, { create: true });
db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(kind,id))");
export function save<T extends { id: string }>(kind: string, value: T): T {
  db.query("INSERT OR REPLACE INTO records VALUES (?, ?, ?, ?)").run(kind, value.id, JSON.stringify(value), new Date().toISOString());
  return value;
}
export function read<T>(kind: string, id: string): T | undefined {
  const row = db.query("SELECT payload FROM records WHERE kind=? AND id=?").get(kind, id) as { payload: string } | null;
  return row ? JSON.parse(row.payload) as T : undefined;
}
export function list<T>(kind: string, limit = 25): T[] {
  return (db.query("SELECT payload FROM records WHERE kind=? ORDER BY updated DESC LIMIT ?").all(kind, limit) as { payload: string }[]).map(r => JSON.parse(r.payload) as T);
}
