// Procedural arcade SFX via Web Audio API — no audio files needed.
// All sounds are synthesized: square/sawtooth oscillators + amplitude envelopes,
// plus filtered noise for hits. Lazy-inits on first user interaction so browser
// autoplay policy doesn't block us.

(() => {
  const PRY = window.PRY;

  let actx = null;
  let masterGain = null;
  let muted = false;

  function ensureContext() {
    if (actx) return actx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      actx = new Ctx();
      masterGain = actx.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(actx.destination);
    } catch (_) { actx = null; }
    return actx;
  }

  // resume in case context was created suspended (Safari/iOS)
  function resumeIfSuspended() {
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  }

  function tone(freq, when, dur, type = 'square', vol = 1.0) {
    if (!actx || muted) return;
    const t0 = actx.currentTime + when;
    const osc = actx.createOscillator();
    const env = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(env); env.connect(masterGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function slide(freqFrom, freqTo, when, dur, type = 'sawtooth', vol = 1.0) {
    if (!actx || muted) return;
    const t0 = actx.currentTime + when;
    const osc = actx.createOscillator();
    const env = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqTo), t0 + dur);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(env); env.connect(masterGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(when, dur, vol = 0.6) {
    if (!actx || muted) return;
    const sr = actx.sampleRate;
    const len = Math.max(32, Math.floor(sr * dur));
    const buf = actx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const env = actx.createGain();
    const t0 = actx.currentTime + when;
    env.gain.setValueAtTime(vol, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(env); env.connect(masterGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // Equal-temperament reference (Hz)
  const N = {
    C3: 130.81, E3: 164.81, G3: 196.00, A3: 220.00,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50, E6: 1318.51, G6: 1567.98,
  };

  const SFX = {
    // The headline sound — ascending arpeggio, classic NES power-up.
    pickup_powerup() {
      tone(N.C5, 0.00, 0.07);
      tone(N.E5, 0.06, 0.07);
      tone(N.G5, 0.12, 0.07);
      tone(N.C6, 0.18, 0.14, 'square', 1.2);
    },
    // Soft cursor / mode-transition blip
    click() {
      tone(N.A5, 0, 0.05, 'square', 0.4);
    },
    mode_switch() {
      tone(N.E5, 0.00, 0.05, 'square', 0.5);
      tone(N.G5, 0.05, 0.10, 'square', 0.5);
    },
    // Sword landing
    hit_enemy() {
      slide(N.G5, N.C5, 0, 0.10, 'square', 0.6);
      noiseBurst(0.00, 0.05, 0.3);
    },
    // You take a hit
    hit_player() {
      slide(N.A4, N.A3, 0, 0.15, 'sawtooth', 0.7);
      noiseBurst(0.02, 0.10, 0.35);
    },
    enemy_defeat() {
      tone(N.C5, 0.00, 0.06);
      slide(N.G4, N.C3, 0.06, 0.50, 'sawtooth', 0.8);
    },
    victory() {
      tone(N.C5, 0.00, 0.10);
      tone(N.E5, 0.10, 0.10);
      tone(N.G5, 0.20, 0.10);
      tone(N.C6, 0.30, 0.30, 'square', 1.2);
    },
    defeat() {
      tone(N.C5, 0.00, 0.15);
      tone(N.G4, 0.15, 0.15);
      tone(N.E4, 0.30, 0.15);
      tone(N.C4, 0.45, 0.50, 'sawtooth', 0.8);
    },
    shield_up() {
      tone(N.E5, 0.00, 0.06, 'triangle', 0.6);
      tone(N.B5, 0.06, 0.16, 'triangle', 0.6);
    },
  };

  PRY.SOUNDS = {
    play(name) {
      ensureContext();
      resumeIfSuspended();
      try { SFX[name]?.(); } catch (_) {}
    },
    init: ensureContext,
    setMuted(v) { muted = !!v; },
    toggleMuted() { muted = !muted; return muted; },
    isMuted() { return muted; },
  };
})();
