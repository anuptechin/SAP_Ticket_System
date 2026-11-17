@echo off
setlocal enabledelayedexpansion
rem SensAI Desk - stop the server. Only stops a Node.js process on the desk's port.
cd /d "%~dp0"
title SensAI Desk - stop

set "PORT=4100"
if exist .env (
  for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"PORT=" .env`) do set "PORT=%%b"
)

set "STOPPED="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do if not defined seen_%%p (
  set "seen_%%p=1"
  tasklist /fi "PID eq %%p" /fo csv /nh | findstr /i "node.exe" >nul
  if not errorlevel 1 (
    taskkill /pid %%p /f >nul 2>&1 && (
      echo Stopped SensAI Desk ^(process %%p on port %PORT%^).
      set "STOPPED=1"
    )
  ) else (
    echo Port %PORT% is used by another program ^(process %%p^), not SensAI Desk. Left it running.
    set "STOPPED=other"
  )
)
if not defined STOPPED echo SensAI Desk is not running on port %PORT%.
if not defined NOPAUSE ping -n 4 127.0.0.1 >nul
exit /b 0
