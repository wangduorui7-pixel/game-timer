@echo off
chcp 65001 >nul 2>&1
setlocal
title Game Timer - Dev

set "NODE_DIR=C:\Users\Lenovo\.workbuddy\binaries\node\versions\22.22.2"
cd /d "%~dp0"

if not exist "%NODE_DIR%\node.exe" (
  echo [ERROR] Node.js not found: %NODE_DIR%\node.exe
  pause
  exit /b 1
)

set "PATH=%NODE_DIR%;%~dp0node_modules\.bin;%PATH%"

if not exist "node_modules\.bin\vite.cmd" (
  echo [setup] Installing dependencies...
  call npm install || (echo [ERROR] npm install failed & pause & exit /b 1)
)

echo.
echo ==========================================
echo   Dev mode
echo   Frontend  http://localhost:5173
echo   Backend   http://localhost:3001
echo   Press Ctrl+C to stop
echo ==========================================
echo.

start "" cmd /c "timeout /t 6 >nul & start http://localhost:5173"

call npm run dev

pause
