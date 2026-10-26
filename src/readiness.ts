import {APP_VERSION} from './version';
export interface Diagnostic { name:string; status:'ok'|'warn'; detail:string; action?:string }
export interface DiagnosticReport { checkedAt:string; edition:'local'|'web'; checks:Diagnostic[] }
export interface Readiness { name:string; status:'ready'|'setup'; detail:string }
export function readiness(report:DiagnosticReport):Readiness[]{
 const local=report.edition==='local',has=(name:string)=>report.checks.some(c=>c.name===name&&c.status==='ok');
 const containers=local&&has('Git')&&has('Docker');
 return [
  {name:'Recherche und Repository-Prüfung',status:'ready',detail:'Hier verfügbar. Neue Quellenprüfungen benötigen Internet; Anbieterlimits gelten.'},
  {name:'Docker- und Compose-Projekte starten',status:containers?'ready':'setup',detail:!local?'Windows- oder Mac-App öffnen. Die Web-App steuert deinen Rechner nicht.':containers?'Voraussetzungen vorhanden. Der einzelne Startplan wird vor jedem Start geprüft.':'Git und eine laufende lokale Docker-Engine mit Linux-Containern werden benötigt.'},
  {name:'Quellcode mit Railpack bauen',status:containers&&has('Railpack')?'ready':'setup',detail:containers&&has('Railpack')?'Build-Werkzeug vorhanden; unterstütztes Projekt und passende Lizenz bleiben erforderlich.':'Zusätzlich zu Git und Docker muss das festgelegte Railpack-Image bereitstehen.'},
  {name:'Browser-Erweiterung verbinden',status:local?'ready':'setup',detail:local?'Die lesende Status-Bridge ist Bestandteil dieser lokalen App.':'Erweiterung installieren und die lokale App starten; danach einen Repository-Tab prüfen.'},
 ];
}
// Only authored status labels leave the app. Logs, details, paths and projects stay local.
export function shareableDiagnostics(report:DiagnosticReport){
 const known=['aKlik-Deployer','Bun','Git','Docker','Railpack','Websuche','GitHub und Kataloge','Online-Version','Deine Daten','Lokale Installation','GitHub / Quellen'];
 return {product:'aKlik-Deployer',version:APP_VERSION,edition:report.edition,checkedAt:report.checkedAt,checks:report.checks.filter(c=>known.includes(c.name)).map(c=>({name:c.name,status:c.status})),capabilities:readiness(report).map(c=>({name:c.name,status:c.status})),privacy:'Keine Logs, Dateipfade, Repository-Links, Projekte oder Zugangsdaten enthalten.'};
}
