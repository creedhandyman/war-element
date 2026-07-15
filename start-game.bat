@echo off
REM ============================================================
REM  Start War Element and open it in your browser.
REM  Double-click this file. Close the window (or Ctrl+C) to stop.
REM ============================================================
title War Element - dev server
cd /d "%~dp0"

REM Install dependencies the first time (skips if already installed).
if not exist "node_modules" (
  echo First run: installing dependencies, please wait...
  call npm install
)

echo.
echo Starting War Element... a browser tab will open automatically.
echo Leave this window open while you play. Press Ctrl+C to stop.
echo.
call npm run dev -- --open

REM If the server exits, keep the window open so any error is readable.
pause
