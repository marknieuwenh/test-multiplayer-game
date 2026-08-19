// Kleine WebAudio sound-engine: alle effecten worden synthetisch opgewekt,
// dus er zijn geen audiobestanden nodig.

let ctx = null;
let master = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Moet vanuit een user-gesture aangeroepen worden (iOS).
export function unlockAudio() { ensureCtx(); }

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export function isMuted() { return muted; }

function env(gainNode, t0, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t0);
  gainNode.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
}

function noiseBuffer() {
  const len = ctx.sampleRate * 0.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
let _noise = null;

function playNoise(peak, decay, freq, q = 1) {
  if (!ensureCtx() || muted) return;
  if (!_noise) _noise = noiseBuffer();
  const src = ctx.createBufferSource();
  src.buffer = _noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = ctx.createGain();
  env(g, ctx.currentTime, peak, decay);
  src.connect(filt).connect(g).connect(master);
  src.start();
  src.stop(ctx.currentTime + decay + 0.05);
}

function playTone(type, f0, f1, peak, decay) {
  if (!ensureCtx() || muted) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  const t0 = ctx.currentTime;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + decay);
  const g = ctx.createGain();
  env(g, t0, peak, decay);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(t0 + decay + 0.05);
}

// -------- motorgeluid --------
// Doorlopende zaagtand-oscillator waarvan toonhoogte en volume met de
// snelheid van de speler meelopen.
let engine = null;

export function updateEngine(rpm01) {
  if (!ctx) return; // pas na eerste user-gesture
  if (!engine) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(filt).connect(g).connect(master);
    osc.start();
    engine = { osc, g, filt };
  }
  const t = ctx.currentTime;
  // setTargetAtTime voorkomt klikken/zipperen
  engine.osc.frequency.setTargetAtTime(55 + rpm01 * 135, t, 0.08);
  engine.filt.frequency.setTargetAtTime(280 + rpm01 * 500, t, 0.1);
  engine.g.gain.setTargetAtTime(rpm01 > 0.02 ? 0.045 + rpm01 * 0.075 : 0, t, 0.1);
}

export const sfx = {
  shoot()     { playTone('square', 660, 180, 0.12, 0.08); },
  rocket()    { playNoise(0.3, 0.5, 2400, 2); playTone('sawtooth', 140, 40, 0.15, 0.5); },
  mine()      { playTone('sine', 300, 120, 0.2, 0.15); },
  explosion() { playNoise(0.6, 0.7, 900, 0.7); playTone('sine', 90, 30, 0.4, 0.5); },
  pickup()    { playTone('sine', 520, 1040, 0.2, 0.18); },
  shield()    { playTone('triangle', 300, 900, 0.22, 0.35); },
  hit()       { playTone('square', 220, 80, 0.18, 0.1); },
  countdown() { playTone('sine', 440, 440, 0.25, 0.12); },
  go()        { playTone('sine', 880, 880, 0.3, 0.3); },
  die()       { playNoise(0.5, 0.6, 600, 1); playTone('sawtooth', 220, 40, 0.25, 0.6); },
};
