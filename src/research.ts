import { createHash } from "node:crypto";
import { parseRepo, inspectWebsite } from "./analyze";
import { getJSON } from "./network";
import { hasSecret, requirementChecks } from "./matching";
import { list, read, save } from "./store";
import type { Candidate, CandidateReview, Favorite, SearchResult } from "./types";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const reviewId = (candidateId: string, requirements: string[]) => hash("v2|" + candidateId + JSON.stringify(requirements));
export function findCandidate(searchId: string, candidateId: string): { candidate: Candidate; search: SearchResult } {
  const search = read<SearchResult>("search", searchId);
  const candidate = search?.candidates.find(c => c.id === candidateId);
  if (!search || !candidate) throw new Error("Kandidat in dieser Recherche nicht gefunden. Recherche erneut öffnen.");
  return { candidate, search };
}
export async function reviewCandidate(searchId: string, candidateId: string): Promise<CandidateReview> {
  const { candidate, search } = findCandidate(searchId, candidateId);
  const requirements = search.profile.requirements ?? [];
  const id = reviewId(candidateId, requirements);
  const cached = read<CandidateReview>("review", id);
  if (cached && Date.now() - Date.parse(cached.checkedAt) < 6 * 3600_000) return { ...cached, cached: true };
  const result: CandidateReview = { id, candidateId, title: candidate.name, url: candidate.url, checkedAt: new Date().toISOString(), checks: [], evidence: [], cautions: ["Textstellen sind Hinweise. Funktionen, Datenschutz, Anmeldung und vollständige Betriebskosten bleiben praktisch zu prüfen."] };
  const documents: { text: string; url: string }[] = [];
  if (candidate.kind === "repository") {
    const repo = parseRepo(candidate.url), api = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;
    const metaId = hash(repo.url);
    type Meta = { full_name: string; license: { spdx_id: string } | null; pushed_at: string; archived: boolean; description: string; topics?: string[] };
    const old = read<{ id: string; at: number; value: Meta }>("repo-metadata", metaId);
    const meta = old && Date.now() - old.at < 6 * 3600_000 ? old.value : await getJSON<Meta>(api);
    if (meta !== old?.value) save("repo-metadata", { id: metaId, at: Date.now(), value: meta });
    result.title = meta.full_name; result.license = meta.license?.spdx_id; result.updated = meta.pushed_at; result.archived = meta.archived;
    const metadataText = `${meta.description ?? ""}\n${(meta.topics ?? []).join(" ")}`;
    result.evidence.push({ label: "Original-Repository: Metadaten", url: repo.url, text: `Lizenz: ${result.license ?? "unbekannt"}; archiviert: ${meta.archived ? "ja" : "nein"}; letzte Code-Aktivität: ${meta.pushed_at}. Metadaten höchstens sechs Stunden zwischengespeichert.`, checkedAt: result.checkedAt });
    if (meta.archived) result.cautions.push("Repository ist archiviert. Keinen automatischen Start empfehlen.");
    try {
      type Readme = { content: string; encoding: string; sha: string; html_url: string; size: number; path: string };
      const oldReadme = read<{ id: string; at: number; value: Readme }>("repo-readme", metaId);
      const doc = oldReadme && Date.now() - oldReadme.at < 6 * 3600_000 ? oldReadme.value : await getJSON<Readme>(api + "/readme");
      if (doc.encoding !== "base64" || doc.size > 120_000 || !/^[a-f0-9]{40,64}$/.test(doc.sha)) throw new Error("README überschreitet die begrenzte Textprüfung oder hat ein nicht unterstütztes Format.");
      if (doc !== oldReadme?.value) save("repo-readme", { id: metaId, at: Date.now(), value: doc });
      const text = Buffer.from(doc.content, "base64").toString("utf8");
      result.readmeSha = doc.sha;
      const original = /^https:\/\/github\.com\//.test(doc.html_url) ? doc.html_url : repo.url;
      documents.push({ text, url: original });
      result.evidence.push({ label: `README · Datei-SHA ${doc.sha.slice(0, 12)}`, url: original, text: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 750), checkedAt: result.checkedAt });
    } catch (e) { result.cautions.push("README-Prüfung unvollständig: " + (e as Error).message); }
    documents.push({ text: metadataText, url: repo.url });
  } else {
    const website = await inspectWebsite(candidate.url);
    result.title = website.title || candidate.name;
    documents.push(...website.evidence);
    result.evidence.push(...website.evidence.map(e => ({ ...e, label: "Original-Angebot / Tarifhinweis", checkedAt: result.checkedAt })));
  }
  result.checks = requirementChecks(requirements, documents);
  const paymentLines = documents.flatMap(d => d.text.split(/\n|(?<=[.!?])\s+/).filter(l => /(?:credit card|kreditkarte|paid plan|subscription|free trial|free tier|pricing|paid api|openai api key|requires.*api.?key)/i.test(l)).slice(0, 3).map(l => ({ label: "Kosten-/Diensthinweis · kein bestätigter Tarif", url: d.url, text: l.replace(/\s+/g, " ").slice(0, 500), checkedAt: result.checkedAt })));
  result.evidence.push(...paymentLines.slice(0, 4));
  if (!paymentLines.length) result.cautions.push("Keine eindeutige Kostenstelle in den gelesenen Texten gefunden. Daraus folgt keine Gratiszusage.");
  return save("review", result);
}
export function favorites(includeHidden = false): Favorite[] { return list<Favorite>("favorite", 500).filter(f => includeHidden || !f.hidden); }
export function saveFavorite(searchId: string, candidateId: string): Favorite {
  const { candidate, search } = findCandidate(searchId, candidateId), id = hash(candidate.id);
  const old = read<Favorite>("favorite", id);
  if (!old && favorites(true).length >= 500) throw new Error("Die Merkliste ist auf 500 Einträge begrenzt.");
  return save("favorite", { id, testOnly: search.testOnly, candidate, searchId, notes: old?.notes ?? "", createdAt: old?.createdAt ?? new Date().toISOString(), hidden: false });
}
export function updateFavorite(id: string, notes?: unknown, hidden?: unknown): Favorite {
  const item = read<Favorite>("favorite", id); if (!item) throw new Error("Merkeintrag nicht gefunden.");
  if (notes !== undefined) {
    if (typeof notes !== "string" || notes.length > 2000 || hasSecret(notes)) throw new Error("Notiz: höchstens 2000 Zeichen und keine Geheimwerte.");
    item.notes = notes;
  }
  if (hidden !== undefined) { if (typeof hidden !== "boolean") throw new Error("Ungültiger Archivstatus."); item.hidden = hidden; }
  return save("favorite", item);
}
const plain = (value: string) => value.replace(/[\r\n|<>]/g, " ").replace(/[\[\]*_`]/g, "");
export function reviewsFor(search: SearchResult): CandidateReview[] {
  return search.candidates.map(candidate => read<CandidateReview>("review", reviewId(candidate.id, search.profile.requirements ?? []))).filter((r): r is CandidateReview => !!r);
}
export function exportResearch(search: SearchResult): string {
  const reviews = reviewsFor(search);
  const lines = [`# aKlik-Deployer-Recherche: ${plain(search.profile.title)}`, `Stand: ${search.createdAt}`, "", `Bedarf: ${plain(search.profile.original)}`, `Merkmale: ${(search.profile.requirements ?? []).map(plain).join(", ") || "keine zusätzlichen Angaben"}`, "", "Suchhinweise sind keine bestätigte Funktions- oder Gratiszusage.", ""];
  for (const candidate of search.candidates) {
    lines.push(`## ${plain(candidate.name)}`, `<${candidate.url}>`, plain(candidate.description), `Lizenzangabe: ${plain(candidate.license ?? "offen")}${candidate.licenseSource ? " · " + plain(candidate.licenseSource) : ""}`, `Typ: ${candidate.fit?.type ?? "ungeprüft"}`, "");
    for (const check of candidate.fit?.checks ?? []) lines.push(`- ${plain(check.requirement)}: ${check.status === "hint" ? "Texthinweis, praktisch ungeprüft" : check.status === "conflict" ? "Gegenhinweis" : "offen"}${check.excerpt ? " · " + plain(check.excerpt) : ""}`);
    for (const proof of candidate.evidence) lines.push(`- Quelle: ${plain(proof.label)} <${proof.url}> · ${proof.checkedAt}`);
    const review = reviews.find(r => r.candidateId === candidate.id);
    if (review) {
      lines.push("", `### Originalprüfung vom ${review.checkedAt}`);
      for (const check of review.checks) lines.push(`- ${plain(check.requirement)}: ${check.status === "hint" ? "Texthinweis, praktisch ungeprüft" : check.status === "conflict" ? "Möglicher Gegenhinweis" : "offen"}${check.excerpt ? " · " + plain(check.excerpt) : ""}${check.url ? " <" + check.url + ">" : ""}`);
      for (const proof of review.evidence) lines.push(`- ${plain(proof.label)}: ${plain(proof.text)} <${proof.url}>`);
      for (const caution of review.cautions) lines.push(`- Offen: ${plain(caution)}`);
    }
    lines.push("");
  }
  lines.push("## Suchabdeckung", "");
  for (const source of search.coverage) lines.push(`- ${plain(source.name)}: ${source.status}; ${source.count} Einträge/Treffer; ${source.checkedAt}. ${plain(source.detail)} <${source.url}>`);
  lines.push("", "## Quellenrechte", "Katalogtexte behalten ihre jeweilige Quellenlizenz. Awesome Selfhosted: CC-BY-SA-3.0, Autoren und Mitwirkende. Open SaaS Directory: MIT, Copyright 2026 Open SaaS Directory. Weitere Hinweise: THIRD_PARTY_NOTICES.md.");
  return lines.join("\n");
}
