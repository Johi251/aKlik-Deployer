@echo off
setlocal
cd /d "%~dp0"
where bun >nul 2>nul
if errorlevel 1 (
  echo Bun fehlt. Bitte zuerst Bun installieren: https://bun.sh
  pause
  exit /b 1
)
if not exist node_modules (
  call bun install --frozen-lockfile
  if errorlevel 1 (pause & exit /b 1)
)
call bun run search:up
if errorlevel 1 echo Websuche nicht gestartet. GitHub und Kataloge bleiben verfuegbar.
call bun run setup:railpack
if errorlevel 1 echo Railpack nicht bereit. Dockerfile und Compose bleiben verfuegbar.
call bun run build
if errorlevel 1 (pause & exit /b 1)
echo.
echo aKlik-Deployer wird lokal gestartet: http://127.0.0.1:43110
echo Dieses Fenster offen lassen. Strg+C beendet die Oberflaeche.
echo.
start "" "http://127.0.0.1:43110"
call bun run start
pause
