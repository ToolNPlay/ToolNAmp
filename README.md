# ⚡ ToolNAmp — High-Fidelity Retro Music Player

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Android-blue.svg)](https://toolnplay.com)
[![Release](https://img.shields.io/badge/Release-v1.0.0-emerald.svg)](https://toolnplay.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Audio](https://img.shields.io/badge/Audio-WebAudio%20%2B%20DSP%20Engine-cyan.svg)](https://toolnplay.com)

> **Developed by**: [ToolNPlay.com](https://toolnplay.com) • [GitHub](https://github.com/toolnplay)  
> **Authors**:  
> - **Pardeep Kumar** — [LinkedIn](https://www.linkedin.com/in/pardeeppatel/) • [GitHub](https://github.com/pardeeppatel)  
> - **Harsh Suman** — [LinkedIn](https://www.linkedin.com/in/harshsuman/)  
> **Target Formats**: macOS (`.dmg`), Windows (`.exe`), Android (`.apk`)

**ToolNAmp** is an ultra-fast, minimalistic, yet feature-packed offline music player inspired by the legendary aesthetics and tactile experience of **Winamp**, re-engineered for modern platforms with 25 themes, a 10-band graphic equalizer, 5 real-time 60 FPS audio visualizers, DSP effects rack, window shading, and persistent playback history.

---

## 📸 Screenshots & Showcase

- **Winamp Classic & Modern Skins**: Authentic brushed metal, phosphor green LCD, glowing VU meters, and tactile buttons.
- **1-Click Theater Visualizer**: Expand the stage to fullscreen or maximized window with one click (`F` or `⤢ MAXIMIZE`).
- **Window Shade / Mini Player**: Shrink ToolNAmp to a compact 48px desktop bar (`W`).
- **25 Rich Themes**: Curated festival skins (Diwali, New Year, Christmas, Holi, Dussehra, Ram Navami, Janmashtami, Maha Shivratri, Halloween) and iconic retro computing skins (Winamp Classic, The Matrix, Game Boy, Amber CRT, Vintage Hi-Fi, Cyberpunk 2077, OLED Black, and more).

---

## 📦 Cross-Platform Releases & Downloads

ToolNAmp is built from a single unified codebase with native platform bindings:

| Platform | Format | File | Size | Build Command | Output Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Windows** | Native Win32 WebView2 Portable | `ToolNAmp-Windows-Lightweight.zip` | **`798 KB`** | `./windows/build-lightweight.sh` | `build/ToolNAmp-Windows-Lightweight.zip` |
| **macOS** | Native Cocoa DMG Installer | `ToolNAmp.dmg` | **`1.3 MB`** | `./scripts/build.sh && ./scripts/create-dmg.sh` | `build/ToolNAmp.dmg` |
| **Android** | Release Signed APK Package | `ToolNAmp.apk` | **`8.9 MB`** | `./scripts/build-apk.sh` | `build/ToolNAmp.apk` |
| **Windows** | Full Offline NSIS Installer | `ToolNAmp-Setup.exe` | **`74 MB`** | `npm run build:win` | `build/ToolNAmp-Setup.exe` |
| **Windows** | Full Offline Portable Executable | `ToolNAmp-Portable.exe` | **`74 MB`** | `npm run build:win:portable` | `build/ToolNAmp-Portable.exe` |

---

## ✨ Features & Capabilities

### 1. 🎛️ 10-Band Graphic Equalizer with Preamp
- **10 Frequency Bands**: 32 Hz, 64 Hz, 125 Hz, 250 Hz, 500 Hz, 1 kHz, 2 kHz, 4 kHz, 8 kHz, 16 kHz.
- **Master Preamp**: -12 dB to +12 dB gain adjustment.
- **Instant Bypass**: Toggle EQ processing on or off.
- **13 Built-in Audiophile Presets**: Flat, Rock, Pop, Techno, Dance, Club, Bass Boost, Vocal Boost, Heavy Metal, Classical, Jazz, Acoustic, Reggae.
- **Live Response Curve**: Real-time cubic spline rendering of the audio frequency response curve.

### 2. 🌌 5 Real-Time 60 FPS Audio Visualizers
Cycle through visualizer modes by clicking the screen or using direct selector chips:
1. **Classic Winamp Spectrum Analyzer**: 32 segmented LED frequency bars (Green ➔ Amber ➔ Red) with gravity-accelerated peak drop markers.
2. **Analog Oscilloscope Waveform**: Glowing phosphor green oscilloscope tracking raw time-domain audio samples.
3. **Cyberpunk Neon Bars**: 40 floating gradient bars with perspective floor reflections.
4. **Circular Radian Spectrum**: 360° radial frequency burst radiating from a pulsing audio-reactive core.
5. **3D Warp Speed Starfield**: Starfield depth warp that pulses dynamically with low-end bass kicks.
- **1-Click Visualizer Maximize / Theater Mode**: Press `F` or click `⤢ MAXIMIZE` to expand the visualizer stage over the entire player with dedicated playback transport controls. Press `ESC` or `F` to restore.

### 3. 🎚️ DSP Audio Effects Rack & DJ Controls
- **DJ Pitch & Speed Slider**: Real-time tempo/pitch adjustment from `0.5x` to `2.0x` with instant `1.0x` reset.
- **Procedural Convolution Reverb**: Simulated acoustic spaces including Small Room, Recording Studio, Concert Hall, and Cathedral with wet mix slider.
- **Sub-Bass Booster**: Dedicated 80 Hz low-shelf sub-bass peaking dial (0 to +12 dB).
- **3D Spatial Stereo Expander**: Adjusts stereo soundstage width from 0% (Mono) to 200% (Super Wide).
- **L/R Stereo Balance**: Pan fader with center detent.

### 4. 🪟 Window Shade / Mini Player Mode
- Press `W` (or click `_` in the header) to collapse ToolNAmp into an ultra-sleek, compact horizontal bar (~48px height).
- Displays marquee song info, mini live visualizer, playback controls, time, and volume.
- **Always on Top (Float)**: Click `📌` or press `T` to pin ToolNAmp over other windows while coding, gaming, or browsing.

### 5. 🎨 25 Rich Skins & Festival Themes
Switch themes on the fly from the dropdown menu:

#### 🪔 Festivals & Celebrations
- **Diwali**: Warm deep crimson, golden diya glow, and festive amber typography.
- **New Year 2026**: Midnight navy with sparkling celebratory gold and magenta accents.
- **Christmas**: Evergreen pine needles with holly berry red accents.
- **Holi**: Festive splash of vibrant Gulal pink, turmeric yellow, and pichkari cyan.
- **Dussehra**: Royal sunset saffron with victory gold highlights.
- **Ram Navami**: Sacred Kesariya saffron, Vedic yellow, and dawn gold.
- **Janmashtami**: Krishna peacock feather azure, flute gold, and divine dark blue.
- **Maha Shivratri**: Cosmic void deep indigo, Trishul blue, and sacred ash silver.
- **Halloween**: Haunted pumpkin black, glowing jack-o'-lantern orange, and witch violet.

#### ⚡ Retro & Iconic Winamp
- **Winamp Classic (1998)**: Authentic charcoal brushed steel, green LCD, tactile beveled buttons.
- **Mac OS System 7 Platinum**: 1990s Macintosh system platinum grey with embossed 3D bevels.
- **The Matrix**: Phosphor green digital rain and black terminal aesthetics.
- **Nintendo Game Boy (1989)**: 4-shade olive green dot-matrix LCD nostalgia.
- **Amber CRT**: 1980s monochrome phosphor glow.
- **70s Vintage Hi-Fi Woodgrain**: Luxurious walnut cabinet, brushed brass meters, warm analog lamps.

#### 🎨 Modern & Audiophile
- **Modern Mac Glass**: Translucent frosted glass with glowing cyan accents.
- **Cyberpunk 2077**: Carbon fiber weave, high-contrast neon yellow and magenta HUD.
- **Vaporwave**: 80s synth aesthetics, neon cyan, and magenta gradients.
- **Synthwave Sunset**: Neon sunset orange, purple horizon, and grid vibes.
- **Dracula Pro**: High-contrast purple and dark slate audiophile theme.
- **Nord Arctic Frost**: Cool Scandinavian glacier blues and slate greys.
- **Tokyo Night**: Deep indigo neon aesthetic inspired by Tokyo nightlife.
- **Pure OLED Black**: #000000 pitch black contrast for OLED displays.
- **Emerald Luxe**: British racing green and polished gold borders.
- **Solarized Dark**: Precision low-fatigue palette for late-night listening.

### 6. 📁 Universal Audio Format Support & History Persistence
- **Audio Codecs**: MP3, WAV, FLAC, M4A, AAC, OGG, AIFF, and WEBM.
- **Native Drag & Drop**: Drag single audio files or entire folders from Finder/Explorer directly onto ToolNAmp.
- **Recursive Folder Ingestion**: Automatically scans nested subfolders for music.
- **Collection History Persistence**: Remembers your entire playlist, current song, volume, and playback seek position across app restarts (`collection.json`).
- **M3U Playlist Support**: Export and import standard `.m3u` / `.m3u8` playlist files.
- **ID3 Metadata Inspector**: Click `INFO` to view sample rate, bitrate, format, file size, artist, and spinning vinyl album animation.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause |
| <kbd>Z</kbd> | Previous Track |
| <kbd>X</kbd> | Play |
| <kbd>C</kbd> | Pause |
| <kbd>V</kbd> | Stop |
| <kbd>B</kbd> | Next Track |
| <kbd>←</kbd> / <kbd>→</kbd> | Seek Backward / Forward 5 seconds |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Volume Up / Down (+/- 5%) |
| <kbd>M</kbd> | Mute / Unmute Audio |
| <kbd>S</kbd> | Toggle Shuffle (Smart non-repeating queue) |
| <kbd>R</kbd> | Toggle Repeat (All ➔ One ➔ Off) |
| <kbd>E</kbd> | Toggle 10-Band Equalizer Drawer |
| <kbd>P</kbd> | Toggle Playlist Drawer |
| <kbd>F</kbd> | Toggle 1-Click Visualizer Maximize / Theater Mode |
| <kbd>ESC</kbd> | Restore Visualizer / Close Modals |
| <kbd>W</kbd> | Toggle Window Shade / Mini Player Mode |
| <kbd>T</kbd> | Toggle Always on Top (Floating Window) |
| <kbd>L</kbd> / <kbd>Cmd+O</kbd> | Open Audio Files Dialog |
| <kbd>1</kbd> - <kbd>0</kbd> | Switch Themes / Skins |

---

## 🛠️ Building & Packaging

### macOS (.dmg)
Build the native Cocoa/WebKit Mach-O application and compressed `.dmg` installer:
```bash
# 1. Compile native macOS bundle:
./scripts/build.sh

# 2. Package into ToolNAmp.dmg:
./scripts/create-dmg.sh
```
Output: `build/ToolNAmp.dmg` (~1.7 MB)

### Windows (.exe)
Package the Windows 64-bit installer and portable executable using Electron:
```bash
# On macOS / Linux:
npm run build:win

# On Windows:
scripts\build-win.bat
```
Output: `dist/ToolNAmp Setup 1.0.0.exe` and `dist/ToolNAmp 1.0.0.exe`

### Android (.apk)
Sync web assets and build Android APK with background playback and MediaStore scanning:
```bash
# 1. Prepares web assets into Android project:
./scripts/build-apk.sh

# 2. Generate Release Keystore (if needed):
./scripts/generate-keystore.sh

# 3. Build signed APK:
cd android
./gradlew assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release.apk` (or `build/ToolNAmp.apk`)

---

## 🔒 Security, Signing & SHA-256 Checksum Verification

### 1. Verifying Releases via SHA-256
Every official ToolNAmp build is fingerprinted with an immutable SHA-256 hash. To verify your downloaded file against `build/SHA256SUMS.txt`:

```bash
# Verify on macOS / Linux:
shasum -a 256 -c build/SHA256SUMS.txt

# Or compute directly:
shasum -a 256 ToolNAmp.dmg
shasum -a 256 ToolNAmp.apk
```

Official release hashes:
```text
20583f8e6f501f800be88f461c30cbb08c36ecd3bd8c24ec62fdf97e2e7303c2  ToolNAmp.dmg
04763e6f5a8d60f82cde37dbc5f4f81c71a7eb06546ca8c33c64037aa6b16cd3  ToolNAmp.apk
2c6f4cc9d9a942cdca3bfbd55db0ae406301e539c604aa0a89ef498107216adc  ToolNAmp-Lightweight.exe
9253d6b18ecc30724711de03c7d7fcbf9a9f8a6965e18ac03318c9bc42113f83  ToolNAmp-Windows-Lightweight.zip
fc180d313808ce3b32986342fff555a364d3da44597ed1863ca04de38ee0a084  ToolNAmp-Setup.exe
8a7de6d6e31c429a6684b17d1db434e124c2730c50814890a316f44cc9eb38a0  ToolNAmp-Portable.exe
```

### 2. macOS Gatekeeper Verification
Because ToolNAmp is distributed independently as open-source software, macOS Gatekeeper may show:  
`"ToolNAmp" cannot be opened because Apple cannot check it for malicious software` or `Unidentified Developer`.

To open frictionless on macOS:
- **Method 1 (GUI)**: Right-click (or Control-click) `ToolNAmp.app` in `/Applications` and select **Open**, then click **Open**. macOS remembers this approval permanently.
- **Method 2 (Terminal)**: Remove the quarantine bit:
  ```bash
  xattr -cr /Applications/ToolNAmp.app
  ```

### 3. Android Source & Signature Verification
Android users can verify the authentic origin and certificate fingerprint of `ToolNAmp.apk`:
```bash
# Verify APK signature:
apksigner verify --verbose --print-certs ToolNAmp.apk

# Or check certificate with keytool:
keytool -printcert -jarfile ToolNAmp.apk
```
Key attributes:
- **Developer**: ToolNPlay.com (Pardeep Kumar & Harsh Suman)
- **Algorithm**: RSA 2048-bit with SHA-256 digest
- **Certificate SHA-256 Fingerprint**: `db:fa:89:6a:97:d8:fe:87:4f:93:24:d5:1b:b9:b3:a3:ca:00:a8:86:8f:89:81:b3:0c:b0:d3:4a:94:0f:89:02`
- **Certificate SHA-1 Fingerprint**: `2a:a8:e3:1c:e2:a4:27:a6:c7:b5:1a:2e:4a:8b:76:7c:06:4a:b0:e3`

---

## 📱 Mobile Architecture & Background Playback

ToolNAmp on Android includes full native mobile capabilities designed for battery efficiency and background playback:

- **Screen-Locked Background Audio**:
  - Leverages Android `WAKE_LOCK` (`PARTIAL_WAKE_LOCK`) and `FOREGROUND_SERVICE_MEDIA_PLAYBACK`.
  - Integrates with the W3C `navigator.mediaSession` API.
  - Native lock-screen controls, Bluetooth audio metadata, smartwatch controls, and notification shade controls remain active when the phone screen is locked.
- **Automated Device Music Scanner**:
  - Uses `MediaStore.Audio.Media` to discover and index all local MP3, FLAC, WAV, M4A, and AAC files across internal storage and SD cards in seconds.
  - Storage Access Framework (SAF) folder picker for custom music directories (`ACTION_OPEN_DOCUMENT_TREE`).
- **Responsive & Minimal Player Layout**:
  - Touch-optimized transport buttons (`width: 58px`, `height: 38px`).
  - Fluid scrolling playlist with tap-to-play rows.
  - Touch-scrollable 10-band equalizer.
  - Auto-minimizes to background on back-press (`moveTaskToBack(true)`) so music continues playing uninterrupted.

---

## 🖥️ Desktop Auto-Scan Music Library

On macOS and Windows:
- **1-Click Auto-Scan**: Click `🔍 SCAN` in the Playlist Manager action bar or press **Cmd + Shift + S** (`File ➔ Auto-Scan Music Library`).
- Automatically indexes `~/Music`, `~/Desktop`, and `~/Downloads` recursively (skipping system/hidden folders), adding all discovered tracks to the playlist instantly.

---

## 📂 Project Architecture

```
ToolNAmp/
├── build/
│   ├── ToolNAmp.app           # Native macOS Application bundle
│   ├── ToolNAmp.dmg           # Distributable macOS DMG installer (1.3 MB)
│   └── SHA256SUMS.txt         # Official cryptographic release checksums
├── assets/
│   ├── AppIcon.icns           # High-resolution multi-size macOS icon
│   ├── icon.png               # High-resolution 512x512 icon for Windows & Android
│   └── Info.plist             # macOS App configuration & registered audio types
├── electron/
│   ├── main.js                # Windows/Linux Electron host & local streaming protocol
│   └── preload.js             # Native IPC bridge for Windows
├── android/
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml  # Android Audio, Media & Foreground permissions
│   │   └── src/main/java/com/toolnplay/toolnamp/MainActivity.java # Native Android Bridge & MediaStore
│   └── build.gradle           # Android Gradle configuration with release signing block
├── scripts/
│   ├── build.sh               # Native Apple Clang compilation script
│   ├── create-dmg.sh          # Native DMG disk image creator with SHA-256
│   ├── generate-checksums.sh  # Official SHA-256 checksum calculator
│   ├── generate-keystore.sh   # Android release keystore generator
│   ├── build-apk.sh           # Android asset packaging script
│   ├── build-win.sh           # Windows .exe packaging script
│   └── build-win.bat          # Windows native batch script
├── src/
│   ├── main.m                 # Native Cocoa / AppKit / WebKit macOS entrypoint
│   └── web/
│       ├── index.html         # Responsive Winamp layout & DOM structure
│       ├── style.css          # 25 themes & mobile minimal touch stylesheet
│       ├── audio-engine.js    # Web Audio API graph (10-band EQ, Reverb, VU)
│       ├── visualizer.js      # 60fps canvas visualizer (5 modes + Theater mode)
│       ├── equalizer.js       # EQ bands, presets, & curve renderer
│       └── app.js             # MediaSession, auto-scan, playlist, hotkeys
├── package.json               # Node / Electron build definitions
├── capacitor.config.json      # Mobile Capacitor configuration
├── LICENSE                    # MIT License
└── README.md                  # Comprehensive Documentation
```

---

## 📜 License & Credits

Developed with ❤️ by **[ToolNPlay.com](https://toolnplay.com)** ([GitHub](https://github.com/toolnplay))  
- **Pardeep Kumar**: [LinkedIn](https://www.linkedin.com/in/pardeeppatel/) • [GitHub](https://github.com/pardeeppatel)  
- **Harsh Suman**: [LinkedIn](https://www.linkedin.com/in/harshsuman/)  

Released under the **[MIT License](LICENSE)**. Open source and free for personal and commercial use.
