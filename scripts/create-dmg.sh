#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=== Creating ToolNAmp DMG Installer ==="

BUILD_DIR="$DIR/build"
APP_DIR="$BUILD_DIR/ToolNAmp.app"
DMG_PATH="$BUILD_DIR/ToolNAmp.dmg"
STAGE_DIR="$BUILD_DIR/dmg_stage"
TEMP_ISO="$BUILD_DIR/temp_stage.iso"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: ToolNAmp.app not found. Please run scripts/build.sh first."
  exit 1
fi

# Clean previous dmg and staging files
rm -rf "$STAGE_DIR" "$DMG_PATH" "$TEMP_ISO"
mkdir -p "$STAGE_DIR"

echo "Copying ToolNAmp.app to DMG staging directory..."
cp -R "$APP_DIR" "$STAGE_DIR/"

echo "Creating /Applications shortcut for drag-and-drop installation..."
ln -s /Applications "$STAGE_DIR/Applications"

# Add README note inside DMG
cat << 'EOF' > "$STAGE_DIR/How to Install.txt"
⚡ TOOLNAMP - High Fidelity Retro Music Player ⚡
Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman

INSTALLATION:
Simply drag "ToolNAmp.app" into the "Applications" folder shortcut!

FEATURES:
- Authentic Native macOS Window Controls (Close, Minimize, Zoom/Maximize)
- 1-Click Audio Visualizer Maximize / Theater Mode (Press 'F' or click ⤢ MAXIMIZE)
- 10-Band Graphic Equalizer with Winamp Presets & Preamp
- 5 Real-Time Audio Visualizers (Spectrum Analyzer with Falling Peaks, Oscilloscope, Cyberpunk Bars, Circular Radian, 3D Warp Starfield)
- Window Shade / Mini Player Mode (Press 'W' to shrink to compact bar)
- DSP Effects: Reverb Simulator, Bass Booster, Stereo Expander, DJ Pitch/Speed slider
- 25 Rich Themes: Diwali, New Year 2026, Christmas, Holi, Dussehra, Ram Navami, Janmashtami, Maha Shivratri, Halloween, Winamp Classic, Matrix, Game Boy, Amber CRT, Hi-Fi Woodgrain, Modern Mac Glass, Cyberpunk 2077, Vaporwave, Dracula, Nord, Tokyo Night, Pure OLED, Synthwave, Emerald Luxe, Solarized Dark
- Offline Music Player: High-performance local audio engine with persistent collection history and zero cloud requirement
- Native Drag & Drop for audio files and folders directly from Finder!

KEYBOARD SHORTCUTS:
Space = Play/Pause
Z = Previous Track
X = Play
C = Pause
V = Stop
B = Next Track
E = Toggle Equalizer
P = Toggle Playlist
F = 1-Click Visualizer Maximize / Theater Mode
ESC = Restore Visualizer / Close Modal
Left/Right = Seek 5s
Up/Down = Volume
S = Shuffle
R = Repeat
W = Window Shade / Mini Bar
L = Open Files
1-0 = Switch Themes
EOF

echo "Creating native macOS compressed DMG (UDZO format)..."
hdiutil create -volname "ToolNAmp" -srcfolder "$STAGE_DIR" -ov -format UDZO "$DMG_PATH"

# Cleanup staging files
rm -rf "$STAGE_DIR"

echo "=== DMG Build Successful! ==="
echo "DMG File: $DMG_PATH"
ls -lh "$DMG_PATH"
