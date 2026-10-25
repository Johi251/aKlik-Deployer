import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { assessCandidate, hasSecret, requirementChecks, searchOptions } from "../src/matching";
import { canonical, makeProfile, markdownLinks, mergeCandidates, relevance } from "../src/search";
import { exportResearch } from "../src/research";
import { visibleWebsiteText } from "../src/analyze";
import { explainError } from "../src/diagnostics";
import { createApp } from "../src/server";
import { save } from "../src/store";
import type { Candidate, Favorite, SearchResult } from "../src/types";

function candidate(name = "Bookmark App", description = "Self-hosted bookmark manager with Docker import and export"): Candidate {
  return { id: "https://github.com/fixture/" + randomUUID(), name, url: "https://github.com/fixture/" + randomUUID(), description, sources: ["github"], score: 20, reasons: [], kind: "repository", cost: "oss", license: "MIT", evidence: [] };
}
describe("Bedarf, Rangfolge und Beleggrenzen", () => {
  test("Docker am Satzanfang verdrängt den eigentlichen Bedarf nicht", () => expect(makeProfile("Docker für eine Lesezeichen Verwaltung").githubQuery).toBe("bookmark"));
  test("Produktnamen liefern passende Suchkategorien", () => { expect(makeProfile("Alternative zu Trello").terms).toContain("kanban"); expect(makeProfile("Alternative zu Notion").terms).toContain("notes"); });
  test("Produktlink selbst löst keine falschen Kategorien aus", () => expect(makeProfile("https://mychat.example/notebooks").terms).toHaveLength(0));
  test("Synonyme der Hauptkategorie werden akzeptiert, Docker allein nicht", () => { expect(relevance({ name: "Billing manager", url: "https://example.com", description: "Billing software" }, ["invoice", "billing", "docker"]).score).toBeGreaterThan(0); expect(relevance({ name: "Docker manager", url: "https://example.com", description: "deployment" }, ["invoice", "billing", "docker"]).score).toBe(0); });
  test("Nicht-GitHub-Pfade bleiben groß-/kleinschreibungsabhängig", () => expect(canonical("https://example.com/MyApp")).not.toBe(canonical("https://example.com/myapp")));
  test("README-Erwähnung ist ein Hinweis und kein Erfolgsbeweis", () => { const result = requirementChecks(["Docker", "Deutsch"], [{ text: "Install this app with Docker. Export your data.", url: "https://example.com/readme" }]); expect(result[0]?.status).toBe("hint"); expect(result[0]?.url).toContain("readme"); expect(result[1]?.status).toBe("unknown"); });
  test("Explizite Nichtunterstützung erzeugt Gegenhinweis", () => expect(requirementChecks(["Windows"], [{ text: "This app does not support Windows.", url: "https://example.com" }])[0]?.status).toBe("conflict"));
  test("Unbekannte Merkmale werden nicht als widerlegt behandelt", () => expect(requirementChecks(["Offline"], [])[0]?.status).toBe("unknown"));
  test("Namensherkunft ist kein Hinweis auf eine deutsche Oberfläche", () => expect(requirementChecks(["Deutsch"], [{ text: "Ding is German for thing.", url: "https://example.com" }])[0]?.status).toBe("unknown"));
  test("Wortteile wie important und capital gelten nicht als Import oder API", () => { const checks = requirementChecks(["Import", "API"], [{ text: "Important capital information", url: "https://example.com" }]); expect(checks.every(c => c.status === "unknown")).toBe(true); });
  test("Docker-Suche bevorzugt App gegenüber Bibliothek", () => { const p = makeProfile("Lesezeichen mit Docker"); expect(assessCandidate(candidate(), p).score).toBeGreaterThan(assessCandidate(candidate("Bookmark library", "A library for reading bookmark files"), p).score); });
  test("Erweiterungen werden als eigener Projekttyp ausgewiesen", () => expect(assessCandidate(candidate("Bookmarks", "Cross-browser bookmarks manager"), makeProfile("Lesezeichen")).fit?.type).toBe("Browser-Erweiterung"));
  test("Ausschlüsse werden auf zusammengeführte Kandidaten angewendet", () => expect(mergeCandidates([candidate("Bookmark WordPress")], makeProfile("bookmark", true, false, { excluded: ["WordPress"] }))).toHaveLength(0));
  test("Archivierung ist ein sichtbarer negativer Faktor", () => { const c = candidate(); expect(assessCandidate({ ...c, archived: true }, makeProfile("bookmark")).score).toBeLessThan(assessCandidate(c, makeProfile("bookmark")).score); });
  test("Kataloglizenz und Plattform bleiben zuordenbar", () => { const entries = markdownLinks("# Bookmarks\n- [Alpha](https://example.com) - Bookmark app. ([Source Code](https://github.com/a/b)) `MIT` `Go/Docker`", { id: "selfhosted", name: "Awesome", url: "https://example.org", kind: "markdown", purpose: "fixture" }); expect(entries[0]?.license).toBe("MIT"); expect(entries[0]?.platforms).toContain("Docker"); });
  test("Mehrzeilige SaaS-Liste liest die Produktbeschreibung statt Badges", () => { const entries = markdownLinks("### [Alpha](https://github.com/a/b)\n[![Stars](https://shields.io/a)](https://github.com/a/b/stargazers)\nA note editor.\n**Alternative to:** Notion", { id: "saas-alternatives", name: "Alternatives", url: "https://example.org", kind: "markdown", purpose: "fixture" }); expect(entries).toHaveLength(1); expect(entries[0]?.description).toContain("Notion"); });
});
describe("Eingaben, Exporte und Hilfestellung", () => {
  test("Suchoptionen begrenzen Größe und Werte", () => { expect(() => searchOptions({ target: "exec" })).toThrow(); expect(() => searchOptions({ requirements: Array(9).fill("x") })).toThrow(); expect(() => searchOptions({ requirements: "Docker" })).toThrow(); });
  test("Geheimwertmuster in Notizen und Merkmalen werden erkannt", () => { expect(hasSecret("api_key=example-secret-value")).toBe(true); expect(() => searchOptions({ requirements: ["password=example-secret"] })).toThrow(); });
  test("Script- und Style-Inhalt wird aus Seitentext entfernt", async () => { const text = await visibleWebsiteText("<html><body><script>const price='paid';</script><style>.paid{}</style><main>Free plan. No credit card.</main></body></html>"); expect(text).toContain("Free plan"); expect(text).not.toContain("const price"); expect(text).not.toContain(".paid"); });
  test("Abfragelimit bekommt eine passende Anleitung", () => expect(explainError("HTTP 429")).toContain("später"));
});
describe("Lokale Recherche-API", () => {
  test("Merken, Notiz, Archivieren/Wiederherstellen, Export und Zugriffsschutz", async () => {
    const c = candidate(), fixture: SearchResult = { id: randomUUID(), testOnly: true, createdAt: new Date().toISOString(), profile: makeProfile("bookmark", true, false, { requirements: ["Docker"] }), candidates: [c], coverage: [], recommendation: "fixture" };
    save("search", fixture);
    const server = createApp(0), base = `http://127.0.0.1:${server.port}`;
    try {
      const page = await fetch(base), cookie = page.headers.get("set-cookie")!.split(";")[0]!;
      const post = (path: string, body: unknown, origin = base) => fetch(base + path, { method: "POST", headers: { cookie, Origin: origin, "Content-Type": "application/json", "X-Aklik-Deployer": "1" }, body: JSON.stringify(body) });
      const favoriteResponse = await post("/api/favorite", { searchId: fixture.id, candidateId: c.id }); expect(favoriteResponse.status).toBe(200);
      const f = await favoriteResponse.json() as Favorite;
      const note = await post("/api/favorite/update", { id: f.id, notes: "API-Nachweis", hidden: true }); expect((await note.json() as Favorite).hidden).toBe(true);
      const restore = await post("/api/favorite/update", { id: f.id, hidden: false }); const restored = await restore.json() as Favorite; expect(restored.notes).toBe("API-Nachweis"); expect(restored.hidden).toBe(false);
      expect((await post("/api/favorite/update", { id: f.id, notes: "password=example-secret" })).status).toBe(400);
      expect((await post("/api/favorite/update", { id: f.id, notes: "attack" }, "https://evil.example")).status).toBe(403);
      expect((await post("/api/favorite", { searchId: fixture.id, candidateId: "untrusted" })).status).toBe(400);
      expect((await post("/api/review", { searchId: "unknown", candidateId: c.id })).status).toBe(400);
      const md = await fetch(`${base}/api/export?id=${fixture.id}&format=md`, { headers: { cookie } }); expect(md.headers.get("content-disposition")).toContain("attachment"); expect(await md.text()).toContain("keine bestätigte Funktions");
      const json = await fetch(`${base}/api/export?id=${fixture.id}&format=json`, { headers: { cookie } }); expect((await json.json() as SearchResult).candidates).toHaveLength(1);
      expect((await fetch(`${base}/api/export?id=${fixture.id}&format=json`)).status).toBe(403);
      expect((await fetch(`${base}/api/export?id=../../etc&format=json`, { headers: { cookie } })).status).toBe(400);
      const state = await (await fetch(base + "/api/state", { headers: { cookie } })).json() as { searches: SearchResult[]; favorites: Favorite[] }; expect(state.searches.some(s => s.id === fixture.id)).toBe(false); expect(state.favorites.some(s => s.id === f.id)).toBe(false);
      expect(exportResearch(fixture)).toContain("Quellenrechte");
    } finally { server.stop(true); }
  });
});
