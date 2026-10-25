"""Generate the offline handbook, editable Markdown and vector PDF from one source.
Requires reportlab; optional pypdf is used by the release verification.
"""
from pathlib import Path
from html import escape
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs'
OUT.mkdir(exist_ok=True)
ORIGIN = 'https://aklik-deployer.pages.dev'
REPO = 'https://github.com/Johi251/aKlik-Deployer'
CHAPTERS = [
 dict(title='Dein Werkzeugkasten', intro='aKlik-Deployer hilft dir, vorhandene Software zu finden, Repository-Links zu prüfen und geeignete Projekte lokal zu starten. Die Web-App, die Windows-App und die Erweiterungen ergänzen sich.',
 steps=['Für Recherche ohne Installation: Öffne '+ORIGIN+'.', 'Für lokale Projekte: Installiere die Windows-App aus dem Gesamtpaket.', 'Für Status direkt auf einer Repository-Seite: Lade die passende Browser-Erweiterung.', 'Bewahre das Gesamtpaket auf. Quellcode, Build-Skripte, Erweiterungen und dieses Handbuch gehören dazu.'],
 flow=['Was möchtest du tun?', 'Nur recherchieren? → Web-App', 'Lokal ausführen? → Windows-App', 'Im Browser prüfen? → Add-on + lokale App'],
 tip='Die Web-App führt kein Docker auf deinem PC aus. Ein öffentliches Repository ist noch kein Beleg, dass ein fremdes Projekt kostenlos und kommerziell nutzbar ist.'),
 dict(title='Windows installieren und starten', intro='Die native Tauri-App öffnet ein eigenes Programmfenster. Die portable EXE stellt dieselben lokalen Funktionen in deinem Standardbrowser bereit. Beide verwenden dieselbe lokale Adresse.',
 steps=['Entpacke das Gesamtpaket vollständig in einen eigenen Ordner.', 'Öffne unter Windows die Datei Windows/aKlik-Deployer_1.0.0_x64-setup.exe für die Installation. Starte danach aKlik-Deployer.', 'Alternativ: Starte Windows/aKlik-Deployer-portable.exe. Dafür brauchst du Bun nicht separat.', 'Verwende jeweils nur eine der beiden Varianten zur selben Zeit.', 'Für Docker-Projekte muss Docker mit Linux-Containern laufen. Die Status-Bridge und Recherche brauchen Docker nicht.'],
 flow=['Setup oder portable EXE öffnen', 'Lokale Engine startet auf 127.0.0.1:43110', 'Oberfläche öffnet sich', 'Recherche beginnen; bei Bedarf Docker starten'],
 tip='Die Windows-Dateien sind nicht signiert. Prüfe Quelle und SHA256SUMS.txt. Das Handbuch fordert dich nicht auf, Schutzfunktionen abzuschalten. Das native Fenster benötigt WebView2.'),
 dict(title='Repository prüfen und Status verstehen', intro='Öffne den Bereich zum Prüfen eines Repository-Links. Füge einen öffentlichen Projekt-Link ein und starte die Analyse. Die Prüfung liest Metadaten und ausgewählte Dateien; sie führt dabei keine fremden Startskripte aus.',
 steps=['Kopiere die Repository-Adresse von GitHub, GitLab oder einem Hugging-Face-Space.', 'Starte die Prüfung und warte auf den Endzustand.', 'Grün: Eine erreichbare Demo und eine erkannte Open-Source-Lizenz liegen vor.', 'Blau: Ein lokaler Startweg wie Docker, Compose oder ein Startskript wurde erkannt.', 'Orange: Die Prüfung läuft. Neutral: Der Startweg oder die Lizenz muss noch geklärt werden.'],
 flow=['Öffentlichen Repository-Link eingeben', 'Orange: statische Prüfung läuft', 'Grün: Demo öffnen | Blau: Startplan ansehen', 'Neutral: Hinweise und Originalquelle prüfen'],
 tip='Ein Dockerfile beweist noch keinen erfolgreichen Start. Die ausführliche automatische lokale Installation unterstützt GitHub; bei GitLab und Hugging Face bleibt die Ausführung manuell.'),
 dict(title='Ein Projekt auf deinem PC starten', intro='Die lokale App zeigt einen Startplan mit Lizenz, Voraussetzungen und möglichen Pflichtangaben. Erst der bewusste Start beauftragt die lokale Engine.',
 steps=['Starte Docker und öffne die lokale aKlik-Deployer-App.', 'Prüfe den GitHub-Link und lies Startplan, Lizenz und Hinweise.', 'Trage erforderliche Projektangaben nur lokal ein. Verwende keine fremden Zugangsdaten.', 'Wähle den angebotenen lokalen Start. Fehlende Pflichtwerte, ein gesperrter Plan oder unklare Lizenz verhindern den Start.', 'Verfolge den Fortschritt unter „Meine Apps“. Öffne erst bei laufender Anwendung die lokale Projekt-Adresse.', 'Nutze Stoppen bzw. Neustarten in „Meine Apps“. Das Schließen von aKlik-Deployer beendet bereits gestartete Container nicht automatisch.'],
 flow=['Startplan und Pflichtangaben prüfen', 'Start beauftragen', 'Build und Containerstart unter „Meine Apps“ verfolgen', 'Anwendung öffnen → bei Bedarf stoppen/neustarten'],
 tip='Fremde Anwendungen laufen als Container, teilen aber Docker-Ressourcen mit deinem Computer. Prüfe fremden Code und Lizenz vor produktivem Einsatz. Host-Startskripte werden nicht ungeprüft ausgeführt.'),
 dict(title='Browser-Erweiterung einrichten', intro='Pakete liegen für Chrome, Edge, Brave, Opera, Vivaldi und Firefox bei. Die fünf Chromium-Pakete verwenden dieselbe Erweiterungstechnik. Store-Veröffentlichung und Firefox-Signierung sind ein eigener Schritt.',
 steps=['Entpacke Browser-Erweiterungen/aklik-deployer-<browser>.zip in einen dauerhaften Ordner.', 'Chrome: chrome://extensions. Edge: edge://extensions. Brave: brave://extensions. Opera: opera://extensions. Vivaldi: vivaldi://extensions.', 'Aktiviere dort den Entwicklermodus und wähle „Entpackte Erweiterung laden“. Wähle den Ordner mit manifest.json.', 'Firefox: Öffne about:debugging#/runtime/this-firefox, wähle „Temporäres Add-on laden“ und die entpackte manifest.json.', 'Starte die lokale App, öffne eine unterstützte Repository-Seite und klicke auf das Erweiterungssymbol.', 'Das Add-on zeigt Status und einen Link zum passenden Startplan. Es startet selbst keine Container.'],
 flow=['Passendes ZIP entpacken', 'Erweiterung im Browser laden', 'Lokale App und Repository-Seite öffnen', 'Add-on anklicken → Status oder Startplan'],
 tip='Das Firefox-Testpaket wird beim Browserneustart entfernt. Safari benötigt ein gesondertes Apple-Projekt und Signierung; dafür ist kein installierbares Paket enthalten. Andere Browser wurden nicht als Laufzeittest behauptet.'),
 dict(title='Lesezeichen und lokale Status-Badges', intro='Der integrierte Bookmarks Manager ist über den Werkzeugkasten erreichbar. Zusätzlich liegen Bookmarks-Erweiterungen für Chromium und Firefox bei. Diese verwalten eine eigene Sammlung.',
 steps=['Öffne den Bookmarks Manager innerhalb der lokalen App oder unter '+ORIGIN+'/bookmarks/.', 'Speichere oder importiere deine Links. Die optionale Lesezeichen-Datei liegt im Paket.', 'Warte beim Repository-Link auf den farbigen Status.', 'In der lokalen App kann „Lokal starten“ einen geeigneten GitHub-Startplan prüfen und den Start beauftragen.', 'In der gehosteten Web-App und der Erweiterung öffnet der blaue Status nur den Prüfplan.', 'Kontrolliere anschließend „Meine Apps“. Ein angenommener Startauftrag bedeutet noch nicht, dass die Anwendung bereits läuft.'],
 flow=['Link in Sammlung speichern', 'Hintergrundprüfung liefert Status', 'Lokal: Start prüfen | Online: Prüfplan öffnen', 'Ergebnis unter „Meine Apps“ kontrollieren'],
 tip='Gehostete Webseiten und Erweiterungen erhalten keine allgemeine Schreibberechtigung auf die lokale Engine. Die Status-Bridge ist nur an die Loopback-Adresse gebunden.'),
 dict(title='Werkzeuge finden und vergleichen', intro='Die Suche verbindet öffentliche Fundstellen und Projektinformationen. Sie hilft dir, vorhandene Lösungen zu vergleichen, bevor du ein neues Werkzeug installierst.',
 steps=['Beschreibe deine Aufgabe möglichst konkret, zum Beispiel „lokales Diagrammwerkzeug ohne Konto“.', 'Vergleiche mehrere Kandidaten nach Funktionen, Plattform, Lizenz und Startweg.', 'Öffne die Originalquelle und prüfe aktuelle Bedingungen.', 'Übernimm einen Kandidaten zur detaillierten Repository-Prüfung.', 'Für zusätzliche lokale Websuche kann SearXNG eingerichtet werden; das ist ein separater Docker-Dienst.'],
 flow=['Aufgabe beschreiben', 'Quellen und Kandidaten vergleichen', 'Lizenz, Plattform und Kosten prüfen', 'Passenden Link detailliert analysieren'],
 tip='Katalogeinträge können veraltet sein. Eine kostenlose Liste garantiert keine kostenlose Nutzung der darin verlinkten Produkte.'),
 dict(title='KI-Modelle und Agenten vorbereiten', intro='Der Modellbereich hilft bei der Einordnung eines Modell-Links und bei der Vorbereitung eines Agenten-Startpakets. Er ersetzt weder einen Anbieterzugang noch eine laufende Modellumgebung.',
 steps=['Öffne den Modellbereich und füge den Modell-Link ein.', 'Prüfe Modell, Anbieter, Lizenz und die Anforderungen an Hardware oder Cloud-Zugang.', 'Wähle ein passendes Profil und lade das angebotene Agenten-Startpaket herunter.', 'Lies dessen Anleitung, bevor du Befehle ausführst.', 'Richte eigene Zugangsdaten lokal ein und prüfe Anbieterpreise vor jeder kostenpflichtigen Nutzung.'],
 flow=['Modell-Link eingeben', 'Lizenz und Betriebsweg prüfen', 'Agenten-Startpaket vorbereiten', 'Zugang lokal einrichten und Funktion testen'],
 tip='Ein heruntergeladenes Startpaket ist noch kein laufender Agent. Die App verspricht keine kostenlose Modell-Inferenz und enthält keine persönlichen API-Schlüssel.'),
 dict(title='Daten sichern, aktualisieren und Fehler lösen', intro='Web-App und lokale App speichern Daten an unterschiedlichen Orten. Ein Programmupdate ist kein Backup deiner persönlichen Sammlung.',
 steps=['Exportiere deine Lesezeichen regelmäßig mit der Exportfunktion des Managers.', 'Die lokale App legt ihre Daten unter dem Benutzer-Datenordner aKlik-Deployer ab, unter Windows normalerweise %LOCALAPPDATA%\\aKlik-Deployer. Im Quellcodebetrieb ist es .data/.', 'Beende die lokale App vor einer Dateisicherung. Verwahre eine Datenbanksicherung vertraulich; bei SQLite gehören vorhandene WAL-/SHM-Dateien dazu.', 'Für Updates: Lade ein neues Release vom GitHub-Repository und ersetze die Programmdateien oder verwende den neuen Installer. Sichere Daten vorher.', 'Bei „lokale App nicht erreichbar“: lokale App starten, nur eine Instanz verwenden und Port 43110 prüfen.', 'Bei Docker-Fehlern: Docker starten, Pflichtangaben und Projekt-Logs prüfen. Bei Browserfehlern: neu laden, Internet und API-Limits prüfen.'],
 flow=['Vor Update Sammlung exportieren und lokale App beenden', 'Neues Release und Prüfsummen prüfen', 'Programm bzw. entpackte Erweiterung aktualisieren', 'Sammlung und einen bekannten Link kontrollieren'],
 tip='Das Gesamtpaket enthält absichtlich keine persönliche Datenbank, Schlüssel oder Browserdaten. Es gibt keinen eingerichteten automatischen Desktop-Updater.'),
 dict(title='Kommerziell nutzen und selbst veröffentlichen', intro='Die kommerzielle Web-Variante wird für Cloudflare Pages bereitgestellt. GitHub verwaltet den Quellcode und die Download-Releases. Die Vercel-Hobby-Seite bleibt eine Demo für nicht kommerzielle Nutzung.',
 steps=['Verwende für die kommerzielle Web-Veröffentlichung die Cloudflare-Adresse. Tarifgrenzen gelten; statisches Hosting ersetzt keinen Docker-Server.', 'Der eigene Quellcode bleibt dem Rechteinhaber vorbehalten. Die öffentliche Ablage erteilt anderen keine pauschale Weiterverkaufslizenz.', 'Remotion 4 erlaubt Einzelpersonen und kleinen Organisationen die kommerzielle Nutzung unter der Free License. Oberhalb der dortigen Grenze von drei Personen ist eine Company License nötig.', 'Behalte THIRD_PARTY_NOTICES.md, public/licenses.txt und Schriftlizenzen bei einer Weitergabe bei.', 'Für einen Geschäftsbetrieb: eigene Anbieterbedingungen, Datenschutzhinweise und erforderliche Betreiberangaben ergänzen. Zahlungsabwicklung ist kein Bestandteil dieses Tools.'],
 flow=['Eigenes Produkt und Fremdlizenzen prüfen', 'Statischen Web-Build erstellen', 'Cloudflare Pages veröffentlichen', 'Download-Release bereitstellen und öffentlich prüfen'],
 tip='Fremde Repository-Projekte haben eigene Lizenzen. Die App erteilt keine Rechte an deren Code. Kostenloses Hosting und kommerzielle Softwarelizenz sind getrennte Fragen.'),
]

font_candidates=[Path('C:/Windows/Fonts/segoeui.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
font=next((p for p in font_candidates if p.exists()),None)
if not font: raise RuntimeError('Unicode font missing')
pdfmetrics.registerFont(TTFont('Handbook',str(font)))
bold=font.with_name('segoeuib.ttf' if font.name=='segoeui.ttf' else 'DejaVuSans-Bold.ttf')
pdfmetrics.registerFont(TTFont('HandbookBold',str(bold if bold.exists() else font)))
W,H=A4
body=ParagraphStyle('body',fontName='Handbook',fontSize=10,leading=15,textColor=HexColor('#243044'))
small=ParagraphStyle('small',parent=body,fontSize=9,leading=13)
node_style=ParagraphStyle('node',parent=body,fontSize=9.5,leading=13,alignment=1)
pdf=canvas.Canvas(str(OUT/'Benutzerhandbuch.pdf'),pagesize=A4)
pdf.setTitle('aKlik-Deployer – Benutzerhandbuch 1.0.0')
pdf.setAuthor('aKlik-Deployer')
md=['# aKlik-Deployer – Benutzerhandbuch 1.0.0','',f'Web: {ORIGIN} · Quellcode und Releases: {REPO}','', 'Stand: 25.10.2026. Pakete sind unsigniert. Browserpakete sind Entwicklerpakete, keine Store-Veröffentlichung.','']
html=['<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>aKlik-Deployer · Benutzerhandbuch</title><style>body{font:17px/1.6 system-ui,sans-serif;color:#172033;background:#f4f6fa;margin:0}main{max-width:900px;margin:auto;padding:32px}section{background:white;border:1px solid #d7deeb;border-radius:16px;padding:28px;margin:24px 0;break-inside:avoid}h1,h2{color:#1e40af;line-height:1.2}a{color:#1e40af}li{margin:10px 0}.flow{list-style:none;padding:0;text-align:center}.flow li{border:1px solid #96abe4;background:#eef3ff;padding:12px;border-radius:8px}.flow li+li:before{content:"↓";display:block;color:#1e40af;margin-top:-24px;padding-bottom:8px}.tip{border-left:3px solid #1e40af;padding:12px;background:#eef3ff}nav a{display:block} @media print{body{background:white;font-size:11pt}main{padding:0}section{border:0;break-before:page}nav{display:none}}</style><main><h1>aKlik-Deployer<br>Benutzerhandbuch 1.0.0</h1>',f'<p>Web: <a href="{ORIGIN}">{ORIGIN}</a><br>Quellcode und Downloads: <a href="{REPO}">{REPO}</a></p><nav>']
html += [f'<a href="#kapitel-{i}">{i}. {escape(ch["title"])}</a>' for i,ch in enumerate(CHAPTERS,1)]
html.append('</nav>')

def para(text,x,y,width,style=body):
 p=Paragraph(escape(text),style); _,height=p.wrap(width,H)
 p.drawOn(pdf,x,y-height)
 return y-height-10

for index,ch in enumerate(CHAPTERS,1):
 pdf.setFillColor(HexColor('#1e40af'));pdf.rect(0,H-16,W,16,fill=1,stroke=0)
 pdf.setFont('HandbookBold',11);pdf.drawString(44,H-48,'aKlik-Deployer / Benutzerhandbuch 1.0.0')
 pdf.setFont('HandbookBold',20);pdf.setFillColor(HexColor('#172033'))
 title=Paragraph(escape(ch['title']),ParagraphStyle('title',fontName='HandbookBold',fontSize=21,leading=26,textColor=HexColor('#172033')))
 _,th=title.wrap(W-88,H);title.drawOn(pdf,44,H-82-th)
 y=H-94-th
 y=para(ch['intro'],44,y,W-88)
 for n,step in enumerate(ch['steps'],1):y=para(f'{n}. {step}',44,y,W-88)
 y-=7
 # Four connected boxes: vector graphics remain crisp when zooming or printing.
 box_h=37;gap=14;x=58;bw=W-116
 for n,label in enumerate(ch['flow']):
  pdf.setStrokeColor(HexColor('#8da5df'));pdf.setFillColor(HexColor('#eef3ff'))
  pdf.roundRect(x,y-box_h,bw,box_h,7,fill=1,stroke=1)
  p=Paragraph(escape(label),node_style);_,h=p.wrap(bw-18,box_h)
  p.drawOn(pdf,x+9,y-box_h+(box_h-h)/2)
  y-=box_h
  if n<len(ch['flow'])-1:
   pdf.setStrokeColor(HexColor('#1e40af'));pdf.line(W/2,y-2,W/2,y-gap+2)
   pdf.line(W/2,y-gap+2,W/2-3,y-gap+6);pdf.line(W/2,y-gap+2,W/2+3,y-gap+6)
   y-=gap
 y=para(ch['tip'],44,y-14,W-88,small)
 if y<48: raise RuntimeError(f'Page {index} overflow: {y}')
 pdf.setFont('Handbook',8);pdf.setFillColor(HexColor('#5d6c80'))
 pdf.drawString(44,28,'25.10.2026 · Ablaufdiagramme beschreiben den vorgesehenen Bedienweg')
 pdf.drawRightString(W-44,28,f'{index} / {len(CHAPTERS)}')
 pdf.showPage()
 md.extend([f'## {index}. {ch["title"]}','',ch['intro'],'']+[f'{n}. {s}' for n,s in enumerate(ch['steps'],1)]+['','```mermaid','flowchart TD'])
 for n,label in enumerate(ch['flow']):
  md.append(f'    n{n}["{label}"]')
  if n:md.append(f'    n{n-1} --> n{n}')
 md.extend(['```','',f'Hinweis: {ch["tip"]}',''])
 html.append(f'<section id="kapitel-{index}"><h2>{index}. {escape(ch["title"])}</h2><p>{escape(ch["intro"])}</p><ol>')
 html += [f'<li>{escape(s)}</li>' for s in ch['steps']]
 html.append('</ol><ol class="flow" aria-label="Ablaufdiagramm">')
 html += [f'<li>{escape(s)}</li>' for s in ch['flow']]
 html.append(f'</ol><p class="tip">{escape(ch["tip"])}</p></section>')
pdf.save()
sources=[('Remotion-Lizenz','https://github.com/remotion-dev/remotion/blob/main/LICENSE.md'),('Cloudflare Pages','https://www.cloudflare.com/products/pages/'),('Cloudflare Tarifgrenzen','https://developers.cloudflare.com/pages/platform/limits/'),('Cloudflare Bedingungen','https://www.cloudflare.com/terms/'),('Vercel Hobby','https://vercel.com/docs/plans/hobby')]
md.extend(['## Quellen','']+[f'- [{n}]({u})' for n,u in sources])
html.append('<section><h2>Quellen</h2>'+''.join(f'<p><a href="{u}">{escape(n)}</a></p>' for n,u in sources)+'</section></main></html>')
(OUT/'Benutzerhandbuch.md').write_text('\n'.join(md),encoding='utf-8')
(OUT/'Benutzerhandbuch.html').write_text('\n'.join(html),encoding='utf-8')
print(json.dumps({'pages':len(CHAPTERS),'pdf':str(OUT/'Benutzerhandbuch.pdf'),'html':str(OUT/'Benutzerhandbuch.html')},ensure_ascii=False))
