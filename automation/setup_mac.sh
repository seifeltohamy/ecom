#!/bin/bash
# setup_mac.sh — One-time setup for the Bosta daily automation on macOS
# Run from project root: bash automation/setup_mac.sh

set -e

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$PROJ/.venv/bin"
PLIST_NAME="com.ecomhq.bosta_daily.plist"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

echo "=== EcomHQ — Bosta Daily Automation Setup ==="
echo "Project: $PROJ"
echo ""

# 1. Install Python dependencies
echo "Installing playwright + python-dotenv…"
"$VENV/pip" install --quiet playwright python-dotenv
"$VENV/python" -m playwright install chromium
echo "  ✓ Dependencies installed"

# 2. Create config from template if missing
ENV_FILE="$PROJ/automation/.env.automation"
if [ ! -f "$ENV_FILE" ]; then
  cp "$PROJ/automation/.env.automation.example" "$ENV_FILE"
  echo ""
  echo "  ⚠️  Created automation/.env.automation from template."
  echo "      Edit it now and fill in your EcomHQ admin password before continuing."
  echo ""
fi

# 3. Install launchd plist
mkdir -p "$LAUNCH_AGENTS"
cp "$PROJ/automation/$PLIST_NAME" "$LAUNCH_AGENTS/$PLIST_NAME"

# Unload first if already registered (ignore error if not loaded)
launchctl unload "$LAUNCH_AGENTS/$PLIST_NAME" 2>/dev/null || true

launchctl load "$LAUNCH_AGENTS/$PLIST_NAME"
echo "  ✓ launchd job registered"

echo ""
echo "=== Done ==="
echo "The job will run automatically every day at 07:00 AM (Mac must be on)."
echo ""
echo "To run NOW for testing:"
echo "  launchctl start com.ecomhq.bosta_daily"
echo ""
echo "To check if registered:"
echo "  launchctl list | grep ecomhq"
echo ""
echo "Logs:"
echo "  tail -f /tmp/bosta_daily.log"
echo "  tail -f /tmp/bosta_daily_stderr.log"
