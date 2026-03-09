#!/bin/bash
# Dev start script for macOS
# Usage: ./start.sh
# Opens backend + frontend in two Terminal tabs

cd "$(dirname "$0")"

echo "Starting Zen Finance (dev mode)..."

# Open a new Terminal tab for the backend
osascript -e 'tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.3
  do script "cd \"'"$(pwd)"'\" && python3 -m uvicorn main:app --reload --port 8080" in front window
end tell'

sleep 1

# Open a new Terminal tab for the frontend
osascript -e 'tell application "Terminal"
  tell application "System Events" to keystroke "t" using command down
  delay 0.3
  do script "cd \"'"$(pwd)"'/frontend\" && npm run dev" in front window
end tell'

sleep 2

# Open browser
open http://localhost:5173

echo "Backend:  http://localhost:8080"
echo "Frontend: http://localhost:5173"
