(() => {
  'use strict';

  function createProfile(config, random = Math.random) {
    const profile = [];
    let start = 0;
    while (start < config.rampPoints) {
      const remaining = config.rampPoints - start;
      const longestPhase = Math.min(config.phaseMaxPoints, remaining - config.phaseMinPoints);
      const length = remaining <= config.phaseMaxPoints
        ? remaining
        : config.phaseMinPoints + Math.floor(random() * (longestPhase - config.phaseMinPoints + 1));
      const end = start + length;
      const offset = (random() * 2 - 1) * config.variation;
      profile.push(Object.freeze({ start, end, offset }));
      start = end;
    }
    return Object.freeze(profile);
  }

  function speedAt(score, profile, config) {
    const points = Math.max(0, Math.floor(Number(score) || 0));
    if (points >= config.rampPoints) return config.maxSpeed;

    const progress = points / config.rampPoints;
    const baseline = config.initialSpeed + (config.maxSpeed - config.initialSpeed) * progress;
    const phase = profile.find(({ start, end }) => points >= start && points < end);
    const fadeIn = Math.min(points / config.variationFadePoints, 1);
    const fadeOut = Math.min((config.rampPoints - points) / config.variationFadePoints, 1);
    const target = baseline + (phase ? phase.offset : 0) * fadeIn * fadeOut;
    return Math.max(config.initialSpeed, Math.min(config.maxSpeed, target));
  }

  window.FlappyPace = Object.freeze({ createProfile, speedAt });
})();
