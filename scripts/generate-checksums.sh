#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
BUILD_DIR="$DIR/build"
OUTPUT_FILE="$BUILD_DIR/SHA256SUMS.txt"

mkdir -p "$BUILD_DIR"
rm -f "$OUTPUT_FILE"

echo "=== Computing SHA-256 Checksums for ToolNAmp Releases ==="

calc_sha256() {
  local target="$1"
  if [ -f "$target" ]; then
    local filename=$(basename "$target")
    local sum=$(shasum -a 256 "$target" | awk '{print $1}')
    echo "$sum  $filename" >> "$OUTPUT_FILE"
    printf "%-30s : %s\n" "$filename" "$sum"
  fi
}

# 1. macOS DMG
calc_sha256 "$BUILD_DIR/ToolNAmp.dmg"

# 2. Android APK
calc_sha256 "$BUILD_DIR/ToolNAmp.apk"

# 3. Windows Exe (Lightweight & Full Setup)
calc_sha256 "$BUILD_DIR/ToolNAmp-Lightweight.exe"
calc_sha256 "$BUILD_DIR/ToolNAmp-Windows-Lightweight.zip"
calc_sha256 "$BUILD_DIR/ToolNAmp-Setup.exe"
calc_sha256 "$BUILD_DIR/ToolNAmp-Portable.exe"

echo ""
echo "Checksums saved to: $OUTPUT_FILE"
echo ""
echo "Verify any release file using:"
echo "  shasum -a 256 -c SHA256SUMS.txt"
