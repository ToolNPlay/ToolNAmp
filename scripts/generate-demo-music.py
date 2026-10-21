#!/usr/bin/env python3
"""
Procedural Demo Audio Generator for MacAmp
Generates 3 authentic retro audio tracks in WAV format:
1. Neon Nights (Synthwave / Outrun)
2. 8-Bit Odyssey (Chiptune / Gameboy)
3. Midnight City (Lo-Fi Chillwave)
"""

import math
import struct
import wave
import os
import random

SAMPLE_RATE = 44100

def clamp(val, min_val=-1.0, max_val=1.0):
    return max(min_val, min(max_val, val))

def generate_synthwave(filename, duration_sec=32.0):
    bpm = 124.0
    beat_dur = 60.0 / bpm
    total_samples = int(duration_sec * SAMPLE_RATE)
    
    # Bass notes: Am - F - C - G
    chords = [
        # Am: A2, C3, E3
        [110.0, 130.81, 164.81],
        # F: F2, A2, C3
        [87.31, 110.0, 130.81],
        # C: C2, E2, G2
        [65.41, 82.41, 98.00],
        # G: G2, B2, D3
        [98.00, 123.47, 146.83]
    ]
    
    lead_notes = [
        # Melody frequencies (A4 minor pentatonic / synth lead)
        440.0, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25,
        440.0, 392.00, 440.0, 523.25, 659.25, 587.33, 523.25, 440.0
    ]
    
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(2) # Stereo
        wav.setsampwidth(2) # 16-bit
        wav.setframerate(SAMPLE_RATE)
        
        frames = bytearray()
        
        for i in range(total_samples):
            t = i / SAMPLE_RATE
            beat = t / beat_dur
            bar = int(beat // 4)
            chord_idx = bar % len(chords)
            
            # 1. Kick Drum (on every beat 1, 2, 3, 4)
            beat_frac = beat % 1.0
            kick = 0.0
            if beat_frac < 0.25:
                pitch_decay = math.exp(-beat_frac * 35.0)
                freq_kick = 50.0 + 120.0 * pitch_decay
                kick = math.sin(2.0 * math.pi * freq_kick * beat_frac) * math.exp(-beat_frac * 12.0) * 0.7
            
            # 2. Snare Drum (on beats 2 and 4)
            snare_frac = (beat + 1.0) % 2.0
            snare = 0.0
            if snare_frac < 0.3:
                # noise + tone
                
                noise = (random.random() * 2.0 - 1.0) * math.exp(-snare_frac * 20.0)
                tone = math.sin(2.0 * math.pi * 180.0 * snare_frac) * math.exp(-snare_frac * 25.0)
                snare = (noise * 0.6 + tone * 0.4) * 0.5
            
            # 3. Hi-Hat (16th notes)
            sixteenth = (beat * 4.0) % 1.0
            hihat = 0.0
            if sixteenth < 0.1:
                noise = (random.random() * 2.0 - 1.0)
                hihat = noise * math.exp(-sixteenth * 50.0) * 0.25
            
            # 4. Rolling Synth Bass (16th note arp)
            sixteenth_idx = int((beat * 4.0) % 4)
            chord = chords[chord_idx]
            bass_freq = chord[sixteenth_idx % len(chord)]
            bass_t = sixteenth * (beat_dur / 4.0)
            # Sawtooth-like wave
            saw = (2.0 * ((t * bass_freq) % 1.0) - 1.0)
            bass = saw * math.exp(-sixteenth * 5.0) * 0.35
            
            # 5. Lead Synth (melodic 8th notes with vibrato)
            eighth_idx = int(beat * 2.0) % len(lead_notes)
            lead_freq = lead_notes[eighth_idx]
            # vibrato
            vibrato = math.sin(2.0 * math.pi * 5.5 * t) * 6.0
            lead_phase = 2.0 * math.pi * (lead_freq + vibrato) * t
            # square/pulse wave
            lead_val = (1.0 if math.sin(lead_phase) > 0.0 else -1.0)
            lead_filter = math.sin(lead_phase) * 0.6 + lead_val * 0.4
            lead_frac = (beat * 2.0) % 1.0
            lead = lead_filter * math.exp(-lead_frac * 2.5) * 0.28
            
            # 6. Stereo Pad Chords
            pad_left = 0.0
            pad_right = 0.0
            for note_f in chord:
                pad_left += math.sin(2.0 * math.pi * note_f * 2.0 * t) * 0.05
                pad_right += math.sin(2.0 * math.pi * note_f * 2.01 * t + 0.5) * 0.05
            
            # Mix Stereo
            left = kick * 0.7 + snare * 0.6 + hihat * 0.4 + bass * 0.6 + lead * 0.7 + pad_left
            right = kick * 0.7 + snare * 0.6 + hihat * 0.7 + bass * 0.6 + lead * 0.7 + pad_right
            
            # Master fade in & out
            fade = 1.0
            if t < 0.5:
                fade = t / 0.5
            elif t > duration_sec - 1.0:
                fade = (duration_sec - t) / 1.0
                
            left = clamp(left * fade * 0.8)
            right = clamp(right * fade * 0.8)
            
            # 16-bit PCM integer
            left_int = int(left * 32767.0)
            right_int = int(right * 32767.0)
            
            frames += struct.pack('<hh', left_int, right_int)
            
        wav.writeframes(frames)
    print(f"Generated {filename}")

def generate_chiptune(filename, duration_sec=28.0):
    bpm = 142.0
    beat_dur = 60.0 / bpm
    total_samples = int(duration_sec * SAMPLE_RATE)
    
    # Upbeat melody notes
    melody = [
        523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 587.33, 659.25,
        523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33,
        659.25, 783.99, 880.00, 1046.50, 1174.66, 1046.50, 880.00, 783.99,
        880.00, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 523.25
    ]
    
    bass_notes = [261.63, 261.63, 220.00, 220.00, 174.61, 174.61, 196.00, 196.00]
    
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        
        frames = bytearray()
        
        
        for i in range(total_samples):
            t = i / SAMPLE_RATE
            beat = t / beat_dur
            
            # Chiptune Pulse Lead (25% duty cycle)
            m_idx = int(beat * 4.0) % len(melody)
            m_freq = melody[m_idx]
            phase = (t * m_freq) % 1.0
            pulse = 1.0 if phase < 0.25 else -1.0
            m_frac = (beat * 4.0) % 1.0
            pulse *= math.exp(-m_frac * 3.0) * 0.35
            
            # Chiptune Arp Harmony (fast 32nd note arpeggio)
            arp_step = int(beat * 8.0) % 3
            harmony_freq = m_freq * [1.0, 1.2599, 1.4983][arp_step]
            h_phase = (t * harmony_freq) % 1.0
            h_pulse = (1.0 if h_phase < 0.5 else -1.0) * 0.18
            
            # Triangle Bass (4-bit stepped triangle)
            b_idx = int(beat) % len(bass_notes)
            b_freq = bass_notes[b_idx]
            b_phase = (t * b_freq) % 1.0
            triangle = (4.0 * abs(b_phase - 0.5) - 1.0)
            # 16-step quantization (authentic NES)
            triangle = round(triangle * 8.0) / 8.0 * 0.4
            
            # Chiptune Noise Percussion
            noise_val = 0.0
            sub_beat = beat % 1.0
            if sub_beat < 0.15: # Noise hit on beat
                noise_val = (random.random() * 2.0 - 1.0) * math.exp(-sub_beat * 30.0) * 0.3
            elif (beat % 0.5) < 0.08: # Hihat tick
                noise_val = (random.random() * 2.0 - 1.0) * math.exp(-((beat % 0.5)) * 60.0) * 0.15
                
            left = pulse * 0.8 + h_pulse * 0.5 + triangle * 0.7 + noise_val * 0.5
            right = pulse * 0.6 + h_pulse * 0.9 + triangle * 0.7 + noise_val * 0.5
            
            fade = 1.0
            if t < 0.3:
                fade = t / 0.3
            elif t > duration_sec - 1.0:
                fade = (duration_sec - t) / 1.0
                
            left_int = int(clamp(left * fade * 0.85) * 32767.0)
            right_int = int(clamp(right * fade * 0.85) * 32767.0)
            
            frames += struct.pack('<hh', left_int, right_int)
            
        wav.writeframes(frames)
    print(f"Generated {filename}")

def generate_chillwave(filename, duration_sec=30.0):
    bpm = 88.0
    beat_dur = 60.0 / bpm
    total_samples = int(duration_sec * SAMPLE_RATE)
    
    # Warm chords: Fmaj7 - Em7 - Dm7 - Cmaj7
    chords = [
        [174.61, 220.00, 261.63, 329.63],
        [164.81, 196.00, 246.94, 293.66],
        [146.83, 174.61, 220.00, 261.63],
        [130.81, 164.81, 196.00, 246.94]
    ]
    
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        
        frames = bytearray()
        
        
        for i in range(total_samples):
            t = i / SAMPLE_RATE
            beat = t / beat_dur
            bar = int(beat // 4)
            chord = chords[bar % len(chords)]
            
            # Warm Rhodes-like Electric Piano (sine + subtle harmonics)
            chord_frac = beat % 2.0
            keys = 0.0
            for note_f in chord:
                w = 2.0 * math.pi * note_f * t
                keys += (math.sin(w) + 0.3 * math.sin(2.0 * w) + 0.1 * math.sin(3.0 * w))
            keys = (keys / len(chord)) * math.exp(-chord_frac * 1.8) * 0.4
            
            # Deep Sub Bass
            root_f = chord[0] / 2.0
            sub_frac = beat % 1.0
            bass = math.sin(2.0 * math.pi * root_f * t) * math.exp(-sub_frac * 1.2) * 0.45
            
            # Soft Vinyl Crackle
            crackle = 0.0
            if random.random() < 0.008:
                crackle = (random.random() * 2.0 - 1.0) * 0.08
                
            # Soft Lo-fi beat
            beat_frac = beat % 1.0
            kick = 0.0
            if beat_frac < 0.2 and int(beat) % 2 == 0:
                kick = math.sin(2.0 * math.pi * 55.0 * beat_frac) * math.exp(-beat_frac * 15.0) * 0.5
            snare = 0.0
            if beat_frac < 0.25 and int(beat) % 2 == 1:
                snare = (random.random() * 2.0 - 1.0) * math.exp(-beat_frac * 18.0) * 0.25
                
            left = keys * 0.8 + bass * 0.8 + kick * 0.7 + snare * 0.6 + crackle
            right = keys * 0.7 + bass * 0.8 + kick * 0.7 + snare * 0.6 + crackle
            
            fade = 1.0
            if t < 0.5:
                fade = t / 0.5
            elif t > duration_sec - 1.0:
                fade = (duration_sec - t) / 1.0
                
            left_int = int(clamp(left * fade * 0.85) * 32767.0)
            right_int = int(clamp(right * fade * 0.85) * 32767.0)
            
            frames += struct.pack('<hh', left_int, right_int)
            
        wav.writeframes(frames)
    print(f"Generated {filename}")

if __name__ == '__main__':
    dest_dir = os.path.join(os.path.dirname(__file__), '..', 'assets', 'demo-tracks')
    os.makedirs(dest_dir, exist_ok=True)
    
    generate_synthwave(os.path.join(dest_dir, '01_Neon_Nights_Synthwave.wav'), 32.0)
    generate_chiptune(os.path.join(dest_dir, '02_8Bit_Odyssey_Chiptune.wav'), 28.0)
    generate_chillwave(os.path.join(dest_dir, '03_Midnight_City_Lofi.wav'), 30.0)
    print("All demo audio tracks generated successfully!")
