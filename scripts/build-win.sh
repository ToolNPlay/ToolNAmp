#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=== Building ToolNAmp for Windows (.exe) ==="

if ! command -v npm &> /dev/null; then
  echo "Error: Node.js and npm are required to build the Windows executable."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing build dependencies..."
  npm install --save-dev electron electron-builder
fi

echo "Packaging Windows 64-bit installer (.exe) & portable (.exe)..."
npx electron-builder --win --x64

echo "=== Windows Build Complete! ==="
echo "Artifacts located in: $DIR/dist/"
