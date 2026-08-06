@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title Game Timer - Server

set "NODE_DIR=C:\Users\Lenovo\.workbuddy\binaries\node\versions\22.22.2"
cd /d "%~dp0"

if not exist "%NODE_DIR%\node.exe" (
  echo.
  echo [ERROR] Node.js not found:
  echo         %NODE_DIR%\node.exe
  echo.
  echo Install Node 18+ from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

set "PATH=%NODE_DIR%;%~dp0node_modules\.bin;%PATH%"

if not exist "node_modules\.bin\tsx.cmd" (
  echo [setup] Installing dependencies, please wait...
  call npm install || (echo [ERROR] npm install failed & pause & exit /b 1)
)

if not exist "dist\index.html" (
  echo [setup] Building frontend...
  call npm run build || (echo [ERROR] build failed & pause & exit /b 1)
)

set NODE_ENV=production
set PORT=3001

echo.
echo ==========================================
echo   Game Timer  --  http://localhost:3001
echo   Press Ctrl+C to stop
echo ==========================================
echo.

start "" cmd /c "timeout /t 4 >nul & start http://localhost:3001"

node "%~dp0node_modules\tsx\dist\cli.mjs" server/index.ts

echo.
echo Server stopped.
pause
