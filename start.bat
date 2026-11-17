@echo off
setlocal
rem SensAI Desk - start the server and open it in the browser. Safe to double-click.
cd /d "%~dp0"
title SensAI Desk - start

set "PORT=4100"
set "APP_URL="
if exist .env (
  for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"PORT=" .env`) do set "PORT=%%b"
  for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"APP_URL=" .env`) do set "APP_URL=%%b"
)
if "%APP_URL%"=="" (
  if "%PORT%"=="80" (set "APP_URL=http://localhost") else (set "APP_URL=http://localhost:%PORT%")
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org and run start.bat again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Installing dependencies failed. See the messages above.
    pause
    exit /b 1
  )
)

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo SensAI Desk is already running on port %PORT%.
  if not defined NOBROWSER start "" "%APP_URL%"
  exit /b 0
)

if not exist data mkdir data
echo Starting SensAI Desk on port %PORT% ...
start "SensAI Desk server" /min cmd /c "node server.js >> data\server.log 2>&1"

rem wait up to 30 seconds for the server to accept connections
for /l %%i in (1,1,30) do (
  netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul && goto :up
  ping -n 2 127.0.0.1 >nul
)
echo The server did not start. Last lines of data\server.log:
powershell -NoProfile -Command "Get-Content -Tail 15 'data\server.log'"
pause
exit /b 1

:up
echo SensAI Desk is running at %APP_URL%
echo Log file: %CD%\data\server.log    Stop it with stop.bat
if not defined NOBROWSER start "" "%APP_URL%"
exit /b 0
