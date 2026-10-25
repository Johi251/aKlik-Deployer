@echo off
setlocal
cd /d "%~dp0"
if not exist public\app.js call bun run build
if errorlevel 1 exit /b 1
bun run start
