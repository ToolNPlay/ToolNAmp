#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
KEYSTORE="$DIR/android/toolnamp-release.keystore"

export PATH="/opt/homebrew/opt/openjdk@17/bin:/opt/homebrew/opt/openjdk/bin:$PATH"

echo "=== ToolNAmp Android Release Keystore Utility ==="

if [ -f "$KEYSTORE" ]; then
  echo "Keystore already exists at: $KEYSTORE"
else
  echo "Generating official ToolNAmp Android Release Keystore..."
  keytool -genkey -v \
    -keystore "$KEYSTORE" \
    -alias toolnamp \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "toolnamp2026" \
    -keypass "toolnamp2026" \
    -dname "CN=ToolNAmp, OU=ToolNPlay, O=ToolNPlay.com, L=Delhi, ST=Delhi, C=IN"
  echo "Keystore successfully created at: $KEYSTORE"
fi

echo ""
echo "=== Keystore Certificate SHA-256 Fingerprint ==="
keytool -list -v -keystore "$KEYSTORE" -storepass "toolnamp2026" -alias toolnamp 2>/dev/null | grep -E "SHA1:|SHA256:" || echo "Run in Java environment to print fingerprint."
