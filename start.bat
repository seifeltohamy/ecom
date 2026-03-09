@echo off
cd /d "%~dp0"
echo Starting Zen Finance (dev mode)...
start "Zen Backend" cmd /k "python -m uvicorn main:app --reload --port 8080"
timeout /t 2 > nul
cd frontend
start "" http://localhost:5173
npm run dev
