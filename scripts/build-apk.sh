#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=== Preparing ToolNAmp Android Project & APK Assets ==="

ASSETS_DIR="$DIR/android/app/src/main/assets/web"
mkdir -p "$ASSETS_DIR"

echo "Syncing web assets to Android package..."
cp -R "$DIR/src/web/"* "$ASSETS_DIR/"

echo "Assets prepared at: $ASSETS_DIR"

if command -v gradle &> /dev/null; then
  echo "Gradle detected. Building Android APK..."
  cd "$DIR/android"
  gradle assembleDebug
  echo "Debug APK built at: $DIR/android/app/build/outputs/apk/debug/app-debug.apk"
else
  echo "Note: Gradle is not in PATH. You can open the 'android' folder directly in Android Studio"
  echo "or run './gradlew assembleRelease' to build ToolNAmp.apk."
fi
