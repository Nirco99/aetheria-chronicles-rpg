@echo off
setlocal
title Aetheria Chronicles Launcher
cd /d "%~dp0"
set "EXE=%~dp0release\win-unpacked\Aetheria Chronicles.exe"

if exist "%EXE%" goto run

echo [Aetheria] The desktop build was not found - building it now (requires Node.js 20 or newer).
where npm >nul 2>nul
if errorlevel 1 (
  echo [Aetheria] npm was not found. Install Node.js 20+ from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist "node_modules" (
  call npm install
  if errorlevel 1 goto fail
)
call npm run dist:win
if errorlevel 1 goto fail

:run
start "" "%EXE%" %*
exit /b 0

:fail
echo [Aetheria] The build failed. See the messages above.
pause
exit /b 1
