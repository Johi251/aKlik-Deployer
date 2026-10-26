# aKlik-Deployer 1.1.0 – Funktionsumfang und Prüfgrenzen

Stand: 26.10.2026. Diese Datei beschreibt den unterstützten Umfang, nicht die Garantie,
dass jedes beliebige Repository kostenlos oder automatisch startbar ist.

| Anforderung | Umsetzung | Grenze / Nachweis |
| --- | --- | --- |
| Neues Branding und Kobalt-Dashboard | umgesetzt | alte Namen nur für ausdrückliche Kompatibilität mit fremden Startskripten und bestehenden Daten |
| Repositorys statisch prüfen | umgesetzt | GitHub, GitLab und Hugging-Face-Spaces in der Status-Bridge; kein fremder Code während des Scans |
| Grüne / blaue / orange Statusmeldungen | umgesetzt | grün verlangt erreichbare Demo und OSS-Basis; blau ist ein Startsignal, kein bereits laufendes Projekt |
| Lokale Ein-Klick-Bereitstellung | im unterstützten Umfang umgesetzt | geschützte GitHub-Startpläne über Docker, Compose oder Railpack; Pflichtwerte, Lizenz und Blocker werden erneut geprüft |
| Beliebige Host-Startskripte ausführen | bewusst begrenzt | ein erkanntes Skript ist kein Auftrag, es ungeprüft auf dem Rechner auszuführen |
| Web-App auf GitHub | neuer Pages-Workflow und Projektpfad | persönliche Demo; kommerzieller Einstieg bleibt Cloudflare |
| Windows-EXE und Mac-App | native plattformspezifische Builds | Engine-Selbsttests auf den Buildsystemen; interaktive Bedienung ist ein eigener Nachweis |
| Browser-Erweiterungen | sechs Browserpakete | Chrome, Edge, Brave, Opera, Vivaldi, Firefox; Firefox temporär, keine Store-Veröffentlichung |
| Suche, Vergleich, Merkliste und Export | vorhanden und durch Regressionstests abgedeckt | neue externe Recherche braucht Internet, Quellen haben eigene Limits |
| KI-Modellplanung / Agenten-Startpaket | vorhanden | Modellzugang und tatsächliche Inferenz sind separat einzurichten |
| Startbereitschaft je Funktion | neu in 1.1.0 | Recherche bleibt verfügbar, wenn Docker fehlt; Tools ersetzen keinen einzelnen Startplan |
| Datensparsamer Prüfbericht | neu in 1.1.0 | nur Version und Status; keine rohen Logs, Dateipfade, Repository-Links, Projekte oder Schlüssel |
| Passende Pakete statt alter Installer | gehärtet | Paketierung benötigt für jede enthaltene Plattform einen passenden Engine-Nachweis |

## Prüfstrategie

- Typprüfung und vollständige Regressionstests.
- Reale lokale HTTP-Prüfung von Diagnose, Sitzungsschutz, Versionsmeldung und Bridge.
- Web-Build und Download-Integrität sowohl für `/` als auch `/aKlik-Deployer/`.
- Native Builds samt Engine-Selbsttest unter Windows, macOS Intel, macOS Apple Silicon und Linux.
- Prüfung des Gesamt-ZIPs und seiner SHA256-Dateien vor Veröffentlichung.

Die visuelle Browsersteuerung wurde zuvor automatisch gestoppt, weil die Windows-
Browseradresse nicht zuverlässig erkannt wurde. Ein zusätzlicher visueller Nachweis wird
deshalb nicht behauptet. Auch Engine-Selbsttests bestätigen keine vollständige native
Fensterbedienung. Windows-Builds sind unsigniert, Mac-Builds nicht notarisiert.

Der genaue ausführbare Prüfstand liegt mit Versions- und Hash-Nachweisen im Release
und den beigefügten Engine-Berichten. Der öffentliche Quellcode enthält keine privaten
Laufzeitdaten; die Lizenzhinweise aller Fremdkomponenten bleiben maßgeblich.
