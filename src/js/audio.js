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
    flap()  {
      tone(310, 0.11, 'triangle', 0.035, 470);
      tone(620, 0.075, 'sine', 0.018, 800, 0.008);
    },
    score() {
      tone(660, 0.12, 'sine', 0.035, 880);
      tone(990, 0.16, 'sine', 0.025, 1180, 0.055);
      tone(1480, 0.19, 'triangle', 0.015, 1660, 0.105);
    },
    hit()   {
      tone(140, 0.13, 'triangle', 0.055, 70);
      tone(94, 0.09, 'sine', 0.02, 48, 0.015);
    },
    die()   {
      tone(360, 0.38, 'sine', 0.04, 120);
      tone(230, 0.42, 'triangle', 0.025, 78, 0.055);
    }
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
