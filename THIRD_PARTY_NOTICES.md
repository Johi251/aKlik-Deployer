# Herkunft und externe Komponenten

Die Anwendung integriert vorhandene Werkzeuge als eigenständige Prozesse/Dienste. Es wurde kein vollständiges PaaS-Projekt kopiert. Der eigene TypeScript-Code wurde für diesen Prototyp geschrieben.

## Frühere Hero-Scroll-Komponente (v0.7; nicht mehr aktiv)

Die Perspektiv-Animation in `src/web/hero.ts` und der Produkt-Rahmen in `public/landing.css` adaptieren **Container Scroll Animation** von **Manu Arora / Aceternity UI**, MIT License. Quelle: https://21st.dev/@manuarora700/components/container-scroll-animation · Original: https://ui.aceternity.com/components/container-scroll-animation . Der Komponenten-Code wurde am 23.10.2026 über den offiziellen 21st MCP abgerufen (Demo-ID 1081; einer von zwei kostenlosen Tagesabrufen). Die React/Framer-Motion-Vorlage wurde an die vorhandene native HTML/TypeScript-Anwendung angepasst; eigene Texte, Maße, Scrollbereich, Skalierung und Bewegungs-Fallbacks. Keine Demo-Bilder oder Fremdmarken der Vorlage werden ausgeliefert.

MIT License

Copyright (c) Manu Arora / Aceternity UI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

| Komponente | Verwendung | Quelle / Lizenzhinweis |
|---|---|---|
| Railpack 0.43.0 | Linux-Planung und BuildKit-Frontend | https://github.com/railwayapp/railpack · MIT |
| Docker Compose / Buildx | lokale Laufzeit und Build-Steuerung | https://github.com/docker/compose · https://github.com/docker/buildx · Apache-2.0 |
| SearXNG | lokal betriebene Websuche | https://github.com/searxng/searxng · AGPL-3.0; läuft als separater offizieller Dienst |
| yaml | Lesen/Schreiben der geprüften Compose-Teilmenge | https://github.com/eemeli/yaml · ISC |
| Bun / TypeScript / Bun-Typen | Runtime, Build und Entwicklerprüfungen | Original-Lizenzdateien der installierten Werkzeuge/Pakete beachten |

Die exakten JavaScript-Paketversionen stehen in bun.lock. Der Railpack-Image-Digest steht im Quellcode, der SearXNG-Digest unter .data/search/image.json. Lizenzdateien und Notices der Originalpakete bleiben in den installierten Paketen und Images erhalten.

## Ausgelieferte Komponenten ab v0.9

Die aktive Scrollgeschichte verwendet React 19 und Remotion / @remotion/player 4.0.538, keine laufende 21st-Demo. Remotion hat eine eigene Free-/Company-Lizenz; die Free-Bedingungen umfassen Einzelpersonen. Kein kostenpflichtiger Renderdienst wurde aktiviert. Die Schrift Manrope stammt aus @fontsource-variable/manrope 5.3.0 unter SIL OFL. Der integrierte Bookmarks Dynamic Manager stammt aus dem eigenen Projekt https://github.com/Johi251/bookmarks-dynamic-manager und wurde um die aKlik-Deployer-Verbindung ergänzt; das Original wird nicht als neue Fremdvorlage ausgegeben.

Die portable EXE bündelt Bun 1.4.2 einschließlich dessen Laufzeit. Bun-Quellcode, WebKit-Relink-Anleitung und Abhängigkeiten: https://bun.sh/docs/project/license und https://github.com/oven-sh/bun/tree/bun-v1.4.2 . Der vollständige Anwendungsquellcode mit Build-Skripten liegt im Downloadpaket. Lizenztexte für die ausgelieferten Pakete, Remotion, Schriften und Bun sind zusätzlich in public/licenses.txt sowie unter /licenses.txt verfügbar. Diese Hinweise ändern keine Originallizenz.

Die Vorrecherche zu Openship, Dockge, Coolify und Pinokio diente dem Vergleich von Abläufen und Modellen. Deren Quellcode wurde hier nicht eingebettet. Eine spätere Codeübernahme benötigt weiterhin die dokumentierte Prüfung der konkreten Datei und ihrer Abhängigkeiten.

Kataloge und Webseiten liefern Fundstellen. Die Lizenz der Liste oder eines Verzeichnisses ist keine Lizenz der verlinkten Produkte. Der lokale Cache enthält begrenzte extrahierte Link-/Beschreibungseinträge mit Herkunft, keine pauschale Freigabe zur Weiterveröffentlichung fremder Kataloge.

## Katalogattributionen

Awesome Selfhosted: Autoren und Mitwirkende von https://github.com/awesome-selfhosted/awesome-selfhosted und https://github.com/awesome-selfhosted/awesome-selfhosted-data. Katalogdaten stehen unter CC-BY-SA-3.0: https://creativecommons.org/licenses/by-sa/3.0/. Extrahierte Beschreibungen und Katalogmetadaten werden für die lokale Suche gekürzt und mit anderen Quellen zusammengeführt. Diese Daten behalten ihre Quellenlizenz; sie werden nicht unter eine Softwarelizenz dieses Launchers gestellt. Exporte nennen Quelle und Lizenz.

Open SaaS Directory: Copyright (c) 2026 Open SaaS Directory. https://github.com/open-saas-directory/awesome-saas-directory · MIT License. Der Adapter lädt Produktbeschreibungen zur Laufzeit; im Quellcode ist keine Kopie der Liste eingebettet.

MIT License notice for Open SaaS Directory data:

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## fflate 0.8.3

ZIP-Erzeugung des Agenten-Startpakets im Browser. Quelle: https://github.com/101arrowz/fflate

MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## IBM Plex Sans Variable 5.3.0

Lokale Schriftdatei aus @fontsource-variable/ibm-plex-sans, Quelle https://fontsource.org/fonts/ibm-plex-sans und https://github.com/IBM/plex. Unveränderte Latin-WOFF2-Datei. Lizenztext auch unter public/fonts/OFL.txt.

Copyright 2019 IBM Corp. All rights reserved. IBMPlexSans-Italic[wdth,wght].ttf: Copyright 2019 IBM Corp. All rights reserved.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
