/**
 * MacAmp Audio Engine
 * Web Audio API Graph with 10-Band EQ, Preamp, Stereo Pan,
 * Procedural Convolver Reverb, Bass Booster, and Real-Time Analyser.
 */

class MacAmpAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.audioElement = new Audio();
    this.audioElement.preload = "auto";
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
  }

  init() {
    if (this.isInitialized) return;
    
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
    
    // Connect audio graph
    // source -> preamp -> eq[0] -> ... -> eq[9] -> bassBoost -> pan
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
  }

  ensureContext() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Set Audio Source URL (local file URL or blob URL)
  setSource(url) {
    this.audioElement.src = url;
    this.audioElement.load();
  }

  play() {
    this.ensureContext();
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
      this.masterGainNode.gain.setTargetAtTime(val, this.audioCtx.currentTime, 0.02);
    } else {
      this.audioElement.volume = val;
    }
  }

  setPan(val) {
    // val: -100 (Left) to 100 (Right)
    const panNormalized = Math.max(-100, Math.min(100, val)) / 100.0;
    if (this.panNode && this.panNode.pan) {
      this.panNode.pan.setTargetAtTime(panNormalized, this.audioCtx.currentTime, 0.02);
    }
  }

  setPlaybackRate(rate) {
    // rate: 0.5 to 2.0
    this.audioElement.playbackRate = Math.max(0.5, Math.min(2.0, rate));
  }

  // --- EQUALIZER METHODS ---
  setBandGain(bandIndex, gainDb) {
    if (bandIndex >= 0 && bandIndex < this.eqFilters.length) {
      const clamped = Math.max(-12, Math.min(12, gainDb));
      this.eqFilters[bandIndex].gain.setTargetAtTime(
        this.eqEnabled ? clamped : 0,
        this.audioCtx.currentTime,
        0.02
      );
    }
  }

  setPreamp(gainDb) {
    if (this.preampNode) {
      const factor = Math.pow(10, gainDb / 20.0);
      this.preampNode.gain.setTargetAtTime(
        this.eqEnabled ? factor : 1.0,
        this.audioCtx.currentTime,
        0.02
      );
    }
  }

  setEqEnabled(enabled) {
    this.eqEnabled = enabled;
    // Update all filters
    if (this.eqFilters.length > 0) {
      this.eqFilters.forEach((filter, idx) => {
        const val = enabled ? (parseFloat(document.querySelector(`[data-band="${idx}"]`)?.value || 0)) : 0;
        filter.gain.setTargetAtTime(val, this.audioCtx.currentTime, 0.02);
      });
    }
  }

  setBassBoost(gainDb) {
    if (this.bassBoostNode) {
      this.bassBoostNode.gain.setTargetAtTime(gainDb, this.audioCtx.currentTime, 0.02);
    }
  }

  // --- REVERB SIMULATION ---
  setReverbPreset(type) {
    if (!this.audioCtx) return;
    
    if (type === "off") {
      this.reverbWetGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
      this.dryGain.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.05);
      return;
    }

    let duration = 1.5;
    let decay = 2.0;
    if (type === "room") { duration = 0.8; decay = 3.0; }
    else if (type === "studio") { duration = 1.2; decay = 2.5; }
    else if (type === "hall") { duration = 2.5; decay = 1.8; }
    else if (type === "cathedral") { duration = 4.0; decay = 1.2; }

    // Procedural Impulse Response Generation
    const sampleRate = this.audioCtx.sampleRate;
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
    this.reverbWetGain.gain.setTargetAtTime(this.reverbMix, this.audioCtx.currentTime, 0.05);
    this.dryGain.gain.setTargetAtTime(1.0 - (this.reverbMix * 0.3), this.audioCtx.currentTime, 0.05);
  }

  setReverbWet(mixPercent) {
    this.reverbMix = Math.max(0, Math.min(100, mixPercent)) / 100.0;
    if (this.reverbWetGain && this.dryGain) {
      this.reverbWetGain.gain.setTargetAtTime(this.reverbMix, this.audioCtx.currentTime, 0.02);
      this.dryGain.gain.setTargetAtTime(1.0 - (this.reverbMix * 0.3), this.audioCtx.currentTime, 0.02);
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
