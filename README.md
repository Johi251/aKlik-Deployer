# aKlik-Deployer · 1.1.0

## Aktuelle Version · 26.10.2026

- **GitHub-Web-Demo:** https://johi251.github.io/aKlik-Deployer/
- **Cloudflare-Web-App:** https://aklik-deployer.pages.dev/
- **Downloads:** https://github.com/Johi251/aKlik-Deployer/releases/latest
- **Handbuch:** [PDF](docs/Benutzerhandbuch.pdf), [offline HTML](docs/Benutzerhandbuch.html), [Markdown](docs/Benutzerhandbuch.md).

Neu: „Diagnose & Hilfe“ zeigt die Startbereitschaft für Recherche, Containerstarts,
Quellcode-Builds und die Browser-Erweiterung getrennt an. Ein fehlendes Docker sperrt
die Recherche nicht. Der herunterladbare Prüfbericht enthält Version und Status,
keine rohen Logs, Dateipfade, Repository-Links, Projekte oder Schlüssel.

Windows: Gesamtpaket entpacken und START-AKLIK.cmd für die portable EXE öffnen.
Für ein eigenes Programmfenster den enthaltenen Windows-Installer verwenden.
Mac: aarch64-DMG für Apple Silicon, x64-DMG für Intel. Jeweils eine Instanz starten.
Die lokale App benötigt für Recherche keine separate Bun-Installation; Containerstarts
brauchen Git und Docker mit Linux-Containern. Die Web-App steuert deinen PC nicht.

Erweiterungen: Chrome, Edge, Brave, Opera, Vivaldi und Firefox; Chromium-Pakete
entpackt im Entwicklermodus, Firefox temporär über about:debugging laden.
Keine Store-Veröffentlichung, keine Firefox-Signierung und kein Safari-Paket.

Die Version wird zwischen Engine, Add-on und Tauri geprüft. Neue Gesamtpakete verlangen
passende native Builds und deren Engine-Selbsttests; alte Installer werden nicht übernommen.
Windows ist unsigniert, Mac nicht notarisiert. Engine-Selbsttests sind kein Beleg einer
vollständigen interaktiven Bedienprüfung. GitHub Pages dient als persönliche Demo;
die kommerzielle Hosting-Variante bleibt auf Cloudflare, mit den dokumentierten Fremdlizenzen.

Die folgenden Abschnitte halten den früheren Entstehungsstand fest. Aussagen über eine
fehlende GitHub-Freigabe oder Mac-Buildmöglichkeit dort sind historisch überholt.

## Veröffentlichung und Gesamtpaket · 25.10.2026

- Web-Version für kommerzielle Nutzung: https://aklik-deployer.pages.dev
- Repository und Updates: https://github.com/Johi251/aKlik-Deployer
- Gesamtdownload: https://github.com/Johi251/aKlik-Deployer/releases/latest
- [Benutzerhandbuch mit zehn Ablaufdiagrammen](docs/Benutzerhandbuch.md),
  [PDF](docs/Benutzerhandbuch.pdf), [offline lesbares HTML](docs/Benutzerhandbuch.html).
- [Technische Dokumentation](docs/ENTWICKLUNG.md) und
  [kommerzielle Bedingungen und Fremdlizenzen](docs/KOMMERZIELLE-NUTZUNG.md).

Die frühere GitHub-Sperre wurde vom Nutzer ausdrücklich nur für diese App aufgehoben.
Die unten stehenden historischen Hinweise zu einer fehlenden Veröffentlichungsfreigabe
sind damit überholt. GitHub- und Cloudflare-Links werden bei der Veröffentlichung geprüft.
Die vorhandenen Windows-Installer stammen aus dem bereits geprüften nativen Build;
die portable EXE wird aus dem aktuellen Stand neu erstellt. Native Fensterbedienung
bleibt getrennt ungeprüft. Der automatische lokale Neubuild wurde von der automatischen
Freigabeprüfung mit „blocked by policy“ abgelehnt.

Erweiterungspakete: Chrome, Edge, Brave, Opera, Vivaldi und Firefox. Die Chromium-Pakete
nutzen denselben Standard. Firefox ist temporär ladbar; dauerhafte Verteilung benötigt
Mozilla-Signierung. Safari-Paket und Browser-Store-Veröffentlichung sind nicht enthalten.
Der eigene Quellcode bleibt unter LICENSE dem Rechteinhaber vorbehalten;
Fremdkomponenten behalten ihre ursprünglichen Lizenzen.

Repository prüfen, Startweg verstehen und vorhandene Software nutzen. Dark-Mode-Workspace mit Kobaltblau #1E40AF, lokal geladener Manrope und zugänglicher Tastaturbedienung.

## Starten

Windows: START-AKLIK-DEPLOYER.cmd öffnen. Für die reine Status-Bridge ohne Docker-Einrichtung: START-AKLIK-BRIDGE.cmd.

Portable Windows-App: .data/releases/aKlik-Deployer.exe. Sie enthält die Laufzeit und öffnet den lokalen Browser-Workspace. Native Tauri-Installation: src-tauri/target/release/bundle/nsis/aKlik-Deployer_1.0.0_x64-setup.exe. Die Builds sind nicht signiert.

macOS/Linux aus Quellcode: bun install --frozen-lockfile, anschließend bun run dev. Voraussetzungen für native Builds: https://v2.tauri.app/start/prerequisites/.

## Plattformen und Builds

- bun run check — TypeScript prüfen.
- bun test — vorhandene Funktionen und Bridge testen.
- bun run build — lokale Oberfläche.
- bun run build:extension — Chrome/Edge- und Firefox-ZIPs nach .data/releases.
- bun run build:desktop — portable Windows-x64-EXE, auch als Cross-Build auf Linux/macOS.
- bun run build:tauri — native Tauri-2-App mit eingebetteter Engine. Windows: EXE/MSI; macOS: APP/DMG; Linux: DEB/AppImage. Jedes native Paket wird auf seinem Betriebssystem gebaut.
- bun run release:web — vollständiger statischer Web-Build samt Downloads nach sites/aklik-deployer-online/dist.
- bun run deploy:web — geprüften Web-Build mit Vercel veröffentlichen; benötigt eine lokale Vercel-Anmeldung.

Die GitHub-Workflows erstellen Web- und Desktop-Artefakte, sobald sie in einem Repository ausgeführt werden. Es wird durch dieses Projekt kein Quellcode automatisch auf GitHub veröffentlicht. Für automatische Vercel-Deployments das autorisierte Repository im Vercel-Projekt verbinden; vercel.json enthält Installations-, Build- und Ausgabe-Einstellungen. Kein kostenpflichtiger Dienst ist notwendig; die Anbieterlimits gelten weiterhin.

## Localhost-Bridge für Bookmarks Dynamic Manager

Bindung ausschließlich 127.0.0.1:43110. GET /bridge/v1/health meldet Produkt und Protokoll. GET /bridge/v1/status?url=<URL-encoded Repository> beginnt einen statischen Hintergrundcheck und liefert HTTP 202 mit Orange. Dieselbe Anfrage wiederholen, bis HTTP 200 den Endzustand liefert.

Protokoll: aklik-deployer.status.v1. Felder: state, color, label, evidence, checkedAt, launchUrl, inspectUrl, localReady, onlineReady, deploymentCandidate, runtimeTested und note.

- Grün / online: erreichbare Projekt-Demo auf einem erkannten Demo-Host und eine Open-Source-Lizenz. Aktuelle Zusatzdienste, Limits und die vollständige Funktion sind nicht damit garantiert.
- Blau / local: Open-Source-Lizenz und Docker-/Compose-Datei oder Startskript erkannt. Docker bzw. die Laufzeit muss installiert sein; der Scan führt keine fremden Dateien aus.
- Orange / checking: statische Prüfung läuft.
- Neutral / needs_review oder error: kein belegter Gratis-Startweg bzw. Prüfung fehlgeschlagen. Ein Vercel-Kandidat allein wird niemals grün.

Unterstützte Status-Links: GitHub, gitlab.com inklusive Untergruppen, Hugging-Face-Spaces. Die ausführliche Installations-/Docker-Engine bedient GitHub; für andere Anbieter bleibt die lokale Ausführung manuell. Das traditionelle START-1CLICKER.cmd wird als fremdes Repository-Signal weiter erkannt.

Vier parallele Checks, fünf Minuten Cache und maximal 128 Cache-Einträge. Keine gespeicherten Suchen, Umgebungswerte oder privaten Projekte über die Bridge. Schreibzugriffe sind gesperrt; die normale lokale Start-API bleibt durch Sitzung und Herkunftsprüfung geschützt. Zusätzliche konkrete Web-Origin-Adressen lassen sich in AKLIK_DEPLOYER_BRIDGE_ORIGINS kommasepariert freigeben. Erweiterungen dürfen ausschließlich Statusdaten lesen. Browser-Schutz für lokalen Netzwerkzugriff kann zusätzlich eine Browserfreigabe erfordern.

## Browser-Add-on

.data/releases/aklik-deployer-chrome.zip entpacken, Chrome/Edge → Erweiterungen → Entwicklermodus → Entpackte Erweiterung laden. Für Firefox .data/releases/aklik-deployer-firefox.zip über about:debugging temporär laden. Dauerhafte Firefox-Verteilung benötigt Mozilla-Signierung. Die lokale App muss laufen. Das Add-on liest nur den aktiv gewählten Tab und die lokale Status-Bridge.

Der eingebettete Bookmarks Manager unter /bookmarks/ übernimmt Statusprüfungen lokal oder als Add-on. Seine orange Markenidentität und seine bestehende Funktion bleiben getrennt. Andere unabhängig betreute Projektordner wurden nicht geändert.

## Daten und Grenzen

Lokale Daten bleiben in .data/aklik-deployer.sqlite; die portable/native App verwendet den Benutzer-Datenordner. Öffentliche Web-Builds enthalten keine lokale Datenbank, Schlüssel oder Browser-Sammlungen. Die Web-App speichert ihren Verlauf nur im jeweiligen Browser und führt kein Docker aus. Die Status-Bridge startet niemals Programme. Installation, Containerbetrieb und Modell-Inferenz benötigen jeweils eigene Voraussetzungen und Prüfungen.

Projektwissen: C:\Users\johan\MASTER_SETUP\00 PROJEKTE\PROJECT_MINDSHARE.md. Aktiver Quellcode: C:\Users\johan\MASTER_SETUP\00 PROJEKTE\aKlik-Deployer. Der frühere Projektordner enthält nur einen Verweis und die dort vorhandenen Design-Skills.

## Ergänzende Plattformprüfung · 25.10.2026

Linux wurde zusätzlich unter Ubuntu 26.04/WSL2 gebaut: .data/linux-target/release/bundle/deb/aKlik-Deployer_1.0.0_amd64.deb. Das Paket enthält Desktop-App und Engine; die ausgepackte Engine besteht ihren Selbsttest. Der Build belegt die Kompilierung auf Ubuntu 26.04, keine universelle Kompatibilität mit jeder Linux-Distribution.

Bun run verify:platforms baut die Engine für Linux x64, Mac Intel und Mac Apple Silicon und prüft Dateiformat und Architektur. Mit --linux-runtime wird zusätzlich der Linux-Selbsttest ausgeführt (Windows mit Ubuntu/WSL oder direkt unter Linux). scripts/verify-linux-build.sh prüft den nativen Linux-DEB-Build bei vorhandenen Rust-/GTK-Buildwerkzeugen; es verwendet die bereits gebaute Linux-Engine als Bun-Laufzeit und hält Build-Caches in .data.

Unter Windows und Linux bestehen jeweils 147 Tests. Dockerfile, Compose und Railpack wurden außerdem mit einer kontrollierten lokalen Prüf-App tatsächlich gebaut, gestartet, gestoppt und neu gestartet; alle drei Wege bestanden. Kein fremdes Repository wurde dafür ausgeführt.

Die lokale Vercel-Verknüpfung ist auf das bestehende aKlik-Deployer-Projekt festgelegt. deploy:web benötigt weiterhin eine CLI-Anmeldung; eine fehlende oder ungültige Verknüpfung wird vor dem Build gemeldet. Für automatische Veröffentlichungen bei zukünftigen Quellcodeänderungen fehlt weiterhin ein autorisierter Git-Remote samt Verknüpfung. Es wurde kein GitHub-Repository angelegt oder veröffentlicht.

## Start per lokaler Badge

Im lokal geöffneten Bookmarks Manager startet „Lokal starten“ geeignete öffentliche GitHub-Projekte mit einem Klick über die bestehende geschützte App-API. Der Klick holt eine lokale Sitzung, führt die ausführliche Analyse erneut aus und beauftragt danach den Start. Archivierte Projekte, gesperrte Startpläne, unklare Open-Source-Lizenzen und erforderliche Projektangaben verhindern den automatischen Start. Der Fortschritt bleibt unter „Meine Apps“ sichtbar. „Start beauftragt“ ist noch kein Nachweis einer laufenden Anwendung.

Die öffentliche Web-App und das Browser-Add-on erhalten dadurch keine Schreibberechtigung auf die lokale Engine. Dort bleibt der Verweis zum lokalen Prüfplan erhalten. Fremde Host-Startskripte werden nicht ungeprüft ausgeführt.
