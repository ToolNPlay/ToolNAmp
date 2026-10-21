/**
 * MacAmp Audio Visualizer Engine
 * 5 Iconic High-Performance Canvas Visualizer Modes:
 * 1. Classic Winamp Spectrum Analyzer (Segmented LEDs + Falling Peaks)
 * 2. Phosphor Green Oscilloscope Waveform
 * 3. Cyberpunk Neon Bars with Floor Reflection
 * 4. Circular Radian Visualizer with Pulsing Core
 * 5. 3D Warp Speed Starfield
 */

class MacAmpVisualizer {
  constructor(canvasId, miniCanvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    this.miniCanvas = document.getElementById(miniCanvasId);
    this.miniCtx = this.miniCanvas ? this.miniCanvas.getContext('2d') : null;
    
    this.mode = 0; // 0 to 4
    this.modeNames = [
      "SPECTRUM ANALYZER (WINAMP CLASSIC)",
      "OSCILLOSCOPE WAVEFORM",
      "CYBERPUNK NEON BARS",
      "CIRCULAR RADIAN SPECTRUM",
      "3D WARP SPEED STARFIELD"
    ];
    
    this.isMaximized = false;
    
    // Spectrum settings
    this.numBars = 32;
    this.peaks = new Array(this.numBars).fill(0);
    this.peakDecay = 0.95;
    this.gravity = 0.5;
    
    // Starfield particles
    this.stars = [];
    this.initStars(300);
    
    this.animId = null;
    this.bindEvents();
    this.start();
  }

  bindEvents() {
    const canvas = document.getElementById('visualizerCanvas');
    const btnMax = document.getElementById('btnMaxVis');
    const btnRestore = document.getElementById('btnTheaterRestore');
    const chips = document.querySelectorAll('.vis-chip');

    // Canvas click cycles to next mode
    if (canvas) {
      canvas.addEventListener('click', (e) => {
        this.nextMode();
      });
      // Double click canvas toggles maximize
      canvas.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.toggleMaximize();
      });
    }

    // Direct mode chips (Spectrum, Wave, Neon, Radian, Warp)
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const modeIndex = parseInt(chip.getAttribute('data-mode'), 10);
        this.setMode(modeIndex);
      });
    });

    // 1-Click Maximize / Restore button
    if (btnMax) {
      btnMax.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMaximize();
      });
    }

    // Theater bar restore button
    if (btnRestore) {
      btnRestore.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMaximize(false);
      });
    }

    // Theater transport buttons
    document.getElementById('btnTheaterPrev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.macAmp && window.macAmp.prevTrack();
    });

    document.getElementById('btnTheaterPlay')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.macAmp && window.macAmp.togglePlayPause();
    });

    document.getElementById('btnTheaterNext')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.macAmp && window.macAmp.nextTrack();
    });
  }

  setMode(index) {
    if (index >= 0 && index < this.modeNames.length) {
      this.mode = index;
      this.updateModeUI();
    }
  }

  nextMode() {
    this.mode = (this.mode + 1) % this.modeNames.length;
    this.updateModeUI();
  }

  updateModeUI() {
    const label = document.getElementById('visModeLabel');
    if (label) {
      label.textContent = this.modeNames[this.mode];
    }
    // Update active chip
    document.querySelectorAll('.vis-chip').forEach(chip => {
      const modeIdx = parseInt(chip.getAttribute('data-mode'), 10);
      chip.classList.toggle('active', modeIdx === this.mode);
    });
  }

  toggleMaximize(forceState) {
    const container = document.getElementById('visualizerContainer');
    if (!container) return;

    this.isMaximized = (typeof forceState === 'boolean') ? forceState : !this.isMaximized;
    container.classList.toggle('maximized', this.isMaximized);

    const maxIcon = document.getElementById('visMaxIcon');
    const maxText = document.getElementById('visMaxText');
    const btnMax = document.getElementById('btnMaxVis');
    const theaterTitle = document.getElementById('visTheaterTitle');

    if (this.isMaximized) {
      if (maxIcon) maxIcon.textContent = '⤡';
      if (maxText) maxText.textContent = 'RESTORE';
      if (btnMax) btnMax.title = "Restore Visualizer to Normal View (ESC / F)";
      if (theaterTitle && window.macAmp && window.macAmp.currentTrackMeta) {
        theaterTitle.textContent = `${window.macAmp.currentTrackMeta.artist} - ${window.macAmp.currentTrackMeta.title}`;
      }
    } else {
      if (maxIcon) maxIcon.textContent = '⤢';
      if (maxText) maxText.textContent = 'MAXIMIZE';
      if (btnMax) btnMax.title = "1-Click Maximize Visualizer to Full Stage (F)";
    }

    // Adapt peaks array for new width
    const targetBars = this.isMaximized ? 64 : 32;
    if (this.peaks.length !== targetBars) {
      this.peaks = new Array(targetBars).fill(0);
    }

    // Force canvas dimension update immediately
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
  }

  initStars(count) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 400,
        z: Math.random() * 600,
        pz: 600
      });
    }
  }

  start() {
    const loop = () => {
      this.render();
      this.renderMini();
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  }

  render() {
    if (!this.ctx || !window.audioEngine) return;
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Handle Retina scaling
    const rect = this.canvas.getBoundingClientRect();
    if (this.canvas.width !== Math.round(rect.width * window.devicePixelRatio)) {
      this.canvas.width = Math.round(rect.width * window.devicePixelRatio);
      this.canvas.height = Math.round(rect.height * window.devicePixelRatio);
    }
    
    const curW = this.canvas.width;
    const curH = this.canvas.height;
    const freqData = window.audioEngine.getFrequencyData();
    const timeData = window.audioEngine.getTimeDomainData();
    
    switch (this.mode) {
      case 0:
        this.drawClassicSpectrum(curW, curH, freqData);
        break;
      case 1:
        this.drawOscilloscope(curW, curH, timeData);
        break;
      case 2:
        this.drawCyberpunkBars(curW, curH, freqData);
        break;
      case 3:
        this.drawCircularRadian(curW, curH, freqData);
        break;
      case 4:
        this.drawStarfield(curW, curH, freqData);
        break;
    }
  }

  // 1. Classic Winamp 2.x Spectrum Analyzer with segmented LEDs and falling peak markers
  drawClassicSpectrum(w, h, freqData) {
    const ctx = this.ctx;
    ctx.fillStyle = '#090b0e';
    ctx.fillRect(0, 0, w, h);
    
    if (!freqData) return;
    
    const numBars = this.isMaximized ? 64 : 32;
    if (this.peaks.length !== numBars) {
      this.peaks = new Array(numBars).fill(0);
    }
    const barSpacing = Math.max(1, Math.floor(w * (this.isMaximized ? 0.004 : 0.008)));
    const totalSpacing = barSpacing * (numBars + 1);
    const barWidth = Math.max(2, Math.floor((w - totalSpacing) / numBars));
    
    const blockHeight = Math.max(2, Math.floor(h * (this.isMaximized ? 0.02 : 0.04)));
    const blockSpacing = 1;
    const totalBlocks = Math.floor((h - 8) / (blockHeight + blockSpacing));
    
    for (let i = 0; i < numBars; i++) {
      // Frequency bin mapping with logarithmic emphasis on bass/mids
      const binIdx = Math.floor(Math.pow(i / numBars, 1.8) * (freqData.length * 0.5));
      const val = freqData[binIdx] || 0;
      const normalized = val / 255.0;
      const barHeight = normalized * (h - 8);
      const activeBlocks = Math.round(normalized * totalBlocks);
      
      const x = barSpacing + i * (barWidth + barSpacing);
      
      // Draw segmented LED blocks
      for (let b = 0; b < activeBlocks; b++) {
        const y = h - 4 - (b + 1) * (blockHeight + blockSpacing);
        const blockNorm = b / totalBlocks;
        
        if (blockNorm < 0.6) {
          ctx.fillStyle = '#00ff66'; // Green
        } else if (blockNorm < 0.85) {
          ctx.fillStyle = '#ffaa00'; // Amber/Yellow
        } else {
          ctx.fillStyle = '#ff3333'; // Red
        }
        
        ctx.fillRect(x, y, barWidth, blockHeight);
      }
      
      // Falling Peak markers
      if (barHeight >= this.peaks[i]) {
        this.peaks[i] = barHeight;
      } else {
        this.peaks[i] = Math.max(0, this.peaks[i] - this.gravity);
      }
      
      if (this.peaks[i] > 2) {
        const peakY = h - 4 - this.peaks[i];
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, Math.max(2, peakY), barWidth, Math.max(1, blockHeight * 0.7));
      }
    }
  }

  // 2. Phosphor Green Oscilloscope Waveform
  drawOscilloscope(w, h, timeData) {
    const ctx = this.ctx;
    
    // Trail persistence fade
    ctx.fillStyle = 'rgba(9, 11, 14, 0.25)';
    ctx.fillRect(0, 0, w, h);
    
    if (!timeData) return;
    
    // Center horizontal baseline grid
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    
    // Waveform line with neon glow
    ctx.strokeStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = this.isMaximized ? 12 : 8;
    ctx.lineWidth = this.isMaximized ? 3.0 : 2.0;
    ctx.beginPath();
    
    const sliceWidth = w / timeData.length;
    let x = 0;
    
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * h) / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset
  }

  // 3. Cyberpunk Neon Bars with Floor Reflection
  drawCyberpunkBars(w, h, freqData) {
    const ctx = this.ctx;
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, w, h);
    
    if (!freqData) return;
    
    const bars = this.isMaximized ? 64 : 40;
    const barWidth = w / bars;
    const centerY = h * 0.65;
    
    for (let i = 0; i < bars; i++) {
      const bin = Math.floor(Math.pow(i / bars, 1.6) * (freqData.length * 0.45));
      const val = (freqData[bin] || 0) / 255.0;
      const barH = val * centerY * 0.9;
      const x = i * barWidth;
      
      // Top bar
      const grad = ctx.createLinearGradient(0, centerY - barH, 0, centerY);
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(1, '#ff0055');
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, centerY - barH, barWidth - 2, barH);
      
      // Floor reflection (dim & blurred)
      const refH = barH * 0.4;
      const refGrad = ctx.createLinearGradient(0, centerY, 0, centerY + refH);
      refGrad.addColorStop(0, 'rgba(255, 0, 85, 0.4)');
      refGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = refGrad;
      ctx.fillRect(x + 1, centerY, barWidth - 2, refH);
    }
    
    // Horizon separator line
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();
  }

  // 4. Circular Radian Spectrum
  drawCircularRadian(w, h, freqData) {
    const ctx = this.ctx;
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, w, h);
    
    if (!freqData) return;
    
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) * (this.isMaximized ? 0.25 : 0.22);
    const totalBars = this.isMaximized ? 64 : 48;
    
    // Center pulse
    const bass = (freqData[2] || 0) / 255.0;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * (0.8 + bass * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 113, 206, ${0.2 + bass * 0.4})`;
    ctx.fill();
    ctx.strokeStyle = '#ff71ce';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Radial bars
    for (let i = 0; i < totalBars; i++) {
      const rad = (i / totalBars) * Math.PI * 2;
      const bin = Math.floor((i / totalBars) * (freqData.length * 0.3));
      const val = (freqData[bin] || 0) / 255.0;
      const length = val * (Math.min(w, h) * 0.28);
      
      const x1 = cx + Math.cos(rad) * baseRadius;
      const y1 = cy + Math.sin(rad) * baseRadius;
      const x2 = cx + Math.cos(rad) * (baseRadius + length);
      const y2 = cy + Math.sin(rad) * (baseRadius + length);
      
      ctx.strokeStyle = i % 2 === 0 ? '#01cdfe' : '#fffb96';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // 5. 3D Warp Speed Starfield
  drawStarfield(w, h, freqData) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5, 5, 10, 0.35)';
    ctx.fillRect(0, 0, w, h);
    
    const cx = w / 2;
    const cy = h / 2;
    
    let speed = 4;
    if (freqData) {
      const bass = (freqData[1] || 0) / 255.0;
      speed = 3 + bass * 18;
    }
    
    for (const star of this.stars) {
      star.pz = star.z;
      star.z -= speed;
      
      if (star.z <= 0) {
        star.z = 600;
        star.pz = 600;
        star.x = (Math.random() - 0.5) * w * 1.5;
        star.y = (Math.random() - 0.5) * h * 1.5;
      }
      
      const k = 150 / star.z;
      const px = star.x * k + cx;
      const py = star.y * k + cy;
      
      const pk = 150 / star.pz;
      const ppx = star.x * pk + cx;
      const ppy = star.y * pk + cy;
      
      const size = Math.max(1, (1 - star.z / 600) * 3);
      const alpha = Math.min(1, (1 - star.z / 600) * 1.5);
      
      ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(ppx, ppy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  }

  // Mini Visualizer for Window Shade mode
  renderMini() {
    if (!this.miniCtx || !window.audioEngine) return;
    const ctx = this.miniCtx;
    const w = this.miniCanvas.width;
    const h = this.miniCanvas.height;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    
    const freqData = window.audioEngine.getFrequencyData();
    if (!freqData) return;
    
    const bars = 16;
    const barW = Math.floor(w / bars);
    
    for (let i = 0; i < bars; i++) {
      const bin = Math.floor((i / bars) * (freqData.length * 0.4));
      const val = (freqData[bin] || 0) / 255.0;
      const barH = Math.round(val * h);
      
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(i * barW, h - barH, barW - 1, barH);
    }
  }
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
  window.visualizer = new MacAmpVisualizer('visualizerCanvas', 'miniVisualizerCanvas');
});
