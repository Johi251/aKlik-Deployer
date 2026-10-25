# aKlik-Deployer 0.9.0 — öffentlich, verbunden und herunterladbar

Stand: 25.10.2026. Öffentliche Adresse: https://aklik-deployer-werkzeugkasten.bonnydace1.chatgpt.site/

Die Sites-Zugriffsrichtlinie wurde auf public gesetzt und der Abruf ohne Anmeldung mit HTTP 200 geprüft. Ein Umzug zu GitHub Pages ist dafür nicht nötig. Die neue Ausgabe wird über dieselbe Adresse veröffentlicht.

## Direkt verwenden

- Web-App: Hauptadresse; Apps & Lesezeichen öffnet Downloads und Installationshinweise.
- Verbundener Manager: /bookmarks/ auf derselben Adresse. JSON-Export aus dem bisherigen GitHub-Pages-Manager importieren. Browser-Speicher verschiedener Ursprünge wird nicht automatisch zusammengeführt.
- Browser: normale Lesezeichen oder importierbare HTML-Datei; installierbare PWA in unterstützten Browsern.
- Erweiterungen: ZIP für Chrome/Edge/Brave zum Entpacken und Laden im Entwicklermodus; Firefox als temporäres Test-Add-on. Keine signierten Store-Versionen.
- Windows x64: portable, nicht signierte aKlik-Deployer.exe mit eingebauter Bun-Laufzeit und beiden Oberflächen. Startet ausschließlich auf 127.0.0.1:43119, Daten unter LOCALAPPDATA/aKlik-Deployer. Recherche braucht Internet; Docker-Funktionen zusätzlich Docker. Fenster schließen beendet den Server. Kein Autostart.

Der Windows-Download wird aus geprüften Teil-Dateien im Browser zusammengesetzt; jede Teil-Datei hat SHA-256 und Größenangabe. Der Build enthält keine Benutzer-Sammlung und keinen API-Schlüssel.

## Was die Linkstatus belegen

Grün „Online öffnen“: ein vorhandener Browserzugang aus dem kuratierten Projektkatalog mit Gratisbeleg. Das ist kein neu ausgeführtes Deployment und kein vollständiger Funktionstest. Blau „PC-Download“: erkannte Open-Source-Lizenz plus offizieller Windows-Release; vollständiger Offline-Betrieb und Ein-Klick-Installation sind damit noch nicht praktisch geprüft. Rot „Noch prüfen“: ungenügende Belege. „Wird geprüft“: aktuell laufender Abruf. Abgelaufene Berichte erscheinen als „Erneut prüfen“.

Beschreibungen kommen automatisch aus Projektmetadaten oder dem belegten Katalog. Andere Webseiten können auf Wunsch über Microlink ergänzt werden: öffentliche URL wird an diesen Anbieter gesendet, maximal 20 Abrufe pro Tag im lokalen Budget. Laut https://microlink.io/pricing umfasst dessen Free-Angebot 25 Abrufe/Tag; der Anbieter kann früher begrenzen. Keine bezahlte API und keine Modellinferenz werden automatisch aktiviert. Ohne Metadaten bleibt die Beschreibung ausdrücklich vorläufig aus Titel und URL.

## Zusammenarbeit und zusätzliche Funktionen

Der Manager prüft seriell bis zu acht Links pro Durchlauf, während er geöffnet ist. Pause, weitere acht Prüfungen und einzelne Wiederholungen sind verfügbar. Ergebnisse gelten sieben Tage und werden zwischen den beiden Web-Oberflächen auf demselben Ursprung geteilt. Ein tatsächliches Repository-Analyseergebnis in aKlik-Deployer aktualisiert den gemeinsam gelesenen Bericht. Erweiterungen besitzen einen eigenen Browser-Ursprung und ihre eigene lokale Sammlung; ihr Prüf-Link öffnet die öffentliche aKlik-Deployer-Seite, ohne eine automatische Rückübertragung zu behaupten.

API-Schlüssel liegen im Manager getrennt vom exportierbaren Zustand. Die neue Verbindung überträgt nur geprüfte öffentliche URLs. Private Adressen, aktive URL-Schemata und erkannte Geheimwerte werden abgewiesen. Statusbelege werden beim Import erneut validiert. Ausklappbare Details nennen Quelle, Datum und Grenzen und achten reduzierte Bewegung sowie Tastaturbedienung.

Das ursprüngliche GitHub-Pages-Projekt wurde nicht verändert und nichts zu GitHub gepusht. Die verbundene Ausgabe und ihr Quellcode liegen zusätzlich im aKlik-Deployer-Quellpaket. Die ursprünglichen Funktionen des Managers bleiben erhalten.

## Prüfumfang

TypeScript, Funktions- und DOM-Tests, echte Remotion-Player-Szenenwechsel, Manager-Logik, zugängliche Detailansicht, Service-Worker-Cachetrennung, Windows-EXE-Selbsttest und Artefaktprüfsummen werden lokal geprüft. Der EXE-Selbsttest ruft keine externen Dienste ab. Eine gerenderte optische Desktop-/Mobilprüfung ist wegen des nicht verfügbaren Browseradapters offen. Store-Installation der Add-ons, Windows-Signatur und fachliche Volltests beliebiger Fremdprojekte werden nicht behauptet.
