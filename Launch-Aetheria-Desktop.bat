@echo off
setlocal
title Aetheria Chronicles Launcher
cd /d "%~dp0"
set "EXE=%~dp0release\win-unpacked\Aetheria Chronicles.exe"
set "STAMP=%~dp0release\win-unpacked\build-version.txt"

rem The version this checkout would build, and the version the existing exe was built from.
set "WANT="
for /f "tokens=2 delims=:, " %%v in ('findstr /c:"\"version\"" "%~dp0package.json"') do if not defined WANT set "WANT=%%~v"
set "HAVE="
if exist "%STAMP%" set /p HAVE=<"%STAMP%"

if exist "%EXE%" if "%HAVE%"=="%WANT%" goto run

if exist "%EXE%" (
  echo [Aetheria] The desktop build is older than this checkout ^(v%WANT%^) - rebuilding it now.
) else (
  echo [Aetheria] The desktop build was not found - building it now ^(requires Node.js 20 or newer^).
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [Aetheria] npm was not found. Install Node.js 20+ from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 goto fail
call npm run dist:win
if errorlevel 1 goto fail

:run
start "" "%EXE%" %*
exit /b 0

:fail
echo [Aetheria] The build failed. See the messages above.
pause
exit /b 1
