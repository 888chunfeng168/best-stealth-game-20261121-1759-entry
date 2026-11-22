// Nightshade — Silent Infiltration
// audio.js — every sound is synthesised with WebAudio: no audio files.
// Footsteps (soft ticks, louder when walking than sneaking), a rising
// alarm sting, a pickup blip, a level-clear chime and a low ambient drone.
// The context is created on the first user gesture, so it never blocks load.

import { FOOTSTEP_STRIDE_WALK, FOOTSTEP_STRIDE_SNEAK } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.drone = null;
    this._stepPhase = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this._startDrone();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _startDrone() {
    // A very quiet low hum, so the silence itself feels like a place.
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    lfo.start();
    this.drone = { osc, lfo };
  }

  _noiseBurst(duration, filterFreq, volume) {
    if (!this.ctx || this.muted) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  _tone(freq0, freq1, duration, type, volume, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // Call every frame with distance moved; a tick sounds each stride.
  footstep(distanceMoved, sneaking) {
    if (!this.ctx || this.muted || distanceMoved <= 0) return;
    this._stepPhase += distanceMoved;
    const stride = sneaking ? FOOTSTEP_STRIDE_SNEAK : FOOTSTEP_STRIDE_WALK;
    if (this._stepPhase >= stride) {
      this._stepPhase -= stride;
      this._noiseBurst(0.05, sneaking ? 500 : 900, sneaking ? 0.05 : 0.16);
    }
  }

  // A guard's step: a duller tick, panned by how far away it is.
  guardStep(distanceToPlayer) {
    if (!this.ctx || this.muted) return;
    const vol = Math.max(0, 0.22 * (1 - distanceToPlayer / 320));
    if (vol <= 0.01) return;
    this._noiseBurst(0.06, 420, vol);
  }

  alert() {
    // Two-note rising sting: the moment the alarm goes up.
    this._tone(220, 440, 0.16, 'sawtooth', 0.16);
    this._tone(330, 660, 0.22, 'sawtooth', 0.14, 0.12);
  }

  suspicious() {
    // A single questioning blip when a guard starts to wonder.
    this._tone(520, 640, 0.12, 'triangle', 0.12);
  }

  pickup() {
    this._tone(880, 1320, 0.14, 'sine', 0.18);
    this._tone(1320, 1760, 0.12, 'sine', 0.1, 0.08);
  }

  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, f, 0.22, 'sine', 0.16, i * 0.11));
  }

  exitOpen() {
    // The last core is in: a bright two-note chime says the exit is open.
    this._tone(784, 784, 0.16, 'sine', 0.16);
    this._tone(1175, 1175, 0.24, 'sine', 0.16, 0.12);
  }

  caught() {
    this._tone(330, 55, 0.6, 'sawtooth', 0.2);
  }

  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, f, 0.3, 'triangle', 0.16, i * 0.13));
  }
}
