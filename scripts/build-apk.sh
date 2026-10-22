#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

if [ -d "/opt/homebrew/opt/openjdk@17" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [ -d "$HOME/Library/Android/sdk" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

echo "=== Preparing ToolNAmp Android Project & APK Assets ==="

ASSETS_DIR="$DIR/android/app/src/main/assets/web"
mkdir -p "$ASSETS_DIR"

echo "Syncing lightweight web player assets to Android package..."
cp -R "$DIR/src/web/"* "$ASSETS_DIR/"

echo "Assets prepared at: $ASSETS_DIR"

if command -v ./gradlew &> /dev/null || [ -f "$DIR/android/gradlew" ]; then
  echo "Building ToolNAmp Android APK..."
  cd "$DIR/android"
  ./gradlew assembleRelease || ./gradlew assembleDebug
  
  if [ -f "$DIR/android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp "$DIR/android/app/build/outputs/apk/release/app-release.apk" "$DIR/build/ToolNAmp.apk"
    echo "Release APK ready at: $DIR/build/ToolNAmp.apk"
  elif [ -f "$DIR/android/app/build/outputs/apk/debug/app-debug.apk" ]; then
    cp "$DIR/android/app/build/outputs/apk/debug/app-debug.apk" "$DIR/build/ToolNAmp.apk"
    echo "Debug APK ready at: $DIR/build/ToolNAmp.apk"
  fi
  "$DIR/scripts/generate-checksums.sh"
else
  echo ""
  echo "Android Studio Project Ready at: $DIR/android"
  echo "To build from terminal with Gradle installed, run:"
  echo "  cd android && ./gradlew assembleRelease"
fi
