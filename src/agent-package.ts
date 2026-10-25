import { strToU8, zipSync } from "fflate";
import { modelSetupProfile } from "./model-planner";
import { hasSecret } from "./matching";
import type { ModelReport } from "./types";

export const agentRelease = {
  version: "1.19.4",
  x64: { url: "https://github.com/anomalyco/opencode/releases/download/v1.19.4/opencode-windows-x64-baseline.zip", sha256: "21cac96abb146b0f6e770680ea7855fc4f354c7966aab39f5be9859b0df1deac" },
  arm64: { url: "https://github.com/anomalyco/opencode/releases/download/v1.19.4/opencode-windows-arm64.zip", sha256: "36e696fd1d275b469ab02a1ccc00d161bfdcc0a4ffa93c2b7a4e57399f3ff347" },
};

const launcher = String.raw`[CmdletBinding()]
param([switch]$CheckOnly, [switch]$Terminal)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$aklikDeployerRoot = $PSScriptRoot
function Get-AklikDeployerHash([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $algorithm.Dispose() }
}
$previousKey = $null
$keyName = $null
try {
  Set-Location -LiteralPath $aklikDeployerRoot
  $settings = Get-Content -LiteralPath (Join-Path $aklikDeployerRoot 'modell.json') -Raw | ConvertFrom-Json
  $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  $release = switch ($architecture) {
    'X64' { [pscustomobject]@{ Url = '__X64_URL__'; Hash = '__X64_SHA__' } }
    'Arm64' { [pscustomobject]@{ Url = '__ARM_URL__'; Hash = '__ARM_SHA__' } }
    default { throw 'Dieses Paket unterstuetzt Windows 11 x64 und ARM64.' }
  }
  $runtime = Join-Path $aklikDeployerRoot '.runtime'
  $archive = Join-Path $runtime 'opencode.zip'
  New-Item -ItemType Directory -Path $runtime -Force | Out-Null
  if (!(Test-Path -LiteralPath $archive)) {
    Write-Host 'Lade offizielle OpenCode-Laufzeit 1.19.4 (etwa 80 MB). Keine Modellgewichte.'
    $partial = Join-Path $runtime 'download.partial'
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
      & curl.exe --fail --location --silent --show-error --connect-timeout 20 --max-time 180 --output $partial $release.Url
      if ($LASTEXITCODE -ne 0) { throw 'Download fehlgeschlagen. Internetzugang und GitHub-Erreichbarkeit pruefen.' }
    } else { Invoke-WebRequest -Uri $release.Url -OutFile $partial -UseBasicParsing -TimeoutSec 180 }
    if ((Get-AklikDeployerHash $partial) -ne $release.Hash) { throw 'Download-Pruefsumme stimmt nicht. Paket wird nicht ausgefuehrt.' }
    Move-Item -LiteralPath $partial -Destination $archive -Force
  }
  if ((Get-AklikDeployerHash $archive) -ne $release.Hash) { throw 'Laufzeitarchiv veraendert. Paket wird nicht ausgefuehrt.' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($archive)
  try {
    foreach ($entry in $zip.Entries) {
      $target = [IO.Path]::GetFullPath((Join-Path $runtime $entry.FullName))
      if (!$target.StartsWith(([IO.Path]::GetFullPath($runtime) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase) -or $entry.Length -gt 500MB) { throw 'Unerwarteter Archivpfad oder Dateigroesse.' }
    }
    foreach ($entry in $zip.Entries) {
      $target = [IO.Path]::GetFullPath((Join-Path $runtime $entry.FullName))
      if (!$entry.Name) { New-Item -ItemType Directory -Path $target -Force | Out-Null; continue }
      New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
    }
  } finally { $zip.Dispose() }
  $exe = Join-Path $runtime 'opencode.exe'
  if (!(Test-Path -LiteralPath $exe)) { throw 'opencode.exe fehlt im geprueften Archiv.' }
  $state = Join-Path $aklikDeployerRoot '.agent-state'
  $env:XDG_CONFIG_HOME = Join-Path $state 'config'
  $env:XDG_DATA_HOME = Join-Path $state 'data'
  $env:XDG_CACHE_HOME = Join-Path $state 'cache'
  $env:XDG_STATE_HOME = Join-Path $state 'state'
  $env:OPENCODE_CONFIG_DIR = Join-Path $state 'config/opencode'
  $env:OPENCODE_CONFIG = Join-Path $aklikDeployerRoot 'opencode.json'
  $env:OPENCODE_CONFIG_CONTENT = $null
  $env:OPENCODE_DISABLE_PROJECT_CONFIG = 'true'
  $env:OPENCODE_DISABLE_AUTOUPDATE = 'true'
  $env:OPENCODE_DISABLE_MODELS_FETCH = 'true'
  $env:OPENCODE_PERMISSION = $null
  $env:OPENCODE_DB = $null
  $work = Join-Path $aklikDeployerRoot 'Arbeitsordner'
  New-Item -ItemType Directory -Path $work -Force | Out-Null
  Set-Location -LiteralPath $work
  if ($CheckOnly) { & $exe --version; if ($LASTEXITCODE -ne 0) { throw 'Laufzeitpruefung fehlgeschlagen.' }; Write-Host 'Laufzeit geprueft. Keine Modellanfrage gesendet.'; exit 0 }
  Write-Host ('Cloud-Modell: ' + $settings.model)
  Write-Host 'Die KI laeuft beim gewaehlten Cloud-Anbieter. Prompts und freigegebene Dateien werden dorthin gesendet.'
  Write-Host 'Preise, Limits und Modellzugang zuerst beim Anbieter pruefen. Tool-Aufrufe sind modellabhaengig.'
  if ((Read-Host 'Wenn Zugang und Kosten fuer dich geklaert sind, START eingeben; sonst Enter zum Abbrechen') -cne 'START') { exit 0 }
  $keyName = [string]$settings.keyEnvironment
  if ($keyName -notin @('HF_TOKEN', 'OPENROUTER_API_KEY')) { throw 'Unbekannter Schluesseltyp.' }
  $previousKey = [Environment]::GetEnvironmentVariable($keyName, 'Process')
  if (!$previousKey) {
    $secure = Read-Host ('Deinen ' + $keyName + ' lokal eingeben (unsichtbar, nur fuer diesen Start)') -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Kein API-Schluessel eingegeben.' }; [Environment]::SetEnvironmentVariable($keyName, $plain, 'Process') }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $plain = $null; $secure.Dispose() }
  }
  if ($Terminal) { & $exe }
  else {
    $webPassword = Read-Host 'Eigenes Passwort fuer die lokale Browseroberflaeche festlegen (Benutzer: opencode)' -AsSecureString
    if ($webPassword.Length -lt 8) { throw 'Bitte mindestens 8 Zeichen fuer das lokale Passwort verwenden.' }
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($webPassword)
    try { $env:OPENCODE_SERVER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $webPassword.Dispose() }
    $env:OPENCODE_SERVER_USERNAME = 'opencode'
    Write-Host 'Im Browser mit Benutzer opencode und deinem gerade festgelegten Passwort anmelden. Zum Beenden dieses Fenster schliessen oder Strg+C.'
    & $exe web --hostname 127.0.0.1 --port 0
  }
  if ($LASTEXITCODE -ne 0) { throw 'OpenCode wurde mit einem Fehler beendet. Hinweise im Fenster beachten.' }
} catch { Write-Host ('Start abgebrochen: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }
finally {
  if ($keyName) { [Environment]::SetEnvironmentVariable($keyName, $previousKey, 'Process') }
  $env:OPENCODE_SERVER_PASSWORD = $null
}
`;

export function agentPackageFiles(report: ModelReport, providerId: string): Record<string, string> {
  const profile = modelSetupProfile(report, { providerId, mode: "profile", agent: "OpenCode", purpose: "Eigenes Modell im getrennten Laptop-Agenten" });
  const provider = report.providers.find(p => p.id === profile.providerId)!;
  const key = provider.id.startsWith("hf:") ? "HF_TOKEN" : "OPENROUTER_API_KEY";
  if (!/^[A-Za-z0-9][A-Za-z0-9_./:@+-]{0,240}$/.test(provider.model) || hasSecret(provider.model) || provider.endpoint !== (key === "HF_TOKEN" ? "https://router.huggingface.co/v1" : "https://openrouter.ai/api/v1")) throw new Error("Modellkennung oder Endpunkt nicht fuer das Startpaket freigegeben.");
  const model = "aklik-deployer/" + provider.model;
  const config = {
    model, small_model: model, enabled_providers: ["aklik-deployer"], share: "disabled", autoupdate: false,
    permission: { "*": "ask", external_directory: "deny" },
    provider: { "aklik-deployer": { npm: "@ai-sdk/openai-compatible", name: "aKlik-Deployer Cloud-Modell", options: { baseURL: provider.endpoint, apiKey: "{env:" + key + "}" }, models: { [provider.model]: { name: report.modelId } } } },
  };
  const ps = launcher.replace("__X64_URL__", agentRelease.x64.url).replace("__X64_SHA__", agentRelease.x64.sha256).replace("__ARM_URL__", agentRelease.arm64.url).replace("__ARM_SHA__", agentRelease.arm64.sha256);
  const cmd = (args = "") => '@echo off\r\ncd /d "%~dp0"\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START.ps1"' + args + '\r\npause\r\n';
  return {
    "START-AGENT.cmd": cmd(), "START-TERMINAL.cmd": cmd(" -Terminal"), "LAUFZEIT-PRUEFEN.cmd": cmd(" -CheckOnly"),
    "START.ps1": ps.replace(/\r?\n/g, "\r\n"), "opencode.json": JSON.stringify(config, null, 2),
    "modell.json": JSON.stringify({ model: provider.model, keyEnvironment: key, source: report.url, checkedAt: report.checkedAt, runtime: agentRelease.version }, null, 2),
    "EINRICHTUNGSPROMPT.txt": profile.prompt,
    "LIES-MICH.txt": ["aKlik-Deployer: Modell + OpenCode auf deinem Laptop", "", "Windows 11 x64/ARM64. ZIP vollstaendig in einen eigenen Ordner entpacken. START-AGENT.cmd doppelt anklicken. Kein Administrator und keine globale Installation erforderlich. Windows kann bei heruntergeladenen Skripten nachfragen; Firmenrichtlinien werden nicht umgangen.", "Der erste Start laedt etwa 80 MB OpenCode 1.19.4 aus dem offiziellen GitHub-Release und prueft SHA-256. Keine Modellgewichte. Die Modellantwort kommt aus der Cloud und erfordert Internet, gueltigen Zugang und eventuell Geld.", "Vor einer Modellanfrage werden Zugang und Kosten lokal bestaetigt. Den Anbieterschluessel nur in diesem lokalen Fenster eingeben oder per vorhandener Umgebungsvariable bereitstellen. Nicht in Chat oder Dateien schreiben. Nicht /connect verwenden, wenn du keine dauerhafte Schluesselspeicherung willst.", "Die Browseroberflaeche laeuft nur auf 127.0.0.1, mit selbst gewaehltem lokalem Passwort und Benutzer opencode. START-TERMINAL.cmd startet alternativ die Terminal-Oberflaeche. LAUFZEIT-PRUEFEN.cmd prueft nur die heruntergeladene Laufzeit und sendet keinen Modellprompt.", "Arbeitsdateien in Arbeitsordner ablegen. Werkzeugaktionen fragen nach Erlaubnis, externe Ordner sind gesperrt. Der Agent ist keine Betriebssystem-Sandbox. Keine vertraulichen Dateien freigeben, die der Cloud-Anbieter nicht erhalten soll. Fuer Shell-Werkzeuge kann Git for Windows / Git Bash erforderlich sein; Windows-WSL wird von OpenCode empfohlen.", "Sitzungen und Cache liegen unter .agent-state in diesem Paket. Vorhandene Agent-Profile werden nicht veraendert. Dieses Paket ist ein eigenstaendiges auswaehlbares Aufgabenprofil. Weitere Modelle durch ein eigenes Paket in einem anderen Ordner verwenden.", "Tool-Aufrufe: " + (provider.tools === true ? "laut Katalog unterstuetzt, praktisch ungeprueft" : "nicht bestaetigt; Chat kann funktionieren, Agent-Werkzeuge eventuell nicht"), "Die Laufzeit wird fest auf Version 1.19.4 gehalten. Aktualisierte Pakete nur nach erneuter Pruefung erzeugen. Metadaten und Konfiguration sind kein erfolgreicher Modell- oder Agent-Funktionstest.", "", "Quellen:", report.url, provider.docs, "https://opencode.ai/docs/providers/", "https://opencode.ai/docs/web/", "https://github.com/anomalyco/opencode/releases/tag/v1.19.4", "OpenCode: https://github.com/anomalyco/opencode/blob/v1.19.4/LICENSE", "Die Laufzeit wird vom Originalanbieter bezogen und ist nicht in diesem ZIP enthalten."].join("\r\n"),
  };
}
export function buildAgentPackage(report: ModelReport, providerId: string): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(agentPackageFiles(report, providerId)).map(([name, content]) => [name, strToU8(content)])), { level: 6 });
}
