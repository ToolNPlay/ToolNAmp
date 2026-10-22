/**
 * ToolNAmp Main Application Controller
 * Handles Playlist, Drag & Drop, Playback State,
 * UI Updates, Cross-Platform Native Bridge, and Keyboard Shortcuts.
 * Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman
 */

class ToolNAmpApp {
  constructor() {
    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isPaused = false;
    this.isMuted = false;
    this.previousVolume = 80;
    
    this.shuffle = false;
    this.repeatMode = 'all'; // 'all', 'one', 'off'
    this.timeMode = 'elapsed'; // 'elapsed' or 'remaining'
    this.isMiniMode = false;
    this.alwaysOnTop = false;
    
    this.shuffleHistory = [];
    this.currentTrackMeta = null;

    this.init();
  }

  async init() {
    this.bindDOM();
    this.bindWindowDrag();
    this.bindKeyboard();
    this.bindDragAndDrop();
    this.bindAudioEvents();
    this.bindPersistenceEvents();
    this.loadSavedTheme();
    this.startVUMeterLoop();
    this.initMediaSession();

    // Load persisted collection from history
    const restored = this.loadSavedCollection();
    if (!restored || this.playlist.length === 0) {
      this.updatePlaylistUI();
    }
  }

  bindPersistenceEvents() {
    window.addEventListener('beforeunload', () => this.saveCollection());
    window.addEventListener('pagehide', () => this.saveCollection());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.saveCollection();
      }
    });
  }

  // --- COLLECTION PERSISTENCE & HISTORY SYSTEM ---
  saveCollection() {
    try {
      const state = {
        version: 1,
        savedAt: Date.now(),
        lastTrackIndex: this.currentIndex,
        lastTrackId: (this.currentIndex >= 0 && this.playlist[this.currentIndex]) ? this.playlist[this.currentIndex].id : null,
        lastSeekTime: (window.audioEngine && window.audioEngine.audioElement) ? window.audioEngine.audioElement.currentTime : 0,
        volume: document.getElementById('volumeSlider') ? parseInt(document.getElementById('volumeSlider').value, 10) : 80,
        pan: document.getElementById('panSlider') ? parseInt(document.getElementById('panSlider').value, 10) : 0,
        shuffle: this.shuffle,
        repeatMode: this.repeatMode,
        tracks: this.playlist.filter(t => !t.url.startsWith('blob:')).map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          url: t.url,
          format: t.format,
          sampleRate: t.sampleRate,
          bitrate: t.bitrate,
          size: t.size
        }))
      };

      const jsonStr = JSON.stringify(state);
      localStorage.setItem('toolnamp_collection_state', jsonStr);

      // Also persist to native application storage collection.json
      this.sendNative('saveCollection', { data: jsonStr });
    } catch (e) {
      console.warn("Failed to save collection:", e);
    }
  }

  loadSavedCollection() {
    try {
      const raw = localStorage.getItem('toolnamp_collection_state') || localStorage.getItem('macamp_collection_state');
      if (raw) {
        const state = JSON.parse(raw);
        if (state && Array.isArray(state.tracks) && state.tracks.length > 0) {
          this.applyCollectionState(state);
          return true;
        }
      }
    } catch (e) {
      console.warn("Failed to load collection from localStorage:", e);
    }
    return false;
  }

  applyCollectionState(state) {
    if (!state || !Array.isArray(state.tracks)) return;

    // Filter valid offline tracks (macamp-audio://, toolnamp-audio://, or relative audio files)
    this.playlist = state.tracks.filter(t => t && t.url && !t.url.startsWith('blob:') && !t.id?.startsWith('yt-') && !t.url.includes('googlevideo.com') && !t.url.startsWith('http://') && !t.url.startsWith('https://'));
    
    if (typeof state.shuffle === 'boolean') {
      this.shuffle = state.shuffle;
      document.getElementById('btnShuffle')?.classList.toggle('active', this.shuffle);
    }
    if (state.repeatMode) {
      this.repeatMode = state.repeatMode;
      const repBtn = document.getElementById('btnRepeat');
      if (repBtn) repBtn.textContent = `REP: ${this.repeatMode.toUpperCase()}`;
    }

    this.updatePlaylistUI();

    if (this.playlist.length > 0) {
      let targetIndex = 0;
      if (typeof state.lastTrackIndex === 'number' && state.lastTrackIndex >= 0 && state.lastTrackIndex < this.playlist.length) {
        targetIndex = state.lastTrackIndex;
      } else if (state.lastTrackId) {
        const found = this.playlist.findIndex(t => t.id === state.lastTrackId);
        if (found !== -1) targetIndex = found;
      }

      // Select track ready to play from history WITHOUT auto-starting playback
      this.selectTrack(targetIndex, false);

      // Restore seek time if saved
      if (state.lastSeekTime && state.lastSeekTime > 0) {
        setTimeout(() => {
          if (window.audioEngine) {
            window.audioEngine.seek(state.lastSeekTime);
            this.updateSeekBar();
            this.updateTimeDisplay();
          }
        }, 120);
      }

      const marquee = document.getElementById('trackMarquee');
      if (marquee && this.playlist[targetIndex]) {
        marquee.textContent = `⚡ Restored Collection (${this.playlist.length} Tracks) • Last: ${this.playlist[targetIndex].title} - ${this.playlist[targetIndex].artist} ⚡`;
      }
    } else {
      this.currentIndex = -1;
      const marquee = document.getElementById('trackMarquee');
      if (marquee) {
        marquee.textContent = `⚡ TOOLNAMP HIGH FIDELITY • READY TO ROCK • OPEN OR DROP AUDIO FILES ⚡`;
      }
    }
  }

  // Method invoked when native Cocoa delivers collection.json on launch
  loadCollectionFromNative(jsonStr) {
    try {
      const state = (typeof jsonStr === 'string') ? JSON.parse(jsonStr) : jsonStr;
      if (state && Array.isArray(state.tracks) && state.tracks.length > 0) {
        this.applyCollectionState(state);
      }
    } catch (e) {
      console.warn("Failed to parse native collection:", e);
    }
  }

  // Bind all UI controls
  bindDOM() {
    // Top Bar window actions (Cocoa Bridge integration) with high reliability
    const setupWinBtn = (id, action) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Stop window drag from ever capturing this
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.sendNative(action);
      });
    };

    setupWinBtn('btnWinClose', 'closeWindow');
    setupWinBtn('btnWinMin', 'minimizeWindow');
    setupWinBtn('btnWinZoom', 'zoomWindow');

    setupWinBtn('miniBtnWinClose', 'closeWindow');
    setupWinBtn('miniBtnWinMin', 'minimizeWindow');
    setupWinBtn('miniBtnWinZoom', 'zoomWindow');
    
    // Always on Top
    const btnTop = document.getElementById('btnAlwaysOnTop');
    btnTop?.addEventListener('click', () => {
      this.alwaysOnTop = !this.alwaysOnTop;
      btnTop.classList.toggle('active', this.alwaysOnTop);
      this.sendNative('setAlwaysOnTop', { value: this.alwaysOnTop });
    });

    // Window Shade / Mini mode toggle
    const btnShade = document.getElementById('btnWindowShade');
    const btnUnshade = document.getElementById('btnUnshade');
    btnShade?.addEventListener('click', () => this.toggleMiniMode());
    btnUnshade?.addEventListener('click', () => this.toggleMiniMode());

    // Theme Selector
    const themeSel = document.getElementById('themeSelector');
    themeSel?.addEventListener('change', (e) => this.setTheme(e.target.value));

    // Time Mode toggle
    document.getElementById('timeDisplay')?.addEventListener('click', () => {
      this.timeMode = this.timeMode === 'elapsed' ? 'remaining' : 'elapsed';
      const label = document.getElementById('timeModeLabel');
      if (label) label.textContent = this.timeMode.toUpperCase();
      this.updateTimeDisplay();
    });

    // Transport buttons
    document.getElementById('btnPlayPause')?.addEventListener('click', () => this.togglePlayPause());
    document.getElementById('btnStop')?.addEventListener('click', () => this.stop());
    document.getElementById('btnPrev')?.addEventListener('click', () => this.prevTrack());
    document.getElementById('btnNext')?.addEventListener('click', () => this.nextTrack());
    document.getElementById('btnOpen')?.addEventListener('click', () => this.openFilePicker());

    // Mini bar controls
    document.getElementById('miniPlay')?.addEventListener('click', () => this.togglePlayPause());
    document.getElementById('miniPrev')?.addEventListener('click', () => this.prevTrack());
    document.getElementById('miniNext')?.addEventListener('click', () => this.nextTrack());

    // Seek scrubber
    const seekBar = document.getElementById('seekBar');
    const seekTooltip = document.getElementById('seekTooltip');
    const seekBarWrap = document.getElementById('seekBarWrap');

    seekBar?.addEventListener('input', (e) => {
      if (window.audioEngine && window.audioEngine.audioElement.duration) {
        const percent = parseFloat(e.target.value);
        const sec = (percent / 100.0) * window.audioEngine.audioElement.duration;
        window.audioEngine.seek(sec);
        this.updateTimeDisplay();
      }
    });

    seekBarWrap?.addEventListener('mousemove', (e) => {
      if (window.audioEngine && window.audioEngine.audioElement.duration && seekTooltip) {
        const rect = seekBarWrap.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const previewSec = pos * window.audioEngine.audioElement.duration;
        seekTooltip.style.display = 'block';
        seekTooltip.style.left = `${e.clientX - rect.left - 15}px`;
        seekTooltip.textContent = this.formatTime(previewSec);
      }
    });

    seekBarWrap?.addEventListener('mouseleave', () => {
      if (seekTooltip) seekTooltip.style.display = 'none';
    });

    // Volume & Pan Sliders
    const volSlider = document.getElementById('volumeSlider');
    const miniVolSlider = document.getElementById('miniVolume');
    const volVal = document.getElementById('volVal');
    const volIcon = document.getElementById('volIcon');

    const updateVol = (val) => {
      if (volSlider) volSlider.value = val;
      if (miniVolSlider) miniVolSlider.value = val;
      if (volVal) volVal.textContent = `${val}%`;
      if (window.audioEngine) window.audioEngine.setVolume(val);
      if (volIcon) volIcon.textContent = val == 0 ? '🔇' : val < 40 ? '🔉' : '🔊';
    };

    volSlider?.addEventListener('input', (e) => updateVol(e.target.value));
    miniVolSlider?.addEventListener('input', (e) => updateVol(e.target.value));

    volIcon?.addEventListener('click', () => {
      if (this.isMuted) {
        updateVol(this.previousVolume || 80);
        this.isMuted = false;
      } else {
        this.previousVolume = parseInt(volSlider.value, 10);
        updateVol(0);
        this.isMuted = true;
      }
    });

    const panSlider = document.getElementById('panSlider');
    const panVal = document.getElementById('panVal');
    panSlider?.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (panVal) {
        panVal.textContent = v === 0 ? 'C' : v < 0 ? `L${Math.abs(v)}` : `R${v}`;
      }
      if (window.audioEngine) window.audioEngine.setPan(v);
    });

    // Module toggles (EQ / PL / FX / SHUF / REP)
    const btnEQ = document.getElementById('btnToggleEQ');
    const eqSec = document.getElementById('equalizerSection');
    btnEQ?.addEventListener('click', () => {
      eqSec.classList.toggle('hidden');
      btnEQ.classList.toggle('active', !eqSec.classList.contains('hidden'));
    });

    const btnPL = document.getElementById('btnTogglePL');
    const plSec = document.getElementById('playlistSection');
    btnPL?.addEventListener('click', () => {
      plSec.classList.toggle('hidden');
      btnPL.classList.toggle('active', !plSec.classList.contains('hidden'));
    });

    const btnFX = document.getElementById('btnToggleFX');
    const fxSec = document.getElementById('effectsSection');
    btnFX?.addEventListener('click', () => {
      fxSec.classList.toggle('hidden');
      btnFX.classList.toggle('active', !fxSec.classList.contains('hidden'));
    });

    const btnShuf = document.getElementById('btnShuffle');
    btnShuf?.addEventListener('click', () => {
      this.shuffle = !this.shuffle;
      btnShuf.classList.toggle('active', this.shuffle);
    });

    const btnRep = document.getElementById('btnRepeat');
    btnRep?.addEventListener('click', () => {
      if (this.repeatMode === 'all') {
        this.repeatMode = 'one';
        btnRep.textContent = 'REP 1';
        btnRep.classList.add('active');
      } else if (this.repeatMode === 'one') {
        this.repeatMode = 'off';
        btnRep.textContent = 'REP';
        btnRep.classList.remove('active');
      } else {
        this.repeatMode = 'all';
        btnRep.textContent = 'REP ALL';
        btnRep.classList.add('active');
      }
    });

    // DSP Effects Controls
    const pitchSlider = document.getElementById('pitchSlider');
    const pitchVal = document.getElementById('pitchVal');
    pitchSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (pitchVal) pitchVal.textContent = `${val.toFixed(2)}x`;
      if (window.audioEngine) window.audioEngine.setPlaybackRate(val);
    });

    document.getElementById('btnResetPitch')?.addEventListener('click', () => {
      if (pitchSlider) {
        pitchSlider.value = 1.0;
        pitchSlider.dispatchEvent(new Event('input'));
      }
    });

    document.getElementById('reverbSelect')?.addEventListener('change', (e) => {
      if (window.audioEngine) window.audioEngine.setReverbPreset(e.target.value);
    });

    document.getElementById('reverbWetSlider')?.addEventListener('input', (e) => {
      if (window.audioEngine) window.audioEngine.setReverbWet(e.target.value);
    });

    const bassBoostSlider = document.getElementById('bassBoostSlider');
    const bassBoostVal = document.getElementById('bassBoostVal');
    bassBoostSlider?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (bassBoostVal) bassBoostVal.textContent = `${v} dB`;
      if (window.audioEngine) window.audioEngine.setBassBoost(v);
    });

    // Playlist Search Filter
    document.getElementById('playlistSearch')?.addEventListener('input', (e) => {
      this.filterPlaylist(e.target.value.toLowerCase());
    });

    // Playlist Action Buttons
    document.getElementById('btnAutoScan')?.addEventListener('click', () => this.autoScanMusic());
    document.getElementById('btnAddFiles')?.addEventListener('click', () => this.openFilePicker());
    document.getElementById('btnAddFolder')?.addEventListener('click', () => this.openFolderPicker());
    document.getElementById('btnRemoveSelected')?.addEventListener('click', () => this.removeSelectedTrack());
    document.getElementById('btnClearPlaylist')?.addEventListener('click', () => this.clearPlaylist());
    document.getElementById('btnExportM3U')?.addEventListener('click', () => this.exportM3U());
    document.getElementById('btnImportM3U')?.addEventListener('click', () => document.getElementById('m3uPicker')?.click());

    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.sortPlaylist(e.target.value);
        e.target.value = '';
      }
    });

    // Modals
    document.getElementById('btnSongInfo')?.addEventListener('click', () => this.showInfoModal());
    document.getElementById('btnCloseInfoModal')?.addEventListener('click', () => this.hideInfoModal());
    document.getElementById('btnShortcuts')?.addEventListener('click', () => this.showShortcutsModal());
    document.getElementById('btnCloseShortcutsModal')?.addEventListener('click', () => this.hideShortcutsModal());
    document.getElementById('btnAbout')?.addEventListener('click', () => this.showAboutModal());
    document.getElementById('btnCloseAboutModal')?.addEventListener('click', () => this.hideAboutModal());
    document.getElementById('btnAboutOk')?.addEventListener('click', () => this.hideAboutModal());

    // File input change handlers
    document.getElementById('filePicker')?.addEventListener('change', (e) => this.handleFilesPicked(e.target.files));
    document.getElementById('folderPicker')?.addEventListener('change', (e) => this.handleFilesPicked(e.target.files));
    document.getElementById('m3uPicker')?.addEventListener('change', (e) => this.handleM3UPicked(e.target.files));
  }

  // Window Dragging & Movement for macOS (Native Cocoa Integration)
  bindWindowDrag() {
    let isDragging = false;
    let startScreenX = 0;
    let startScreenY = 0;

    const attachDrag = (el) => {
      if (!el) return;
      el.addEventListener('mousedown', (e) => {
        // Ignore clicks on buttons, inputs, selects, controls
        if (e.target.closest('button, input, select, .window-controls, .win-btn-hitbox, .win-btn-circle, .icon-toggle-btn, .mini-btn, .no-drag')) return;
        if (e.button !== 0) return; // Left mouse button only

        // Double-click on header to toggle maximize/restore
        if (e.detail === 2) {
          this.sendNative('zoomWindow');
          return;
        }

        isDragging = true;
        startScreenX = e.screenX;
        startScreenY = e.screenY;

        // Signal native window to attempt performWindowDragWithEvent
        this.sendNative('startDrag');
      });
    };

    attachDrag(document.getElementById('appHeader'));
    attachDrag(document.getElementById('miniPlayerBar'));

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.screenX - startScreenX;
      const dy = -(e.screenY - startScreenY); // Invert Y for Cocoa window coordinates
      if (dx !== 0 || dy !== 0) {
        startScreenX = e.screenX;
        startScreenY = e.screenY;
        this.sendNative('dragWindowDelta', { dx, dy });
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
      }
    });
  }

  // Keyboard Shortcuts (Winamp Classic Hotkeys)
  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside text or url input boxes
      if (e.target.tagName === 'INPUT') return;

      const key = e.key.toLowerCase();

      switch (key) {
        case ' ': // Space: Play/Pause
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'x': // X: Play
          e.preventDefault();
          this.play();
          break;
        case 'c': // C: Pause
          e.preventDefault();
          this.pause();
          break;
        case 'v': // V: Stop
          e.preventDefault();
          this.stop();
          break;
        case 'z': // Z: Prev
          e.preventDefault();
          this.prevTrack();
          break;
        case 'b': // B: Next
          e.preventDefault();
          this.nextTrack();
          break;
        case 'arrowleft': // Seek -5s
          e.preventDefault();
          if (window.audioEngine) window.audioEngine.seek(window.audioEngine.audioElement.currentTime - 5);
          break;
        case 'arrowright': // Seek +5s
          e.preventDefault();
          if (window.audioEngine) window.audioEngine.seek(window.audioEngine.audioElement.currentTime + 5);
          break;
        case 'arrowup': // Vol +5
          e.preventDefault();
          this.adjustVolume(5);
          break;
        case 'arrowdown': // Vol -5
          e.preventDefault();
          this.adjustVolume(-5);
          break;
        case 'm': // Mute
          document.getElementById('volIcon')?.click();
          break;
        case 's': // Shuffle
          document.getElementById('btnShuffle')?.click();
          break;
        case 'r': // Repeat
          document.getElementById('btnRepeat')?.click();
          break;
        case 'e': // Toggle EQ
          document.getElementById('btnToggleEQ')?.click();
          break;
        case 'p': // Toggle Playlist
          document.getElementById('btnTogglePL')?.click();
          break;
        case 'w': // Toggle Window Shade
          this.toggleMiniMode();
          break;
        case 't': // Toggle Always on Top
          document.getElementById('btnAlwaysOnTop')?.click();
          break;
        case 'l': // Open file
          this.openFilePicker();
          break;
        case 'f': // F: Toggle 1-Click Visualizer Maximize / Theater
          e.preventDefault();
          if (window.visualizer) window.visualizer.toggleMaximize();
          break;
        case 'escape': // Escape: Restore visualizer or close modal
          if (window.visualizer && window.visualizer.isMaximized) {
            window.visualizer.toggleMaximize(false);
          } else {
            this.hideAboutModal();
          }
          break;
        case '1': this.setTheme('festival-diwali'); break;
        case '2': this.setTheme('festival-newyear'); break;
        case '3': this.setTheme('festival-christmas'); break;
        case '4': this.setTheme('festival-holi'); break;
        case '5': this.setTheme('festival-dussehra'); break;
        case '6': this.setTheme('festival-ramnavami'); break;
        case '7': this.setTheme('festival-janmashtami'); break;
        case '8': this.setTheme('festival-shivratri'); break;
        case '9': this.setTheme('festival-halloween'); break;
        case '0': this.setTheme('winamp-classic'); break;
      }
    });
  }

  // Drag and Drop (Files or Folders from Mac Finder)
  bindDragAndDrop() {
    const dropOverlay = document.getElementById('dropZoneOverlay');

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropOverlay?.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        dropOverlay?.classList.add('hidden');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropOverlay?.classList.add('hidden');

      const items = e.dataTransfer.items;
      const files = [];

      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
          if (entry) {
            await this.traverseFileTree(entry, files);
          } else {
            const file = items[i].getAsFile();
            if (file) files.push(file);
          }
        }
      } else if (e.dataTransfer.files) {
        for (const file of e.dataTransfer.files) {
          files.push(file);
        }
      }

      this.handleFilesPicked(files);
    });
  }

  async traverseFileTree(item, fileList) {
    if (item.isFile) {
      return new Promise((resolve) => {
        item.file((file) => {
          if (this.isAudioFile(file.name)) {
            fileList.push(file);
          }
          resolve();
        });
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries) => {
          for (const entry of entries) {
            await this.traverseFileTree(entry, fileList);
          }
          resolve();
        });
      });
    }
  }

  isAudioFile(filename) {
    return /\.(mp3|wav|ogg|m4a|flac|aac|aiff|opus|webm)$/i.test(filename);
  }

  // Audio element events (Time update, track ended, etc.)
  bindAudioEvents() {
    const audio = window.audioEngine.audioElement;
    let lastHistorySaveTime = 0;

    audio.addEventListener('timeupdate', () => {
      this.updateTimeDisplay();
      this.updateSeekBar();

      // Throttled save every 3 seconds to preserve playback resume position
      const now = Date.now();
      if (now - lastHistorySaveTime > 3000) {
        lastHistorySaveTime = now;
        this.saveCollection();
      }
    });

    audio.addEventListener('ended', () => {
      if (this.repeatMode === 'one') {
        audio.currentTime = 0;
        this.play();
      } else {
        this.nextTrack(true);
      }
    });

    audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.updateTransportLEDs();
      this.updatePlaylistUI();
      this.saveCollection();
    });

    audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.isPaused = true;
      this.updateTransportLEDs();
      this.updatePlaylistUI();
      this.saveCollection();
    });
  }

  // Select and load track
  selectTrack(index, autoPlay = true) {
    if (index < 0 || index >= this.playlist.length) return;
    
    this.currentIndex = index;
    const track = this.playlist[index];
    this.currentTrackMeta = track;

    // Load in audio engine
    window.audioEngine.setSource(track.url);

    // Update Marquee & Badges - Clean song title display without developer credits
    const marquee = document.getElementById('trackMarquee');
    const miniMarquee = document.getElementById('miniMarquee');
    const theaterTitle = document.getElementById('visTheaterTitle');
    const trackArtist = (track.artist && track.artist !== 'Local Artist' && track.artist !== 'Local Music') ? track.artist : '';
    const trackDisplay = trackArtist ? `${trackArtist} - ${track.title}` : track.title;
    const text = `*** ${index + 1}. ${trackDisplay} (${track.bitrate || '320 kbps'} / ${track.sampleRate || '44.1 kHz'}) ***`;
    
    if (marquee) marquee.textContent = text;
    if (miniMarquee) miniMarquee.textContent = `${index + 1}. ${trackDisplay}`;
    if (theaterTitle) theaterTitle.textContent = trackDisplay;

    document.getElementById('badgeKbps').textContent = track.bitrate || '320 KBPS';
    document.getElementById('badgeKhz').textContent = track.sampleRate || '44.1 KHZ';
    document.getElementById('badgeChannels').textContent = 'STEREO';

    this.updateMediaSessionMetadata();
    this.updatePlaylistUI();
    this.saveCollection();

    if (autoPlay) {
      this.play();
    }
  }

  play() {
    if (this.currentIndex === -1 && this.playlist.length > 0) {
      this.selectTrack(0, true);
      return;
    }
    if (this.playlist.length === 0) {
      this.openFilePicker();
      return;
    }
    if (this.playlist[this.currentIndex] && (!window.audioEngine.audioElement.src || window.audioEngine.audioElement.src === window.location.href)) {
      window.audioEngine.setSource(this.playlist[this.currentIndex].url);
    }
    window.audioEngine.play().then(() => {
      this.isPlaying = true;
      this.isPaused = false;
      this.updateTransportLEDs();
      this.saveCollection();
      if (this.currentTrackMeta) {
        this.sendNative('playbackStarted', {
          title: this.currentTrackMeta.title,
          artist: this.currentTrackMeta.artist
        });
      }
    }).catch(err => {
      console.warn("Audio play error:", err ? (err.name + ': ' + err.message) : err);
    });
  }

  pause() {
    window.audioEngine.pause();
    this.isPlaying = false;
    this.isPaused = true;
    this.updateTransportLEDs();
    this.sendNative('playbackPaused');
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop() {
    window.audioEngine.stop();
    this.isPlaying = false;
    this.isPaused = false;
    this.updateTransportLEDs();
    this.updateTimeDisplay();
    this.updateSeekBar();
    this.sendNative('playbackStopped');
  }

  prevTrack() {
    if (this.playlist.length === 0) return;
    let newIndex = this.currentIndex - 1;
    if (newIndex < 0) newIndex = this.playlist.length - 1;
    this.selectTrack(newIndex, true);
  }

  nextTrack(autoAdvance = false) {
    if (this.playlist.length === 0) return;

    if (this.shuffle) {
      let nextIndex = Math.floor(Math.random() * this.playlist.length);
      if (this.playlist.length > 1 && nextIndex === this.currentIndex) {
        nextIndex = (nextIndex + 1) % this.playlist.length;
      }
      this.selectTrack(nextIndex, true);
      return;
    }

    let newIndex = this.currentIndex + 1;
    if (newIndex >= this.playlist.length) {
      if (this.repeatMode === 'off' && autoAdvance) {
        this.stop();
        return;
      }
      newIndex = 0;
    }
    this.selectTrack(newIndex, true);
  }

  // Update Transport LEDs (Play / Pause / Stop)
  updateTransportLEDs() {
    const playLed = document.getElementById('ledPlay');
    const pauseLed = document.getElementById('ledPause');
    const stopLed = document.getElementById('ledStop');
    const miniPlay = document.getElementById('miniPlay');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const btnPlayPause = document.getElementById('btnPlayPause');

    playLed?.classList.toggle('active', this.isPlaying);
    pauseLed?.classList.toggle('active', this.isPaused);
    stopLed?.classList.toggle('active', !this.isPlaying && !this.isPaused);

    const iconStr = this.isPlaying ? '❚❚' : '▶';
    if (playPauseIcon) {
      playPauseIcon.textContent = iconStr;
    }
    if (btnPlayPause) {
      btnPlayPause.setAttribute('title', this.isPlaying ? 'Pause (Space / C)' : 'Play (Space / X)');
      btnPlayPause.classList.toggle('is-playing', this.isPlaying);
    }
    if (miniPlay) {
      miniPlay.textContent = iconStr;
    }

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : (this.isPaused ? 'paused' : 'none');
      } catch (e) {}
    }
  }

  // Time & Seek Bar updates
  updateTimeDisplay() {
    const audio = window.audioEngine.audioElement;
    const cur = audio.currentTime || 0;
    const dur = audio.duration || (this.currentTrackMeta?.duration || 0);

    let displaySec = cur;
    if (this.timeMode === 'remaining') {
      displaySec = Math.max(0, dur - cur);
    }

    const timeStr = (this.timeMode === 'remaining' ? '-' : '') + this.formatTime(displaySec);
    const digits = document.getElementById('timeDigits');
    const miniTime = document.getElementById('miniTime');

    if (digits) digits.textContent = timeStr;
    if (miniTime) miniTime.textContent = timeStr;
  }

  updateSeekBar() {
    const audio = window.audioEngine.audioElement;
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 1;
    const percent = Math.min(100, (cur / dur) * 100);

    const seekBar = document.getElementById('seekBar');
    const seekProgress = document.getElementById('seekProgress');

    if (seekBar && document.activeElement !== seekBar) {
      seekBar.value = percent;
    }
    if (seekProgress) {
      seekProgress.style.width = `${percent}%`;
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  adjustVolume(delta) {
    const volSlider = document.getElementById('volumeSlider');
    if (volSlider) {
      let cur = parseInt(volSlider.value, 10);
      cur = Math.max(0, Math.min(100, cur + delta));
      volSlider.value = cur;
      volSlider.dispatchEvent(new Event('input'));
    }
  }

  // Stereo VU Meters Loop
  startVUMeterLoop() {
    const vuSegLeft = document.getElementById('vuSegLeft');
    const vuSegRight = document.getElementById('vuSegRight');
    const vuPeakLeft = document.getElementById('vuPeakLeft');
    const vuPeakRight = document.getElementById('vuPeakRight');

    const updateVU = () => {
      if (this.isPlaying && window.audioEngine) {
        const levels = window.audioEngine.getVUMeterLevels();
        if (vuSegLeft) vuSegLeft.style.height = `${levels.left}%`;
        if (vuSegRight) vuSegRight.style.height = `${levels.right}%`;
        if (vuPeakLeft) vuPeakLeft.style.bottom = `${levels.peakLeft}%`;
        if (vuPeakRight) vuPeakRight.style.bottom = `${levels.peakRight}%`;
      } else {
        if (vuSegLeft) vuSegLeft.style.height = '0%';
        if (vuSegRight) vuSegRight.style.height = '0%';
        if (vuPeakLeft) vuPeakLeft.style.bottom = '0%';
        if (vuPeakRight) vuPeakRight.style.bottom = '0%';
      }
      requestAnimationFrame(updateVU);
    };
    requestAnimationFrame(updateVU);
  }

  // --- PLAYLIST UI & MANAGEMENT ---
  updatePlaylistUI() {
    const tbody = document.getElementById('playlistBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.playlist.length === 0) {
      const emptyTr = document.createElement('tr');
      emptyTr.className = 'playlist-empty-row';
      emptyTr.innerHTML = `
        <td colspan="6">
          <div class="empty-state-box">
            <span class="empty-icon">📂</span>
            <span class="empty-title">Your Collection is Empty</span>
            <span class="empty-subtitle">Click <b>+ FILE</b>, <b>+ DIR</b>, or Drag & Drop music from Finder</span>
          </div>
        </td>
      `;
      tbody.appendChild(emptyTr);
      this.updatePlaylistStats();
      return;
    }

    this.playlist.forEach((track, index) => {
      const tr = document.createElement('tr');
      tr.className = 'playlist-row';
      if (index === this.currentIndex) {
        tr.classList.add('active');
      }

      // Status icon (animated wave if playing)
      const tdStatus = document.createElement('td');
      tdStatus.className = 'td-status';
      if (index === this.currentIndex && this.isPlaying) {
        tdStatus.innerHTML = `
          <div class="playing-anim-icon">
            <span class="playing-anim-bar"></span>
            <span class="playing-anim-bar"></span>
            <span class="playing-anim-bar"></span>
          </div>
        `;
      } else if (index === this.currentIndex && this.isPaused) {
        tdStatus.textContent = '❚❚';
      } else {
        tdStatus.textContent = '';
      }

      const tdNum = document.createElement('td');
      tdNum.className = 'td-num';
      tdNum.textContent = `${index + 1}.`;

      const tdTitle = document.createElement('td');
      tdTitle.className = 'td-title';
      tdTitle.textContent = track.title;
      tdTitle.title = track.title;

      const tdArtist = document.createElement('td');
      tdArtist.className = 'td-artist';
      tdArtist.textContent = track.artist;

      const tdTime = document.createElement('td');
      tdTime.className = 'td-time';
      tdTime.textContent = this.formatTime(track.duration);

      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-row-del';
      btnDel.innerHTML = '&times;';
      btnDel.title = 'Remove Track';
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTrack(index);
      });
      tdDel.appendChild(btnDel);

      tr.appendChild(tdStatus);
      tr.appendChild(tdNum);
      tr.appendChild(tdTitle);
      tr.appendChild(tdArtist);
      tr.appendChild(tdTime);
      tr.appendChild(tdDel);

      // Click to select, double-click to play
      tr.addEventListener('click', () => {
        document.querySelectorAll('.playlist-row').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });

      tr.addEventListener('dblclick', () => {
        this.selectTrack(index, true);
      });

      tbody.appendChild(tr);
    });

    this.updatePlaylistStats();
  }

  updatePlaylistStats() {
    const totalTracks = this.playlist.length;
    let totalSec = 0;
    this.playlist.forEach(t => totalSec += (t.duration || 0));

    const countLabel = document.getElementById('plStatsCount');
    const durLabel = document.getElementById('plStatsDuration');

    if (countLabel) countLabel.textContent = `${totalTracks} track${totalTracks === 1 ? '' : 's'}`;
    if (durLabel) durLabel.textContent = `${this.formatTime(totalSec)} total time`;
  }

  filterPlaylist(keyword) {
    const rows = document.querySelectorAll('.playlist-row');
    this.playlist.forEach((track, idx) => {
      const match = track.title.toLowerCase().includes(keyword) || track.artist.toLowerCase().includes(keyword);
      if (rows[idx]) {
        rows[idx].style.display = match ? '' : 'none';
      }
    });
  }

  sortPlaylist(criteria) {
    if (criteria === 'title') {
      this.playlist.sort((a, b) => a.title.localeCompare(b.title));
    } else if (criteria === 'artist') {
      this.playlist.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (criteria === 'duration') {
      this.playlist.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    } else if (criteria === 'random') {
      this.playlist.sort(() => Math.random() - 0.5);
    }
    this.updatePlaylistUI();
    this.saveCollection();
  }

  removeTrack(index) {
    if (index >= 0 && index < this.playlist.length) {
      this.playlist.splice(index, 1);
      if (this.currentIndex === index) {
        if (this.playlist.length > 0) {
          this.selectTrack(Math.min(index, this.playlist.length - 1), this.isPlaying);
        } else {
          this.stop();
          this.currentIndex = -1;
        }
      } else if (this.currentIndex > index) {
        this.currentIndex--;
      }
      this.updatePlaylistUI();
      this.saveCollection();
    }
  }

  removeSelectedTrack() {
    const selectedRow = document.querySelector('.playlist-row.selected');
    if (selectedRow) {
      const index = Array.from(selectedRow.parentNode.children).indexOf(selectedRow);
      this.removeTrack(index);
    }
  }

  clearPlaylist() {
    this.stop();
    this.playlist = [];
    this.currentIndex = -1;
    this.updatePlaylistUI();
    this.saveCollection();
  }

  // Add files picked
  async handleFilesPicked(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (!this.isAudioFile(file.name)) continue;

      const trackUrl = URL.createObjectURL(file);
      const nameParts = file.name.replace(/\.[^/.]+$/, "").split(" - ");
      let artist = "Unknown Artist";
      let title = nameParts[0];
      if (nameParts.length > 1) {
        artist = nameParts[0];
        title = nameParts.slice(1).join(" - ");
      }

      // Read audio duration using temporary Audio object
      const duration = await this.getAudioDuration(trackUrl);

      this.playlist.push({
        id: `track-${Date.now()}-${Math.random()}`,
        title: title.trim(),
        artist: artist.trim(),
        album: 'Local Music',
        duration: duration || 180,
        url: trackUrl,
        format: file.type || file.name.split('.').pop().toUpperCase(),
        sampleRate: '44.1 kHz',
        bitrate: '320 kbps',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      });
    }

    this.updatePlaylistUI();

    // Auto-select and play the newly uploaded song immediately!
    if (this.playlist.length > 0) {
      const newTrackIndex = Math.max(0, this.playlist.length - files.length);
      this.selectTrack(newTrackIndex, true);
    }
    this.saveCollection();
  }

  // Called from Cocoa native NSOpenPanel for single track
  addTrackFromNative(title, artist, url, format) {
    const newTrack = {
      id: `track-${Date.now()}-${Math.random()}`,
      title: title || 'Unknown Title',
      artist: artist || 'Local Artist',
      album: 'Local Library',
      duration: 180,
      url: url,
      format: format || 'AUDIO',
      sampleRate: '44.1 kHz',
      bitrate: '320 kbps',
      size: 'Local File'
    };
    this.playlist.push(newTrack);
    this.updatePlaylistUI();
    // Immediately select and play the newly added song!
    this.selectTrack(this.playlist.length - 1, true);
    this.saveCollection();
  }

  // Called from Cocoa native NSOpenPanel / Drag & Drop for batch of tracks
  addTracksBatchFromNative(jsonStr) {
    try {
      const items = (typeof jsonStr === 'string') ? JSON.parse(jsonStr) : jsonStr;
      if (!Array.isArray(items) || items.length === 0) return;

      const startIndex = this.playlist.length;
      items.forEach(item => {
        this.playlist.push({
          id: `track-${Date.now()}-${Math.random()}`,
          title: item.title || 'Unknown Title',
          artist: item.artist || 'Local Artist',
          album: 'Local Library',
          duration: item.duration || 180,
          url: item.url,
          format: item.format || 'AUDIO',
          sampleRate: '44.1 kHz',
          bitrate: '320 kbps',
          size: 'Local File'
        });
      });

      this.updatePlaylistUI();
      // Auto-play the first added track if nothing was playing
      if (!this.isPlaying) {
        this.selectTrack(startIndex, true);
      } else {
        this.saveCollection();
      }
    } catch (e) {
      console.warn("Failed to add tracks batch:", e);
    }
  }

  getAudioDuration(url) {
    return new Promise((resolve) => {
      const tempAudio = new Audio();
      tempAudio.src = url;
      tempAudio.addEventListener('loadedmetadata', () => {
        resolve(tempAudio.duration);
      });
      tempAudio.addEventListener('error', () => {
        resolve(180);
      });
    });
  }

  openFilePicker() {
    // Try native Cocoa / Android / Electron Open Panel first
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('openFile');
    } else if (window.AndroidBridge) {
      document.getElementById('filePicker')?.click();
    } else if (window.electronAPI) {
      this.sendNative('openFile');
    } else {
      document.getElementById('filePicker')?.click();
    }
  }

  openFolderPicker() {
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('openFolder');
    } else if (window.AndroidBridge) {
      this.sendNative('openFolderSAF');
    } else if (window.electronAPI) {
      this.sendNative('openFolder');
    } else {
      document.getElementById('folderPicker')?.click();
    }
  }

  autoScanMusic() {
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('autoScanMusic');
    } else if (window.AndroidBridge) {
      this.sendNative('scanDeviceMusic');
    } else {
      document.getElementById('folderPicker')?.click();
    }
  }

  initMediaSession() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && window.audioEngine) {
          window.audioEngine.seek(details.seekTime);
          this.updateTimeDisplay();
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        if (window.audioEngine) {
          window.audioEngine.seek(window.audioEngine.audioElement.currentTime - offset);
          this.updateTimeDisplay();
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        if (window.audioEngine) {
          window.audioEngine.seek(window.audioEngine.audioElement.currentTime + offset);
          this.updateTimeDisplay();
        }
      });
    } catch (e) {
      console.warn("MediaSession handler error:", e);
    }
  }

  updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || !this.currentTrackMeta) return;

    try {
      const track = this.currentTrackMeta;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Local Music',
        album: track.album || 'ToolNAmp Hi-Fi Library',
        artwork: [
          { src: 'AppIcon.png', sizes: '512x512', type: 'image/png' },
          { src: 'AppIcon.png', sizes: '192x192', type: 'image/png' }
        ]
      });
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : (this.isPaused ? 'paused' : 'none');
    } catch (e) {
      console.warn("Error updating mediaSession metadata:", e);
    }
  }

  // Export / Import M3U
  exportM3U() {
    if (this.playlist.length === 0) return;
    let content = "#EXTM3U\n";
    this.playlist.forEach(t => {
      content += `#EXTINF:${Math.round(t.duration)},${t.artist} - ${t.title}\n${t.url}\n`;
    });
    const blob = new Blob([content], { type: 'audio/x-mpegurl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'macamp-playlist.m3u';
    a.click();
  }

  handleM3UPicked(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && this.isAudioFile(trimmed)) {
          this.playlist.push({
            id: `track-${Date.now()}-${Math.random()}`,
            title: trimmed.split('/').pop().replace(/\.[^/.]+$/, ""),
            artist: "M3U Track",
            album: "Imported Playlist",
            duration: 180,
            url: trimmed,
            format: 'AUDIO',
            sampleRate: '44.1 kHz',
            bitrate: '320 kbps',
            size: '-'
          });
        }
      });
      this.updatePlaylistUI();
    };
    reader.readAsText(file);
  }

  // --- WINDOW SHADE / MINI MODE ---
  toggleMiniMode() {
    this.isMiniMode = !this.isMiniMode;
    const mainPlayer = document.getElementById('mainPlayer');
    const miniBar = document.getElementById('miniPlayerBar');
    const header = document.getElementById('appHeader');

    if (this.isMiniMode) {
      mainPlayer?.classList.add('hidden');
      miniBar?.classList.remove('hidden');
      if (header) header.style.display = 'none'; // Super compact
      this.sendNative('setMiniMode', { mini: true });
    } else {
      mainPlayer?.classList.remove('hidden');
      miniBar?.classList.add('hidden');
      if (header) header.style.display = 'flex';
      this.sendNative('setMiniMode', { mini: false });
    }
  }

  // --- THEME SWITCHER ---
  setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    const select = document.getElementById('themeSelector');
    if (select) select.value = themeName;
    localStorage.setItem('macamp_theme', themeName);
  }

  loadSavedTheme() {
    const saved = localStorage.getItem('macamp_theme') || 'winamp-classic';
    this.setTheme(saved);
  }

  // --- MODALS (INFO & SHORTCUTS) ---
  showInfoModal() {
    if (!this.currentTrackMeta) return;
    const m = this.currentTrackMeta;
    document.getElementById('metaTitle').textContent = m.title;
    document.getElementById('metaArtist').textContent = m.artist;
    document.getElementById('metaAlbum').textContent = m.album || 'Unknown Album';
    document.getElementById('metaDuration').textContent = this.formatTime(m.duration);
    document.getElementById('metaFormat').textContent = m.format || 'Audio';
    document.getElementById('metaSampleRate').textContent = m.sampleRate || '44.1 kHz';
    document.getElementById('metaBitrate').textContent = m.bitrate || '320 kbps';
    document.getElementById('metaChannels').textContent = '2 (Stereo)';
    document.getElementById('metaSize').textContent = m.size || '-';

    document.getElementById('infoModal')?.classList.remove('hidden');
  }

  hideInfoModal() {
    document.getElementById('infoModal')?.classList.add('hidden');
  }

  showShortcutsModal() {
    document.getElementById('shortcutsModal')?.classList.remove('hidden');
  }

  hideShortcutsModal() {
    document.getElementById('shortcutsModal')?.classList.add('hidden');
  }

  showAboutModal() {
    document.getElementById('aboutModal')?.classList.remove('hidden');
  }

  hideAboutModal() {
    document.getElementById('aboutModal')?.classList.add('hidden');
  }

  onMaximizeChanged(isMaximized) {
    const zoomBtn = document.getElementById('btnWinZoom');
    if (zoomBtn) {
      zoomBtn.title = isMaximized ? "Restore Window Size" : "Zoom / Maximize";
      zoomBtn.classList.toggle('maximized', isMaximized);
    }
  }

  // --- CROSS-PLATFORM NATIVE MESSAGING BRIDGE ---
  sendNative(action, payload = {}) {
    const handler = window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp);
    if (handler) {
      try {
        handler.postMessage({ action, ...payload });
      } catch (e) {
        console.log("Native Cocoa message error:", e);
      }
    } else if (window.electronAPI) {
      try {
        window.electronAPI.send(action, payload);
      } catch (e) {
        console.log("Electron bridge error:", e);
      }
    } else if (window.AndroidBridge) {
      try {
        window.AndroidBridge.postMessage(JSON.stringify({ action, ...payload }));
      } catch (e) {
        console.log("Android bridge error:", e);
      }
    } else {
      console.log(`[Native Simulation] Action: ${action}`, payload);
    }
  }
}

// Global App Initialization
window.addEventListener('DOMContentLoaded', () => {
  window.toolNAmp = window.macAmp = new ToolNAmpApp();
  window.toolNAmp.sendNative('log', { message: 'ToolNAmp DOMContentLoaded and App initialized!' });
});
