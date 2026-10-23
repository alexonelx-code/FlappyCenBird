(() => {
  'use strict';

  const STORAGE_KEY = 'flappy_muted_v1';
  let muted = false;
  let actx = null;

  try {
    muted = localStorage.getItem(STORAGE_KEY) === 'true';
  } catch (e) {
    // El juego sigue siendo jugable si el navegador bloquea el almacenamiento.
  }

  function audio() {
    if (muted) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        actx = new AC();
      } catch (e) {
        return null;
      }
    }
    if (actx.state === 'suspended') {
      const resumed = actx.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
    }
    return actx;
  }

  function tone(freq, dur, type, vol, to, delay) {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(freq, t0);
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    oscillator.connect(gain);
    gain.connect(ac.destination);
    oscillator.start(t0);
    oscillator.stop(t0 + dur + 0.03);
  }

  const effects = {
    flap()  { tone(560, 0.09, 'sine', 0.07, 780); tone(300, 0.05, 'triangle', 0.025); },
    score() { tone(880, 0.08, 'square', 0.035); tone(1320, 0.12, 'square', 0.028, null, 0.07); },
    hit()   { tone(170, 0.16, 'sawtooth', 0.08, 60); },
    die()   { tone(420, 0.5, 'triangle', 0.06, 80); }
  };

  function toggleMute() {
    muted = !muted;
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch (e) {
      // El estado de silencio sigue funcionando durante esta sesión.
    }
    window.dispatchEvent(new CustomEvent('flappy:mute', { detail: { muted } }));
    return muted;
  }

  window.FlappyAudio = Object.freeze({
    unlock() { audio(); },
    flap: effects.flap,
    score: effects.score,
    hit: effects.hit,
    die: effects.die,
    toggleMute,
    isMuted() { return muted; }
  });
})();
