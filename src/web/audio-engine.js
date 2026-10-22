/**
 * ToolNAmp Audio Engine
 * Web Audio API Graph with 10-Band EQ, Preamp, Stereo Pan,
 * Procedural Convolver Reverb, Bass Booster, and Real-Time Analyser.
 * Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman
 */

class MacAmpAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.audioElement = new Audio();
    this.audioElement.preload = "auto";
    // Crucial for Web Audio API: allow CORS streaming so MediaElementAudioSourceNode is not muted
    this.audioElement.crossOrigin = "anonymous";
    this.audioElement.onerror = (e) => {
      console.warn("Audio Element error:", this.audioElement.error);
    };

    // Equalizer frequencies (Winamp standard 10 bands)
    this.eqFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.eqFilters = [];
    this.eqEnabled = true;

    // Nodes
    this.sourceNode = null;
    this.preampNode = null;
    this.bassBoostNode = null;
    this.panNode = null;
    this.analyserNode = null;
    this.masterGainNode = null;

    // Reverb nodes
    this.convolverNode = null;
    this.reverbWetGain = null;
    this.dryGain = null;
    this.reverbMix = 0.3;

    // Audio analysis buffers
    this.freqData = null;
    this.timeData = null;

    // VU meter levels
    this.vuLeft = 0;
    this.vuRight = 0;
    this.peakLeft = 0;
    this.peakRight = 0;
    this.peakDecay = 0.94;

    this.isInitialized = false;

    // Ensure audio element is appended to DOM for proper WebKit media lifecycle
    if (typeof document !== 'undefined') {
      if (document.body) {
        document.body.appendChild(this.audioElement);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(this.audioElement);
        });
      }
    }
  }

  init() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      // Create Media Element Source from our HTML5 Audio element
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);

      // 1. Preamp Gain (-12dB to +12dB)
      this.preampNode = this.audioCtx.createGain();
      this.preampNode.gain.value = 1.0;

      // 2. 10-Band Equalizer Biquad Filters
      this.eqFilters = this.eqFrequencies.map((freq, index) => {
        const filter = this.audioCtx.createBiquadFilter();
        if (index === 0) {
          filter.type = "lowshelf";
        } else if (index === this.eqFrequencies.length - 1) {
          filter.type = "highshelf";
        } else {
          filter.type = "peaking";
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // 3. Sub-Bass Booster Filter (Lowshelf at 80Hz)
      this.bassBoostNode = this.audioCtx.createBiquadFilter();
      this.bassBoostNode.type = "lowshelf";
      this.bassBoostNode.frequency.value = 80;
      this.bassBoostNode.gain.value = 0;

      // 4. Stereo Panner (-1.0 to +1.0)
      if (this.audioCtx.createStereoPanner) {
        this.panNode = this.audioCtx.createStereoPanner();
        this.panNode.pan.value = 0;
      } else {
        this.panNode = this.audioCtx.createGain();
      }

      // 5. Convolver Reverb & Dry/Wet Splitter
      this.convolverNode = this.audioCtx.createConvolver();
      this.dryGain = this.audioCtx.createGain();
      this.reverbWetGain = this.audioCtx.createGain();
      this.dryGain.gain.value = 1.0;
      this.reverbWetGain.gain.value = 0.0;

      // 6. Master Volume Gain
      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.value = 0.8;

      // 7. Analyser Node (FFT for Spectrum & Waveform)
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.75;
      this.analyserNode.minDecibels = -90;
      this.analyserNode.maxDecibels = -10;

      this.freqData = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyserNode.frequencyBinCount);

      // Connect audio graph:
      // source -> preamp -> eq[0] -> ... -> eq[9] -> bassBoost -> pan -> [dry + wet] -> masterGain -> analyser -> destination
      let currentNode = this.sourceNode;
      currentNode.connect(this.preampNode);
      currentNode = this.preampNode;

      for (const filter of this.eqFilters) {
        currentNode.connect(filter);
        currentNode = filter;
      }

      currentNode.connect(this.bassBoostNode);
      currentNode = this.bassBoostNode;

      currentNode.connect(this.panNode);

      // Split to Reverb Wet + Dry
      this.panNode.connect(this.dryGain);
      this.panNode.connect(this.convolverNode);
      this.convolverNode.connect(this.reverbWetGain);

      // Merge back to Master Gain
      this.dryGain.connect(this.masterGainNode);
      this.reverbWetGain.connect(this.masterGainNode);

      // Master Gain -> Analyser -> Speakers
      this.masterGainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);

      this.isInitialized = true;

      // Synchronize with UI equalizer values if already set
      if (window.equalizer) {
        this.eqEnabled = window.equalizer.enabled;
        this.setPreamp(window.equalizer.preampValue);
        window.equalizer.bandValues.forEach((val, idx) => {
          this.setBandGain(idx, val);
        });
      }
    } catch (err) {
      console.error("[AudioEngine] Error during Web Audio init:", err);
    }
  }

  ensureContext() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Set Audio Source URL (local file URL, custom scheme, or blob URL)
  setSource(url) {
    if (!url) return;
    if (this.audioElement.src === url) return;
    this.audioElement.src = url;
    this.audioElement.load();
  }

  play() {
    this.ensureContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioElement.play();
  }

  pause() {
    this.audioElement.pause();
  }

  stop() {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  seek(seconds) {
    if (this.audioElement.duration) {
      this.audioElement.currentTime = Math.max(0, Math.min(this.audioElement.duration, seconds));
    }
  }

  setVolume(percent) {
    const val = Math.max(0, Math.min(100, percent)) / 100.0;
    if (this.masterGainNode) {
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      this.masterGainNode.gain.cancelScheduledValues(0);
      this.masterGainNode.gain.setValueAtTime(val, now);
      this.masterGainNode.gain.value = val;
    } else {
      this.audioElement.volume = val;
    }
  }

  setPan(val) {
    // val: -100 (Left) to 100 (Right)
    const panNormalized = Math.max(-100, Math.min(100, val)) / 100.0;
    if (this.panNode && this.panNode.pan) {
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      this.panNode.pan.cancelScheduledValues(0);
      this.panNode.pan.setValueAtTime(panNormalized, now);
      this.panNode.pan.value = panNormalized;
    }
  }

  setPlaybackRate(rate) {
    // rate: 0.5 to 2.0
    this.audioElement.playbackRate = Math.max(0.5, Math.min(2.0, rate));
  }

  // --- EQUALIZER METHODS ---
  setBandGain(bandIndex, gainDb) {
    if (!this.isInitialized) {
      this.ensureContext();
    }
    if (this.eqFilters && this.eqFilters[bandIndex]) {
      const clamped = Math.max(-12, Math.min(12, gainDb));
      const targetGain = this.eqEnabled ? clamped : 0;
      const filter = this.eqFilters[bandIndex];
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      filter.gain.cancelScheduledValues(0);
      filter.gain.setValueAtTime(targetGain, now);
      filter.gain.value = targetGain;
    }
  }

  setPreamp(gainDb) {
    if (!this.isInitialized) {
      this.ensureContext();
    }
    if (this.preampNode) {
      const targetDb = this.eqEnabled ? gainDb : 0;
      const factor = Math.pow(10, targetDb / 20.0);
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      this.preampNode.gain.cancelScheduledValues(0);
      this.preampNode.gain.setValueAtTime(factor, now);
      this.preampNode.gain.value = factor;
    }
  }

  setEqEnabled(enabled) {
    this.eqEnabled = enabled;
    if (!this.isInitialized) {
      this.ensureContext();
    }
    if (this.preampNode && window.equalizer) {
      this.setPreamp(window.equalizer.preampValue);
    }
    if (this.eqFilters && this.eqFilters.length > 0) {
      this.eqFilters.forEach((filter, idx) => {
        const val = enabled ? (window.equalizer ? window.equalizer.bandValues[idx] : 0) : 0;
        const now = this.audioCtx ? this.audioCtx.currentTime : 0;
        filter.gain.cancelScheduledValues(0);
        filter.gain.setValueAtTime(val, now);
        filter.gain.value = val;
      });
    }
  }

  setBassBoost(gainDb) {
    if (!this.isInitialized) {
      this.ensureContext();
    }
    if (this.bassBoostNode) {
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      this.bassBoostNode.gain.cancelScheduledValues(0);
      this.bassBoostNode.gain.setValueAtTime(gainDb, now);
      this.bassBoostNode.gain.value = gainDb;
    }
  }

  // --- REVERB SIMULATION ---
  setReverbPreset(type) {
    this.ensureContext();
    if (!this.audioCtx || !this.reverbWetGain || !this.dryGain) return;

    if (type === "off") {
      const now = this.audioCtx.currentTime;
      this.reverbWetGain.gain.setValueAtTime(0, now);
      this.reverbWetGain.gain.value = 0;
      this.dryGain.gain.setValueAtTime(1.0, now);
      this.dryGain.gain.value = 1.0;
      return;
    }

    let duration = 1.5;
    let decay = 2.0;
    if (type === "room") { duration = 0.8; decay = 3.0; }
    else if (type === "studio") { duration = 1.2; decay = 2.5; }
    else if (type === "hall") { duration = 2.5; decay = 1.8; }
    else if (type === "cathedral") { duration = 4.0; decay = 1.2; }

    // Procedural Impulse Response Generation
    const sampleRate = this.audioCtx.sampleRate || 44100;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(1 - n, decay);
      leftChannel[i] = (Math.random() * 2 - 1) * env;
      rightChannel[i] = (Math.random() * 2 - 1) * env;
    }

    this.convolverNode.buffer = impulse;
    const now = this.audioCtx.currentTime;
    this.reverbWetGain.gain.setValueAtTime(this.reverbMix, now);
    this.reverbWetGain.gain.value = this.reverbMix;
    this.dryGain.gain.setValueAtTime(1.0 - (this.reverbMix * 0.3), now);
    this.dryGain.gain.value = 1.0 - (this.reverbMix * 0.3);
  }

  setReverbWet(mixPercent) {
    this.reverbMix = Math.max(0, Math.min(100, mixPercent)) / 100.0;
    if (this.reverbWetGain && this.dryGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.reverbWetGain.gain.setValueAtTime(this.reverbMix, now);
      this.reverbWetGain.gain.value = this.reverbMix;
      this.dryGain.gain.setValueAtTime(1.0 - (this.reverbMix * 0.3), now);
      this.dryGain.gain.value = 1.0 - (this.reverbMix * 0.3);
    }
  }

  // --- AUDIO METRICS & ANALYSIS ---
  getFrequencyData() {
    if (this.analyserNode && this.freqData) {
      this.analyserNode.getByteFrequencyData(this.freqData);
      return this.freqData;
    }
    return null;
  }

  getTimeDomainData() {
    if (this.analyserNode && this.timeData) {
      this.analyserNode.getByteTimeDomainData(this.timeData);
      return this.timeData;
    }
    return null;
  }

  getVUMeterLevels() {
    if (!this.analyserNode || !this.timeData) {
      return { left: 0, right: 0, peakLeft: 0, peakRight: 0 };
    }

    this.analyserNode.getByteTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const sample = (this.timeData[i] - 128) / 128.0;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / this.timeData.length);
    const level = Math.min(100, Math.round(rms * 280));

    // Simulate stereo divergence slightly from frequency distribution
    const fData = this.getFrequencyData();
    let leftWeight = 1.0;
    let rightWeight = 1.0;
    if (fData) {
      const lowSum = fData.slice(0, 30).reduce((a, b) => a + b, 0);
      const highSum = fData.slice(100, 250).reduce((a, b) => a + b, 0);
      if (lowSum + highSum > 0) {
        leftWeight = 0.95 + (lowSum / (lowSum + highSum)) * 0.1;
        rightWeight = 0.95 + (highSum / (lowSum + highSum)) * 0.1;
      }
    }

    this.vuLeft = Math.min(100, Math.round(level * leftWeight));
    this.vuRight = Math.min(100, Math.round(level * rightWeight));

    // Peak hold with decay
    if (this.vuLeft > this.peakLeft) this.peakLeft = this.vuLeft;
    else this.peakLeft = Math.max(0, this.peakLeft * this.peakDecay);

    if (this.vuRight > this.peakRight) this.peakRight = this.vuRight;
    else this.peakRight = Math.max(0, this.peakRight * this.peakDecay);

    return {
      left: this.vuLeft,
      right: this.vuRight,
      peakLeft: Math.round(this.peakLeft),
      peakRight: Math.round(this.peakRight)
    };
  }
}

// Global instance
window.audioEngine = new MacAmpAudioEngine();
