#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=== Building ToolNAmp Lightweight Native Windows Executable (.exe) ==="

if ! command -v x86_64-w64-mingw32-g++ &> /dev/null; then
  echo "Error: x86_64-w64-mingw32-g++ is required."
  echo "On macOS run: brew install mingw-w64"
  exit 1
fi

mkdir -p "$DIR/build/ToolNAmp-Lightweight-Win64/web"

echo "Compiling native Win32 C++ executable..."
x86_64-w64-mingw32-g++ -std=c++17 -O2 -s \
  -I "$DIR/windows/include" \
  "$DIR/windows/main.cpp" \
  -o "$DIR/build/ToolNAmp-Lightweight.exe" \
  -mwindows -lole32 -loleaut32 -lshlwapi -lversion -lcomdlg32

echo "Packaging lightweight distribution..."
cp "$DIR/build/ToolNAmp-Lightweight.exe" "$DIR/build/ToolNAmp-Lightweight-Win64/ToolNAmp.exe"
cp -R "$DIR/src/web/"* "$DIR/build/ToolNAmp-Lightweight-Win64/web/"
cp "$DIR/assets/icon.png" "$DIR/build/ToolNAmp-Lightweight-Win64/icon.png"

cd "$DIR/build"
rm -f ToolNAmp-Windows-Lightweight.zip
zip -r -9 ToolNAmp-Windows-Lightweight.zip ToolNAmp-Lightweight-Win64 > /dev/null

echo "Lightweight Windows release ready:"
ls -lh "$DIR/build/ToolNAmp-Lightweight.exe" "$DIR/build/ToolNAmp-Windows-Lightweight.zip"

"$DIR/scripts/generate-checksums.sh"
