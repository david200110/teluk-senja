// Teluk Senja — audio.js
// One job: all sound. Original WebAudio synth music (a slow dusk groove in
// A minor) plus procedural SFX. No audio files, no network.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    // A-minor dusk groove: chords (Am, F, C, G) as midi roots, one bar each.
    this.chords = [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C (low voicing)
      [55, 59, 62], // G
    ];
    this.bassLine = [45, 41, 48, 43];
    this.tempo = 92; // bpm, eighth-note steps
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.30;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      return true;
    } catch (_e) { return false; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // One soft synth note: triangle osc + lowpass, quick attack, slow release.
  note(freq, time, dur, type, gain, dest) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = 1400;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(f); f.connect(g); g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  // Schedule one eighth-note step of the groove.
  scheduleStep(step, time) {
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    const chord = this.chords[bar];
    // Pad chord on beat 0 and 4.
    if (beat === 0 || beat === 4) {
      for (const m of chord) this.note(this.midiToFreq(m), time, 1.6, 'triangle', 0.10, this.musicGain);
    }
    // Bass on beats 0, 3, 6.
    if (beat === 0 || beat === 3 || beat === 6) {
      this.note(this.midiToFreq(this.bassLine[bar] - 12), time, 0.5, 'sine', 0.22, this.musicGain);
    }
    // Hat tick on odd eighths.
    if (beat % 2 === 1) {
      const n = this.ctx.createBufferSource();
      const len = Math.floor(this.ctx.sampleRate * 0.03);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      n.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 6000;
      n.connect(hp); hp.connect(g); g.connect(this.musicGain);
      n.start(time);
    }
    // Sparse lead pluck every second bar.
    if (bar % 2 === 1 && beat === 2) {
      const lead = [69, 72, 76, 74][bar];
      this.note(this.midiToFreq(lead), time, 0.4, 'square', 0.035, this.musicGain);
    }
  }

  startMusic() {
    if (!this.ensure() || this.musicTimer) return;
    const stepDur = 60 / this.tempo / 2;
    this.step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.08;
      this.scheduleStep(this.step, t);
      this.step = (this.step + 1) % 32;
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  // --- SFX (all synthesized, no samples) ---
  blip(freq, dur, type = 'square', gain = 0.15) {
    if (!this.ensure()) return;
    this.note(freq, this.ctx.currentTime, dur, type, gain, this.sfxGain);
  }

  punch() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    const len = Math.floor(this.ctx.sampleRate * 0.09);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.8;
    n.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    n.connect(f); f.connect(g); g.connect(this.sfxGain);
    n.start(t);
    this.note(120, t, 0.08, 'sine', 0.3, this.sfxGain);
  }

  pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(990, 0.12), 70); }

  missionComplete() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 110));
  }

  siren() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.linearRampToValueAtTime(950, t + 0.35);
    osc.frequency.linearRampToValueAtTime(700, t + 0.7);
    g.gain.setValueAtTime(0.06, t);
    g.gain.linearRampToValueAtTime(0.001, t + 0.75);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.8);
  }

  engine() {
    if (!this.ensure()) return null;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.value = 0.0;
    osc.connect(f); f.connect(g); g.connect(this.sfxGain);
    osc.start();
    return { osc, gain: g, filter: f };
  }

  setEngineRpm(engine, rpm01, on) {
    if (!engine) return;
    engine.osc.frequency.value = 55 + rpm01 * 130;
    engine.gain.gain.value = on ? 0.05 + rpm01 * 0.06 : 0;
  }

  doorSlam() { this.blip(90, 0.12, 'sine', 0.4); }
  cash() { [880, 1175, 1568].forEach((f, i) => setTimeout(() => this.blip(f, 0.1, 'triangle', 0.18), i * 60)); }
  busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.2), i * 180)); }
  wasted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 'sine', 0.22), i * 200)); }
}
