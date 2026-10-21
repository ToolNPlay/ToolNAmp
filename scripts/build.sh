#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=== Building ToolNAmp for macOS ==="

BUILD_DIR="$DIR/build"
APP_DIR="$BUILD_DIR/ToolNAmp.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

# 1. Clean previous build
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR/web"

# 2. Compile Native Objective-C binary with Apple Clang
echo "Compiling native Cocoa Mach-O binary with clang..."
clang -O3 -fobjc-arc \
  -framework Cocoa \
  -framework WebKit \
  "$DIR/src/main.m" \
  -o "$MACOS_DIR/ToolNAmp"

chmod +x "$MACOS_DIR/ToolNAmp"

# 3. Copy Plist & Icons
echo "Packaging Info.plist and AppIcon.icns..."
cp "$DIR/assets/Info.plist" "$CONTENTS_DIR/Info.plist"

if [ -f "$DIR/assets/AppIcon.icns" ]; then
  cp "$DIR/assets/AppIcon.icns" "$RESOURCES_DIR/AppIcon.icns"
fi

# 4. Copy Web resources (HTML, CSS, JS, Demo Tracks)
echo "Packaging Web Assets & Demo Tracks..."
cp -R "$DIR/src/web/"* "$RESOURCES_DIR/web/"

# 5. Ad-Hoc Code Sign for macOS Gatekeeper
echo "Signing App Bundle with Ad-Hoc signature..."
codesign --force --deep --sign - "$APP_DIR"

echo "=== Build Complete! App bundle located at: ==="
echo "$APP_DIR"
