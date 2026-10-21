/**
 * MacAmp Graphic Equalizer Controller
 * Manages 10 frequency bands, Preamp, Power switch,
 * Presets, and real-time EQ Curve rendering.
 */

class MacAmpEqualizer {
  constructor() {
    this.bands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.bandValues = new Array(10).fill(0);
    this.preampValue = 0;
    this.enabled = true;
    
    this.presets = {
      flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      rock: [4.5, 3.0, -1.5, -2.5, -1.0, 2.0, 4.0, 5.5, 5.5, 5.5],
      pop: [-1.5, 1.0, 3.0, 4.0, 3.5, 1.5, -1.0, -1.5, -1.5, -1.5],
      techno: [5.0, 4.0, 0, -3.5, -3.0, 0, 5.0, 6.0, 6.0, 5.5],
      dance: [6.0, 5.0, 1.5, 0, 0, -3.0, -4.0, -4.0, 0, 0],
      club: [1.0, 2.0, 3.5, 3.5, 3.5, 2.0, 0, 0, 0, 0],
      bass: [7.0, 6.0, 5.0, 2.5, 0, -2.0, -3.0, -4.0, -4.0, -4.0],
      vocal: [-2.0, -3.0, -3.0, 1.5, 4.5, 4.5, 3.0, 1.0, 0, -1.5],
      metal: [5.0, 4.0, 1.5, -3.0, -4.5, -2.0, 3.0, 6.0, 7.5, 7.0],
      classical: [4.5, 3.5, 3.0, 2.5, -1.5, -1.5, 0, 2.0, 3.0, 3.5],
      jazz: [3.5, 2.5, 1.0, 2.0, -1.5, -1.5, 0, 1.5, 3.0, 3.5],
      acoustic: [3.5, 3.0, 1.5, 1.0, 1.5, 2.0, 3.0, 3.5, 3.0, 1.5],
      reggae: [0, 0, -1.0, -4.0, 0, 4.0, 4.0, 1.5, 0, 0]
    };

    this.curveCanvas = document.getElementById('eqCurveCanvas');
    this.curveCtx = this.curveCanvas ? this.curveCanvas.getContext('2d') : null;

    this.bindEvents();
    this.drawCurve();
  }

  bindEvents() {
    // 1. Band sliders
    const bandSliders = document.querySelectorAll('.eq-band');
    bandSliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        const bandIdx = parseInt(e.target.dataset.band, 10);
        const val = parseFloat(e.target.value);
        this.bandValues[bandIdx] = val;
        
        // Update readout label
        const valLabel = document.querySelector(`[data-val="${bandIdx}"]`);
        if (valLabel) {
          valLabel.textContent = (val > 0 ? `+${val}` : `${val}`) + ' dB';
        }
        
        if (window.audioEngine) {
          window.audioEngine.setBandGain(bandIdx, val);
        }
        this.drawCurve();
      });
    });

    // 2. Preamp slider
    const preampSlider = document.getElementById('eqPreamp');
    if (preampSlider) {
      preampSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.preampValue = val;
        const label = document.getElementById('valPreamp');
        if (label) {
          label.textContent = (val > 0 ? `+${val}` : `${val}`) + ' dB';
        }
        if (window.audioEngine) {
          window.audioEngine.setPreamp(val);
        }
        this.drawCurve();
      });
    }

    // 3. Power toggle
    const powerSwitch = document.getElementById('eqPower');
    if (powerSwitch) {
      powerSwitch.addEventListener('change', (e) => {
        this.enabled = e.target.checked;
        if (window.audioEngine) {
          window.audioEngine.setEqEnabled(this.enabled);
        }
        this.drawCurve();
      });
    }

    // 4. Presets dropdown
    const presetSelect = document.getElementById('eqPresetSelect');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
      });
    }

    // 5. Reset button
    const resetBtn = document.getElementById('btnResetEQ');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.applyPreset('flat');
        if (preampSlider) {
          preampSlider.value = 0;
          preampSlider.dispatchEvent(new Event('input'));
        }
        if (presetSelect) presetSelect.value = 'flat';
      });
    }
  }

  applyPreset(presetKey) {
    const vals = this.presets[presetKey] || this.presets.flat;
    this.bandValues = [...vals];
    
    vals.forEach((val, idx) => {
      const slider = document.querySelector(`.eq-band[data-band="${idx}"]`);
      if (slider) {
        slider.value = val;
        const valLabel = document.querySelector(`[data-val="${idx}"]`);
        if (valLabel) {
          valLabel.textContent = (val > 0 ? `+${val}` : `${val}`) + ' dB';
        }
      }
      if (window.audioEngine) {
        window.audioEngine.setBandGain(idx, val);
      }
    });
    
    this.drawCurve();
  }

  drawCurve() {
    if (!this.curveCtx || !this.curveCanvas) return;
    
    const ctx = this.curveCtx;
    const w = this.curveCanvas.width;
    const h = this.curveCanvas.height;
    
    // Clear
    ctx.fillStyle = '#090b0e';
    ctx.fillRect(0, 0, w, h);
    
    // Center 0 dB baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    
    if (!this.enabled) {
      // Flat disabled line
      ctx.strokeStyle = '#555555';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }
    
    // Draw smooth Bezier curve through all 10 band points
    const points = [];
    const count = this.bandValues.length;
    
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count) * w;
      // map -12dB .. +12dB to height
      const db = this.bandValues[i];
      const norm = (db + 12) / 24.0; // 0.0 to 1.0
      const y = h - (norm * (h - 4) + 2);
      points.push({ x, y });
    }
    
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, points[0].y);
    
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(w, points[points.length - 1].y);
    ctx.stroke();
    
    // Fill subtle gradient under curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
  window.equalizer = new MacAmpEqualizer();
});
