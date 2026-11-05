#!/bin/bash
# ToolNAmp macOS Gatekeeper Quarantine Stripper
# Developed by ToolNPlay.com • Developers: Pardeep Kumar & Harsh Suman

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_PATH="/Applications/ToolNAmp.app"

if [ ! -d "$APP_PATH" ]; then
  APP_PATH="$DIR/ToolNAmp.app"
fi

if [ ! -d "$APP_PATH" ]; then
  echo "❌ ToolNAmp.app not found in /Applications or current folder."
  echo "Please drag ToolNAmp.app to /Applications and run this again."
  exit 1
fi

echo "⚡ Removing macOS Gatekeeper Quarantine attribute from ToolNAmp..."
xattr -cr "$APP_PATH"

echo "✅ Gatekeeper quarantine cleared successfully!"
echo "🚀 Launching ToolNAmp..."
open "$APP_PATH"
exit 0
