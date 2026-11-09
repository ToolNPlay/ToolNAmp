/**
 * ToolNAmp Main Application Controller
 * Handles Playlist, Drag & Drop, Playback State,
 * UI Updates, Cross-Platform Native Bridge, and Keyboard Shortcuts.
 * Developed by ToolNPlay.com • Developers: Pardeep Kumar & Harsh Suman
 */

class ToolNAmpApp {
  constructor() {
    this.version = 'v1.1.1';
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
    
    this.history = [];
    this.activePlaylistTab = 'playlist';
    this.currentVolume = 80;
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
    this.updateWindowLayout();

    // Load persisted collection from history
    const restored = this.loadSavedCollection();
    if (!restored || this.playlist.length === 0) {
      this.updatePlaylistUI();
    }
    this.probeMissingDurations();

    // Auto-detect updates silently 2.5 seconds after launch when online
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 2500);
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

  // --- SETTINGS (VOLUME & PAN) CONTROLLERS ---
  setVolume(val, save = true) {
    const num = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    this.currentVolume = num;

    const volSlider = document.getElementById('volumeSlider');
    const miniVolSlider = document.getElementById('miniVolume');
    const volVal = document.getElementById('volVal');
    const volIcon = document.getElementById('volIcon');

    if (volSlider) volSlider.value = num;
    if (miniVolSlider) miniVolSlider.value = num;
    if (volVal) volVal.textContent = `${num}%`;
    if (volIcon) volIcon.textContent = num == 0 ? '🔇' : num < 40 ? '🔉' : '🔊';

    if (window.audioEngine) {
      window.audioEngine.setVolume(num);
    }

    try {
      localStorage.setItem('toolnamp_volume', num.toString());
    } catch (e) {}

    if (save) {
      this.saveCollection();
    }
  }

  setPan(val, save = true) {
    const v = Math.max(-100, Math.min(100, parseInt(val, 10) || 0));
    const panSlider = document.getElementById('panSlider');
    const panVal = document.getElementById('panVal');

    if (panSlider) panSlider.value = v;
    if (panVal) panVal.textContent = v === 0 ? 'C' : v < 0 ? `L${Math.abs(v)}` : `R${v}`;

    if (window.audioEngine) {
      window.audioEngine.setPan(v);
    }

    try {
      localStorage.setItem('toolnamp_pan', v.toString());
    } catch (e) {}

    if (save) {
      this.saveCollection();
    }
  }

  // --- COLLECTION PERSISTENCE & HISTORY SYSTEM ---
  saveCollection() {
    try {
      const volSlider = document.getElementById('volumeSlider');
      const panSlider = document.getElementById('panSlider');
      const currentVol = volSlider ? parseInt(volSlider.value, 10) : (this.currentVolume || 80);
      const currentPan = panSlider ? parseInt(panSlider.value, 10) : 0;

      const state = {
        version: 1,
        savedAt: Date.now(),
        lastTrackIndex: this.currentIndex,
        lastTrackId: (this.currentIndex >= 0 && this.playlist[this.currentIndex]) ? this.playlist[this.currentIndex].id : null,
        lastSeekTime: (window.audioEngine && window.audioEngine.audioElement) ? window.audioEngine.audioElement.currentTime : 0,
        volume: currentVol,
        pan: currentPan,
        shuffle: this.shuffle,
        repeatMode: this.repeatMode,
        activePlaylistTab: this.activePlaylistTab || 'playlist',
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
        })),
        history: this.history.filter(t => !t.url.startsWith('blob:')).slice(0, 100).map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          url: t.url,
          format: t.format,
          sampleRate: t.sampleRate,
          bitrate: t.bitrate,
          size: t.size,
          playedAt: t.playedAt || Date.now()
        }))
      };

      const jsonStr = JSON.stringify(state);
      localStorage.setItem('toolnamp_collection_state', jsonStr);
      localStorage.setItem('toolnamp_volume', currentVol.toString());
      localStorage.setItem('toolnamp_pan', currentPan.toString());
      localStorage.setItem('toolnamp_history', JSON.stringify(state.history));

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
        if (state) {
          this.applyCollectionState(state);
          return true;
        }
      } else {
        const savedVol = localStorage.getItem('toolnamp_volume');
        if (savedVol !== null) this.setVolume(parseInt(savedVol, 10), false);
        const savedPan = localStorage.getItem('toolnamp_pan');
        if (savedPan !== null) this.setPan(parseInt(savedPan, 10), false);
      }
    } catch (e) {
      console.warn("Failed to load collection from localStorage:", e);
    }
    return false;
  }

  applyCollectionState(state) {
    if (!state) return;

    // 1. Restore Volume & Pan settings
    const savedVol = (typeof state.volume === 'number' && !isNaN(state.volume))
      ? state.volume
      : (localStorage.getItem('toolnamp_volume') ? parseInt(localStorage.getItem('toolnamp_volume'), 10) : 80);
    this.setVolume(savedVol, false);

    const savedPan = (typeof state.pan === 'number' && !isNaN(state.pan))
      ? state.pan
      : (localStorage.getItem('toolnamp_pan') ? parseInt(localStorage.getItem('toolnamp_pan'), 10) : 0);
    this.setPan(savedPan, false);

    // 2. Restore History
    if (Array.isArray(state.history)) {
      this.history = state.history.filter(t => t && t.url && !t.url.startsWith('blob:'));
    } else {
      try {
        const histRaw = localStorage.getItem('toolnamp_history');
        if (histRaw) this.history = JSON.parse(histRaw) || [];
      } catch (e) {}
    }

    // 3. Restore Shuffle / Repeat
    if (typeof state.shuffle === 'boolean') {
      this.shuffle = state.shuffle;
      document.getElementById('btnShuffle')?.classList.toggle('active', this.shuffle);
    }
    if (state.repeatMode) {
      this.repeatMode = state.repeatMode;
      const repBtn = document.getElementById('btnRepeat');
      if (repBtn) repBtn.textContent = `REP: ${this.repeatMode.toUpperCase()}`;
    }

    // 4. Restore Playlist tracks
    if (Array.isArray(state.tracks) && state.tracks.length > 0) {
      this.playlist = state.tracks.filter(t => t && t.url && !t.url.startsWith('blob:') && !t.id?.startsWith('yt-') && !t.url.includes('googlevideo.com') && !t.url.startsWith('http://') && !t.url.startsWith('https://'));
      this.updatePlaylistUI();
      this.probeMissingDurations();

      let targetIndex = 0;
      if (typeof state.lastTrackIndex === 'number' && state.lastTrackIndex >= 0 && state.lastTrackIndex < this.playlist.length) {
        targetIndex = state.lastTrackIndex;
      } else if (state.lastTrackId) {
        const found = this.playlist.findIndex(t => t.id === state.lastTrackId);
        if (found !== -1) targetIndex = found;
      }

      this.selectTrack(targetIndex, false);

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
      this.updatePlaylistUI();
    }

    this.updateHistoryBadges();
  }

  // Record a track into History (deduplicated, latest at top)
  recordToHistory(track, autoSave = true) {
    if (!track || !track.title) return;
    this.history = this.history.filter(t => t.url !== track.url && t.title !== track.title);
    this.history.unshift({
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: track.title,
      artist: track.artist || 'Local Music',
      album: track.album || 'Local Library',
      duration: track.duration || 0,
      url: track.url,
      format: track.format || 'AUDIO',
      sampleRate: track.sampleRate || '44.1 kHz',
      bitrate: track.bitrate || '320 kbps',
      size: track.size || 'Local File',
      playedAt: Date.now()
    });
    if (this.history.length > 150) {
      this.history = this.history.slice(0, 150);
    }
    this.updateHistoryBadges();
    if (this.activePlaylistTab === 'history') {
      this.renderHistoryUI();
    }
    if (autoSave) {
      this.saveCollection();
    }
  }

  // --- PLAYLIST VS HISTORY TAB SWITCHING ---
  switchPlaylistTab(tab) {
    this.activePlaylistTab = tab;
    const tabPl = document.getElementById('tabCurrentPlaylist');
    const tabHist = document.getElementById('tabPlayHistory');
    const plActions = document.getElementById('plActionButtons');
    const histActions = document.getElementById('histActionButtons');

    if (tab === 'history') {
      tabHist?.classList.add('active');
      tabPl?.classList.remove('active');
      if (plActions) plActions.style.display = 'none';
      if (histActions) histActions.style.display = 'flex';
      this.renderHistoryUI();
    } else {
      tabPl?.classList.add('active');
      tabHist?.classList.remove('active');
      if (plActions) plActions.style.display = 'flex';
      if (histActions) histActions.style.display = 'none';
      this.updatePlaylistUI();
    }
    this.updateHistoryBadges();
  }

  updateHistoryBadges() {
    const plCount = document.getElementById('badgePlCount');
    const histCount = document.getElementById('badgeHistCount');
    if (plCount) plCount.textContent = this.playlist.length;
    if (histCount) histCount.textContent = this.history.length;
  }

  renderHistoryUI() {
    const tbody = document.getElementById('playlistBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (this.history.length === 0) {
      const emptyTr = document.createElement('tr');
      emptyTr.innerHTML = `
        <td colspan="6" class="playlist-empty-msg">
          <div class="empty-pl-wrap">
            <span class="empty-icon">📜</span>
            <span class="empty-title">History is empty</span>
            <span class="empty-sub">Songs you play will automatically appear here for quick access.</span>
          </div>
        </td>
      `;
      tbody.appendChild(emptyTr);
      this.updateHistoryStats();
      return;
    }

    this.history.forEach((track, index) => {
      const tr = document.createElement('tr');
      tr.className = 'playlist-row history-row';
      tr.dataset.historyIndex = index;

      const tdStatus = document.createElement('td');
      tdStatus.className = 'td-status';
      tdStatus.textContent = '📜';

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
      tdTime.textContent = this.formatTime(track.duration, false);

      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      const btnPlay = document.createElement('button');
      btnPlay.className = 'btn-row-del';
      btnPlay.innerHTML = '▶';
      btnPlay.title = 'Play song now';
      btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playHistoryTrack(index);
      });
      tdDel.appendChild(btnPlay);

      tr.appendChild(tdStatus);
      tr.appendChild(tdNum);
      tr.appendChild(tdTitle);
      tr.appendChild(tdArtist);
      tr.appendChild(tdTime);
      tr.appendChild(tdDel);

      tr.addEventListener('click', () => {
        document.querySelectorAll('.playlist-row').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });

      tr.addEventListener('dblclick', () => {
        this.playHistoryTrack(index);
      });

      tbody.appendChild(tr);
    });

    this.updateHistoryStats();
  }

  updateHistoryStats() {
    const countLabel = document.getElementById('plStatsCount');
    const durLabel = document.getElementById('plStatsDuration');
    if (countLabel) countLabel.textContent = `${this.history.length} in history`;
    let totalSec = 0;
    this.history.forEach(t => totalSec += (t.duration || 0));
    if (durLabel) durLabel.textContent = `${this.formatTime(totalSec, true)} total time`;
  }

  playHistoryTrack(historyIndex) {
    const track = this.history[historyIndex];
    if (!track) return;

    let plIdx = this.playlist.findIndex(t => t.url === track.url || (t.title === track.title && t.artist === track.artist));
    if (plIdx === -1) {
      this.playlist.push({ ...track, id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` });
      plIdx = this.playlist.length - 1;
    }

    this.switchPlaylistTab('playlist');
    this.selectTrack(plIdx, true);
    this.saveCollection();
  }

  playSelectedHistoryTrack() {
    const selRow = document.querySelector('.history-row.selected');
    if (selRow && selRow.dataset.historyIndex !== undefined) {
      const idx = parseInt(selRow.dataset.historyIndex, 10);
      this.playHistoryTrack(idx);
    } else if (this.history.length > 0) {
      this.playHistoryTrack(0);
    }
  }

  addAllHistoryToPlaylist() {
    if (this.history.length === 0) return;
    let addedCount = 0;
    this.history.forEach(h => {
      const exists = this.playlist.some(p => p.url === h.url || (p.title === h.title && p.artist === h.artist));
      if (!exists) {
        this.playlist.push({ ...h, id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` });
        addedCount++;
      }
    });
    this.switchPlaylistTab('playlist');
    this.updatePlaylistUI();
    this.saveCollection();
    const marquee = document.getElementById('trackMarquee');
    if (marquee) marquee.textContent = `⚡ ADDED ${addedCount} TRACKS FROM HISTORY TO PLAYLIST ⚡`;
  }

  clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem('toolnamp_history');
    } catch (e) {}
    this.saveCollection();
    this.updateHistoryBadges();
    if (this.activePlaylistTab === 'history') {
      this.renderHistoryUI();
    }
    const marquee = document.getElementById('trackMarquee');
    if (marquee) marquee.textContent = '⚡ LISTENING HISTORY CLEARED ⚡';
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
        if (action === 'requestClose') {
          this.requestClose();
        } else {
          this.sendNative(action);
        }
      });
    };

    setupWinBtn('btnWinClose', 'requestClose');
    setupWinBtn('btnWinMin', 'minimizeWindow');
    setupWinBtn('btnWinZoom', 'zoomWindow');

    setupWinBtn('miniBtnWinClose', 'requestClose');
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
    const volIcon = document.getElementById('volIcon');

    volSlider?.addEventListener('input', (e) => this.setVolume(e.target.value, false));
    volSlider?.addEventListener('change', (e) => this.setVolume(e.target.value, true));
    miniVolSlider?.addEventListener('input', (e) => this.setVolume(e.target.value, false));
    miniVolSlider?.addEventListener('change', (e) => this.setVolume(e.target.value, true));

    volIcon?.addEventListener('click', () => {
      if (this.isMuted) {
        this.setVolume(this.previousVolume || 80, true);
        this.isMuted = false;
      } else {
        this.previousVolume = parseInt(volSlider ? volSlider.value : 80, 10);
        this.setVolume(0, true);
        this.isMuted = true;
      }
    });

    const panSlider = document.getElementById('panSlider');
    panSlider?.addEventListener('input', (e) => this.setPan(e.target.value, false));
    panSlider?.addEventListener('change', (e) => this.setPan(e.target.value, true));

    // Module toggles (EQ / PL / FX / SHUF / REP)
    const btnEQ = document.getElementById('btnToggleEQ');
    const eqSec = document.getElementById('equalizerSection');
    btnEQ?.addEventListener('click', () => {
      eqSec.classList.toggle('hidden');
      btnEQ.classList.toggle('active', !eqSec.classList.contains('hidden'));
      this.updateWindowLayout();
    });

    const btnPL = document.getElementById('btnTogglePL');
    const plSec = document.getElementById('playlistSection');
    btnPL?.addEventListener('click', () => {
      plSec.classList.toggle('hidden');
      btnPL.classList.toggle('active', !plSec.classList.contains('hidden'));
      this.updateWindowLayout();
    });

    const btnFX = document.getElementById('btnToggleFX');
    const fxSec = document.getElementById('effectsSection');
    btnFX?.addEventListener('click', () => {
      fxSec.classList.toggle('hidden');
      btnFX.classList.toggle('active', !fxSec.classList.contains('hidden'));
      this.updateWindowLayout();
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

    // Playlist & History Tabs
    document.getElementById('tabCurrentPlaylist')?.addEventListener('click', () => this.switchPlaylistTab('playlist'));
    document.getElementById('tabPlayHistory')?.addEventListener('click', () => this.switchPlaylistTab('history'));
    document.getElementById('btnHistPlaySelected')?.addEventListener('click', () => this.playSelectedHistoryTrack());
    document.getElementById('btnHistAddAll')?.addEventListener('click', () => this.addAllHistoryToPlaylist());
    document.getElementById('btnClearHistory')?.addEventListener('click', () => this.clearHistory());

    // Playlist Action Buttons
    document.getElementById('btnAutoScan')?.addEventListener('click', () => this.autoScanMusic());
    document.getElementById('btnAddFiles')?.addEventListener('click', () => this.openFilePicker());
    document.getElementById('btnAddFolder')?.addEventListener('click', () => this.openFolderPicker());
    document.getElementById('btnRemoveSelected')?.addEventListener('click', () => this.removeSelectedTrack());
    document.getElementById('btnClearPlaylist')?.addEventListener('click', () => this.clearPlaylist());
    document.getElementById('btnExportM3U')?.addEventListener('click', () => this.exportM3U());
    document.getElementById('btnImportM3U')?.addEventListener('click', () => this.openM3UPicker());

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

    // Update Check Modal
    document.getElementById('btnCheckUpdateFooter')?.addEventListener('click', () => this.checkForUpdates(true));
    document.getElementById('btnCheckUpdateAbout')?.addEventListener('click', () => this.checkForUpdates(true));
    document.getElementById('btnCloseUpdateModal')?.addEventListener('click', () => this.hideUpdateModal());
    document.getElementById('btnUpdateOk')?.addEventListener('click', () => this.hideUpdateModal());
    document.getElementById('updateReleaseNotes')?.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a && a.href) {
        e.preventDefault();
        this.openExternal(a.href);
      }
    });

    // Close Confirmation Modal
    document.getElementById('btnClosePlayBackground')?.addEventListener('click', () => {
      this.hideCloseConfirmModal();
      if (window.AndroidBridge) {
        this.sendNative('playInBackground', {});
      }
    });
    document.getElementById('btnCloseExitApp')?.addEventListener('click', () => {
      this.hideCloseConfirmModal();
      this.confirmClose();
    });
    document.getElementById('btnCloseCancel')?.addEventListener('click', () => this.hideCloseConfirmModal());
    document.getElementById('btnCloseConfirmClose')?.addEventListener('click', () => this.hideCloseConfirmModal());

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
        case 'h': // Toggle Playlist / History Tab
          e.preventDefault();
          this.switchPlaylistTab(this.activePlaylistTab === 'history' ? 'playlist' : 'history');
          break;
        case 'u': // Check for updates
          this.checkForUpdates(true);
          break;
        case 'a': // About ToolNAmp
          this.showAboutModal();
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
            this.hideCloseConfirmModal();
            this.hideUpdateModal();
            this.hideInfoModal();
            this.hideShortcutsModal();
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
    return /\.(mp3|wav|wave|ogg|oga|m4a|flac|aac|aiff|aif|aifc|opus|webm|wma|mid|midi)$/i.test(filename);
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

    audio.addEventListener('loadedmetadata', () => {
      this.onTrackMetadataLoaded();
    });

    audio.addEventListener('durationchange', () => {
      this.onTrackMetadataLoaded();
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
    this.probeMissingDurations();
      this.saveCollection();
    });

    audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.isPaused = true;
      this.updateTransportLEDs();
      this.updatePlaylistUI();
    this.probeMissingDurations();
      this.saveCollection();
    });
  }

  onTrackMetadataLoaded() {
    const audio = window.audioEngine?.audioElement;
    if (!audio) return;
    const dur = audio.duration;
    if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
      const sec = Math.round(dur);
      if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
        this.playlist[this.currentIndex].duration = sec;
      }
      if (this.currentTrackMeta) {
        this.currentTrackMeta.duration = sec;
      }
      this.updatePlaylistRowTime(this.currentIndex, sec);
      this.updatePlaylistStats();
      this.updateTimeDisplay();
      this.updateSeekBar();
      this.saveCollection();
    }
  }

  updatePlaylistRowTime(index, duration) {
    const rowTime = document.querySelector(`.playlist-row[data-index="${index}"] .td-time`);
    if (rowTime) {
      rowTime.textContent = this.formatTime(duration, false);
    }
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
    this.probeMissingDurations();
    this.saveCollection();

    if (autoPlay) {
      this.recordToHistory(track, false);
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

  formatTime(seconds, allowZero = true) {
    if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
      return allowZero ? "00:00" : "--:--";
    }
    if (seconds === 0 && !allowZero) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  adjustVolume(delta) {
    const volSlider = document.getElementById('volumeSlider');
    if (volSlider) {
      let cur = parseInt(volSlider.value, 10);
      cur = Math.max(0, Math.min(100, cur + delta));
      this.setVolume(cur, true);
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
      tr.dataset.index = index;
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
      tdTime.textContent = this.formatTime(track.duration, false);

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
    if (durLabel) durLabel.textContent = `${this.formatTime(totalSec, true)} total time`;
    this.updateHistoryBadges();
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
    this.probeMissingDurations();
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
    this.probeMissingDurations();
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
    if (this.playlist.length > 0) {
      this.playlist.forEach(t => this.recordToHistory(t, false));
    }
    this.playlist = [];
    this.currentIndex = -1;
    this.updatePlaylistUI();
    this.updateHistoryBadges();
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
        duration: duration || 0,
        url: trackUrl,
        format: file.type || file.name.split('.').pop().toUpperCase(),
        sampleRate: '44.1 kHz',
        bitrate: '320 kbps',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      });
    }

    this.updatePlaylistUI();
    this.probeMissingDurations();
    this.probeMissingDurations();

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
      duration: 0,
      url: url,
      format: format || 'AUDIO',
      sampleRate: '44.1 kHz',
      bitrate: '320 kbps',
      size: 'Local File'
    };
    this.playlist.push(newTrack);
    this.updatePlaylistUI();
    this.probeMissingDurations();
    this.probeMissingDurations();
    // Immediately select and play the newly added song!
    this.selectTrack(this.playlist.length - 1, true);
    this.saveCollection();
  }

  // Called from Cocoa native NSOpenPanel / Drag & Drop for batch of tracks
  addTracksBatchFromNative(jsonStr, replaceExisting = false) {
    try {
      const items = (typeof jsonStr === 'string') ? JSON.parse(jsonStr) : jsonStr;
      if (!Array.isArray(items) || items.length === 0) return;

      if (replaceExisting) {
        // Archive existing playlist into history before replacing
        if (this.playlist.length > 0) {
          this.playlist.forEach(t => this.recordToHistory(t, false));
        }
        this.playlist = [];
        this.currentIndex = -1;
      }

      const startIndex = this.playlist.length;
      items.forEach(item => {
        const itemDur = (typeof item.duration === 'number' && item.duration > 0) ? item.duration : 0;
        const newTrack = {
          id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: item.title || 'Unknown Title',
          artist: item.artist || 'Local Artist',
          album: 'Local Library',
          duration: itemDur,
          url: item.url,
          format: item.format || 'AUDIO',
          sampleRate: '44.1 kHz',
          bitrate: '320 kbps',
          size: 'Local File'
        };
        this.playlist.push(newTrack);
        this.recordToHistory(newTrack, false);
      });

      this.activePlaylistTab = 'playlist';
      this.switchPlaylistTab('playlist');
      this.updatePlaylistUI();
      this.probeMissingDurations();
      this.selectTrack(startIndex, true);
      this.saveCollection();
    } catch (e) {
      console.warn("Failed to add tracks batch:", e);
    }
  }

  addTracksBatch(items, replaceExisting = false) {
    this.addTracksBatchFromNative(items, replaceExisting);
  }

  getAudioDuration(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(0);
      const tempAudio = new Audio();
      tempAudio.preload = 'metadata';
      let done = false;

      const finish = (val) => {
        if (done) return;
        done = true;
        tempAudio.removeEventListener('loadedmetadata', onLoaded);
        tempAudio.removeEventListener('error', onError);
        tempAudio.src = '';
        resolve((val && !isNaN(val) && isFinite(val) && val > 0) ? Math.round(val) : 0);
      };

      const onLoaded = () => finish(tempAudio.duration);
      const onError = () => finish(0);

      tempAudio.addEventListener('loadedmetadata', onLoaded);
      tempAudio.addEventListener('error', onError);

      // 4-second timeout safety guard
      setTimeout(() => finish(0), 4000);

      try {
        tempAudio.src = url;
      } catch (e) {
        finish(0);
      }
    });
  }

  probeMissingDurations() {
    if (this._isProbingDurations) return;
    this._isProbingDurations = true;

    const unprobed = this.playlist.filter(t => !t.duration || t.duration <= 0 || t.duration === 180);
    if (unprobed.length === 0) {
      this._isProbingDurations = false;
      return;
    }

    const processNext = async () => {
      if (unprobed.length === 0) {
        this._isProbingDurations = false;
        this.updatePlaylistStats();
        this.saveCollection();
        return;
      }
      const track = unprobed.shift();
      try {
        const dur = await this.getAudioDuration(track.url);
        if (dur > 0) {
          track.duration = dur;
        } else if (track.duration === 180) {
          track.duration = 0;
        }
        const idx = this.playlist.indexOf(track);
        if (idx !== -1) {
          this.updatePlaylistRowTime(idx, track.duration);
          this.updatePlaylistStats();
        }
      } catch (e) {
        if (track.duration === 180) {
          track.duration = 0;
          const idx = this.playlist.indexOf(track);
          if (idx !== -1) {
            this.updatePlaylistRowTime(idx, 0);
          }
        }
      }
      setTimeout(processNext, 30);
    };

    processNext();
  }

  openFilePicker() {
    // Try native Cocoa / Android / Electron / WebView2 Open Panel first
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('openFile');
    } else if (window.electronAPI) {
      this.sendNative('openFile');
    } else if (window.chrome && window.chrome.webview) {
      this.sendNative('openFile');
    } else if (window.AndroidBridge) {
      document.getElementById('filePicker')?.click();
    } else {
      document.getElementById('filePicker')?.click();
    }
  }

  openFolderPicker() {
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('openFolder');
    } else if (window.electronAPI) {
      this.sendNative('openFolder');
    } else if (window.chrome && window.chrome.webview) {
      this.sendNative('openFolder');
    } else if (window.AndroidBridge) {
      this.sendNative('openFolderSAF');
    } else {
      document.getElementById('folderPicker')?.click();
    }
  }

  autoScanMusic() {
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('autoScanMusic');
    } else if (window.electronAPI) {
      this.sendNative('openFolder');
    } else if (window.chrome && window.chrome.webview) {
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
    if (!this.playlist || this.playlist.length === 0) {
      alert("Playlist is empty! Add songs before exporting M3U.");
      return;
    }

    let content = "#EXTM3U\n";
    this.playlist.forEach(t => {
      const dur = Math.round(t.duration || 0);
      const artist = t.artist || "Unknown Artist";
      const title = t.title || "Unknown Title";
      content += `#EXTINF:${dur},${artist} - ${title}\n`;
      // Clean custom scheme for universal playback if local file
      let cleanUrl = t.url || "";
      if (cleanUrl.startsWith('toolnamp-audio://') || cleanUrl.startsWith('macamp-audio://')) {
        cleanUrl = decodeURIComponent(cleanUrl.replace(/^(toolnamp|macamp)-audio:\/\//, ''));
      }
      content += `${cleanUrl}\n`;
    });

    // Check if running on native macOS Cocoa bridge
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('exportM3U', { content, filename: 'toolnamp-playlist.m3u' });
      return;
    }

    // Universal Web / Blob fallback
    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toolnamp-playlist.m3u';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  openM3UPicker() {
    if (window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) {
      this.sendNative('importM3U');
    } else if (window.chrome && window.chrome.webview) {
      this.sendNative('importM3U');
    } else {
      document.getElementById('m3uPicker')?.click();
    }
  }

  handleNativeM3UImport(payload) {
    if (!payload) return;
    const content = typeof payload === 'string' ? payload : (payload.content || '');
    const baseDir = typeof payload === 'object' ? (payload.baseDir || '') : '';
    this.importM3UContent(content, baseDir);
  }

  handleM3UPicked(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      this.importM3UContent(e.target.result, '');
    };
    reader.readAsText(file);
  }

  importM3UContent(text, baseDir = '') {
    if (!text) return;
    const lines = text.split(/\r?\n/);
    let pendingMeta = null;
    let addedCount = 0;
    const initialCount = this.playlist.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const info = line.substring(8);
        const commaIdx = info.indexOf(',');
        let dur = 0;
        let titleArtist = info;
        if (commaIdx !== -1) {
          const parsed = parseInt(info.substring(0, commaIdx), 10);
          dur = (parsed > 0) ? parsed : 0;
          titleArtist = info.substring(commaIdx + 1).trim();
        }
        let artist = "M3U Track";
        let title = titleArtist;
        if (titleArtist.includes(' - ')) {
          const parts = titleArtist.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }
        pendingMeta = { duration: dur, artist, title };
      } else if (!line.startsWith('#')) {
        let rawPath = line.replace(/\\/g, '/'); // Normalize Windows backslashes

        // Handle file:// URL
        if (rawPath.startsWith('file://')) {
          rawPath = decodeURI(rawPath.replace(/^file:\/\//, ''));
        }

        let fullPath = rawPath;
        // If relative path and baseDir is known, combine them
        if (baseDir && !rawPath.startsWith('/') && !rawPath.includes('://') && !/^[a-zA-Z]:\//.test(rawPath)) {
          fullPath = baseDir.replace(/\/+$/, '') + '/' + rawPath.replace(/^\.\//, '');
        }

        let url = fullPath;
        if (url.startsWith('/') && window.webkit) {
          url = 'toolnamp-audio://local' + encodeURI(url);
        }

        const fileName = fullPath.split('/').pop().replace(/\.[^/.]+$/, "");
        let title = pendingMeta?.title || fileName || "Track";
        let artist = pendingMeta?.artist || "Local Music";
        let duration = pendingMeta?.duration || 0;

        let ext = fullPath.split('.').pop() || 'AUDIO';
        if (ext.length > 5) ext = 'AUDIO';

        this.playlist.push({
          id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title,
          artist,
          album: "Imported M3U",
          duration,
          url,
          format: ext.toUpperCase(),
          sampleRate: '44.1 kHz',
          bitrate: '320 kbps',
          size: '-'
        });
        addedCount++;
        pendingMeta = null;
      }
    }

    if (addedCount > 0) {
      this.updatePlaylistUI();
    this.probeMissingDurations();
      this.saveCollection();
      if (this.currentIndex === -1 || initialCount === 0) {
        this.loadTrack(initialCount);
      }
      const marquee = document.getElementById('trackMarquee');
      if (marquee) {
        marquee.textContent = `⚡ IMPORTED ${addedCount} TRACKS FROM M3U PLAYLIST`;
      }
    } else {
      alert("No audio tracks found in M3U file.");
    }
  }

  // --- RESPONSIVE LAYOUT & AUTO-SHRINK WHEN MODULES ARE HIDDEN ---
  updateWindowLayout() {
    const eqSec = document.getElementById('equalizerSection');
    const plSec = document.getElementById('playlistSection');
    const fxSec = document.getElementById('effectsSection');
    const appContainer = document.getElementById('appContainer');

    const eqHidden = !eqSec || eqSec.classList.contains('hidden');
    const plHidden = !plSec || plSec.classList.contains('hidden');
    const fxHidden = !fxSec || fxSec.classList.contains('hidden');

    const allBottomHidden = eqHidden && plHidden && fxHidden;
    if (appContainer) {
      appContainer.classList.toggle('no-bottom-modules', allBottomHidden);
    }

    // Dynamic target height for native macOS/Windows window
    let targetHeight = 640;
    if (this.isMiniMode) {
      targetHeight = 44;
    } else if (allBottomHidden) {
      targetHeight = 224; // Compact core player only (header + display + seek + controls)
    } else if (plHidden && !eqHidden && fxHidden) {
      targetHeight = 420; // Core + EQ
    } else if (!plHidden && eqHidden && fxHidden) {
      targetHeight = 620; // Core + Playlist (default)
    } else {
      targetHeight = 720; // Multiple modules active
    }

    this.sendNative('setWindowHeight', { height: targetHeight });
  }

  // --- CLOSE CONFIRMATION / BACKGROUND PLAYBACK ---
  requestClose() {
    const isAndroid = !!(window.AndroidBridge);
    const modal = document.getElementById('closeConfirmModal');
    const msg = document.getElementById('closeConfirmMessage');
    const bgBtn = document.getElementById('btnClosePlayBackground');

    if (!modal) {
      this.confirmClose();
      return;
    }

    if (isAndroid) {
      // Android: Offer background playback if audio is currently playing
      if (bgBtn) bgBtn.style.display = this.isPlaying ? 'inline-block' : 'none';
      if (msg) {
        msg.textContent = this.isPlaying
          ? "Audio is currently playing. What would you like to do?"
          : "Are you sure you want to exit ToolNAmp?";
      }
      modal.classList.remove('hidden');
    } else {
      // Desktop (macOS / Windows / Web):
      // NEVER show Play in Background button on desktop
      if (bgBtn) bgBtn.style.display = 'none';

      if (this.isPlaying) {
        if (msg) {
          msg.textContent = "Audio is currently playing. Are you sure you want to exit ToolNAmp?";
        }
        modal.classList.remove('hidden');
      } else {
        // If no music is playing on desktop, exit directly
        this.confirmClose();
      }
    }
  }

  confirmClose() {
    this.stop();
    this.sendNative('confirmClose', {});
    this.sendNative('closeWindow', {});
    try { window.close(); } catch (e) {}
  }

  hideCloseConfirmModal() {
    document.getElementById('closeConfirmModal')?.classList.add('hidden');
  }

  // --- EXTERNAL LINK OPENER ---
  openExternal(url) {
    if (!url) return;
    const hasNative = !!((window.webkit && window.webkit.messageHandlers && (window.webkit.messageHandlers.toolnamp || window.webkit.messageHandlers.macamp)) ||
                         (window.chrome && window.chrome.webview) ||
                         window.AndroidBridge);
    if (hasNative) {
      this.sendNative('openExternal', { url: url });
    } else {
      try {
        window.open(url, '_blank');
      } catch (e) {
        window.location.href = url;
      }
    }
  }

  detectPlatform() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('android') || window.AndroidBridge) return 'android';
    if (ua.includes('mac') || window.webkit) return 'mac';
    if (ua.includes('win') || (window.chrome && !window.webkit && !window.AndroidBridge)) return 'windows';
    return 'other';
  }

  formatReleaseNotesMarkdown(text) {
    if (!text || typeof text !== 'string') return '';

    let src = text.replace(/\r\n/g, '\n').trim();

    // 1. Code blocks (```language ... ```)
    src = src.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="md-pre"><code>${escaped.trim()}</code></pre>`;
    });

    // 2. Escape HTML entities outside pre blocks
    const parts = src.split(/(<pre[\s\S]*?<\/pre>)/g);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].startsWith('<pre')) {
        parts[i] = parts[i]
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    }
    src = parts.join('');

    // 3. Headers
    src = src.replace(/^#### (.*$)/gim, '<h5 class="md-h5">$1</h5>');
    src = src.replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
    src = src.replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    src = src.replace(/^# (.*$)/gim, '<h2 class="md-h2">$1</h2>');

    // 4. Horizontal Rules
    src = src.replace(/^(?:---|___|\*\*\*)$/gim, '<hr class="md-hr">');

    // 5. Inline Code
    src = src.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

    // 6. Bold & Italic
    src = src.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    src = src.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    src = src.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    src = src.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 7. Markdown Links [Text](URL)
    src = src.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" class="md-link" target="_blank">$1</a>');

    // 8. Bullet & Numbered Lists
    const lines = src.split('\n');
    let inList = false;
    let inNumList = false;
    const out = [];

    for (let line of lines) {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[\*\-\+]\s+(.*)$/);
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

      if (bulletMatch) {
        if (!inList) {
          if (inNumList) { out.push('</ol>'); inNumList = false; }
          out.push('<ul class="md-ul">');
          inList = true;
        }
        out.push(`<li>${bulletMatch[1]}</li>`);
      } else if (numMatch) {
        if (!inNumList) {
          if (inList) { out.push('</ul>'); inList = false; }
          out.push('<ol class="md-ol">');
          inNumList = true;
        }
        out.push(`<li>${numMatch[2]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inNumList) { out.push('</ol>'); inNumList = false; }

        if (trimmed.length > 0) {
          if (/^<(h[2-6]|hr|pre|ul|ol)/i.test(trimmed)) {
            out.push(trimmed);
          } else {
            out.push(`<p>${trimmed}</p>`);
          }
        }
      }
    }
    if (inList) out.push('</ul>');
    if (inNumList) out.push('</ol>');

    return out.join('\n');
  }

  // --- CHECK FOR UPDATES ---
  async checkForUpdates(manual = false) {
    const modal = document.getElementById('updateModal');
    const icon = document.getElementById('updateIcon');
    const title = document.getElementById('updateTitle');
    const msg = document.getElementById('updateMessage');
    const notes = document.getElementById('updateReleaseNotes');
    const dlBtn = document.getElementById('btnDownloadUpdate');
    const secBox = document.getElementById('updateSecondaryLinkBox');
    const secLink = document.getElementById('linkViewRelease');

    if (manual) {
      if (!modal) return;
      modal.classList.remove('hidden');

      if (icon) icon.textContent = '🔄';
      if (title) title.textContent = 'Checking for Updates...';
      if (msg) msg.textContent = 'Connecting to GitHub releases for ToolNAmp...';

      if (notes) {
        notes.innerHTML = '';
        notes.style.display = 'none';
        notes.classList.add('hidden');
      }
      if (dlBtn) {
        dlBtn.style.display = 'none';
        dlBtn.classList.add('hidden');
      }
      if (secBox) secBox.style.display = 'none';
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://api.github.com/repos/ToolNPlay/ToolNAmp/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const latestTag = data.tag_name || data.name || '';
      const currentTag = this.version || 'v1.1.1';

      const isNewer = latestTag && latestTag !== currentTag && this.compareVersions(latestTag, currentTag) > 0;

      if (isNewer) {
        if (!manual && sessionStorage.getItem('update_dismissed_' + latestTag) === '1') {
          return;
        }
        this.pendingUpdateTag = latestTag;
        const platform = this.detectPlatform();
        let targetDownloadUrl = data.html_url || 'https://github.com/ToolNPlay/ToolNAmp/releases/latest';
        let btnText = `📥 Download Update (${latestTag})`;

        if (Array.isArray(data.assets) && data.assets.length > 0) {
          if (platform === 'mac') {
            const dmgAsset = data.assets.find(a => a.name && a.name.endsWith('.dmg'));
            if (dmgAsset) {
              targetDownloadUrl = dmgAsset.browser_download_url;
              btnText = `📥 Download ToolNAmp.dmg (macOS)`;
            }
          } else if (platform === 'windows') {
            const winAsset = data.assets.find(a => a.name && (a.name.endsWith('.zip') || a.name.endsWith('.exe')));
            if (winAsset) {
              targetDownloadUrl = winAsset.browser_download_url;
              btnText = `📥 Download Windows Release`;
            }
          } else if (platform === 'android') {
            const apkAsset = data.assets.find(a => a.name && a.name.endsWith('.apk'));
            if (apkAsset) {
              targetDownloadUrl = apkAsset.browser_download_url;
              btnText = `📥 Download ToolNAmp.apk (Android)`;
            }
          }
        }

        // Highlight footer update button
        const footerBtn = document.getElementById('btnCheckUpdateFooter');
        if (footerBtn) footerBtn.classList.add('has-update-badge');

        const marquee = document.getElementById('trackMarquee');
        if (marquee && !this.isPlaying) {
          marquee.textContent = `⚡ NEW UPDATE AVAILABLE: ${latestTag} ⚡`;
        }

        if (modal) modal.classList.remove('hidden');

        if (icon) icon.textContent = '🎉';
        if (title) title.textContent = `New Update Available: ${latestTag}`;
        if (msg) msg.textContent = `A new version of ToolNAmp is available (Current: ${currentTag}).`;

        if (notes && data.body) {
          notes.innerHTML = this.formatReleaseNotesMarkdown(data.body);
          notes.style.display = 'block';
          notes.classList.remove('hidden');
        }

        if (dlBtn) {
          dlBtn.textContent = btnText;
          dlBtn.onclick = (e) => {
            e.preventDefault();
            this.openExternal(targetDownloadUrl);
          };
          dlBtn.style.display = 'inline-flex';
          dlBtn.classList.remove('hidden');
        }

        if (secBox && secLink && data.html_url) {
          secBox.style.display = 'block';
          secLink.onclick = (e) => {
            e.preventDefault();
            this.openExternal(data.html_url);
          };
        }
      } else {
        if (manual) {
          if (icon) icon.textContent = '✅';
          if (title) title.textContent = 'ToolNAmp is Up to Date';
          if (msg) msg.textContent = `You are running the latest version (${currentTag}).`;
          if (notes) {
            notes.innerHTML = '';
            notes.style.display = 'none';
            notes.classList.add('hidden');
          }
          if (dlBtn) {
            dlBtn.style.display = 'none';
            dlBtn.classList.add('hidden');
          }
          if (secBox) secBox.style.display = 'none';
        }
      }
    } catch (err) {
      if (manual) {
        if (icon) icon.textContent = '⚠️';
        if (title) title.textContent = 'Update Check Unavailable';
        if (msg) msg.textContent = 'Unable to check for updates. Please check your internet connection or visit toolnplay.com/software/toolnamp.';
        if (notes) {
          notes.innerHTML = '';
          notes.style.display = 'none';
          notes.classList.add('hidden');
        }
        if (dlBtn) {
          dlBtn.style.display = 'none';
          dlBtn.classList.add('hidden');
        }
        if (secBox) secBox.style.display = 'none';
      }
    }
  }

  compareVersions(v1, v2) {
    const clean1 = (v1 || '').replace(/^v/, '').split('.').map(Number);
    const clean2 = (v2 || '').replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
      const num1 = clean1[i] || 0;
      const num2 = clean2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  hideUpdateModal() {
    const modal = document.getElementById('updateModal');
    if (modal) modal.classList.add('hidden');
    const secBox = document.getElementById('updateSecondaryLinkBox');
    if (secBox) secBox.style.display = 'none';

    if (this.pendingUpdateTag) {
      try {
        sessionStorage.setItem('update_dismissed_' + this.pendingUpdateTag, '1');
      } catch (e) {}
    }
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
    let saved = localStorage.getItem('macamp_theme');
    if (!saved || saved === 'winamp-classic' || saved === 'mac-dark') {
      saved = 'modern-glass';
    }
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
    } else if (window.chrome && window.chrome.webview) {
      try {
        window.chrome.webview.postMessage({ action, ...payload });
      } catch (e) {
        console.log("WebView2 bridge error:", e);
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
