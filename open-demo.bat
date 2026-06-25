@echo off
cd /d "%~dp0"
echo Starting gesture presentation demo...
echo Keep this window open while using the demo.
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1; Start-Process 'http://localhost:8000/index.html'"
python -m http.server 8000
pause
