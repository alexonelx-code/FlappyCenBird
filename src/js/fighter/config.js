(() => {
  'use strict';

  const config = {
    tickRate: 60,
    arena: {
      width: 960,
      height: 540,
      floorY: 472,
      wallPadding: 24
    },
    duel: {
      durationSeconds: 40,
      suddenDeathSeconds: 5
    },
    physics: {
      gravity: 1800,
      jumpVelocity: 680,
      maxFallSpeed: 1050,
      moveSpeed: 250,
      airSpeed: 210,
      groundFriction: 0.76,
      knockbackFriction: 0.88
    },
    fighter: {
      width: 64,
      height: 116,
      crouchHeight: 76,
      health: 100,
      guardDamageScale: 0.25,
      chipDamage: 1,
      guardKnockbackScale: 0.3,
      hitstunFrames: 12,
      inputBufferFrames: 6
    },
    moves: {
      light: {
        startupFrames: 5,
        activeFrames: 3,
        recoveryFrames: 10,
        damage: 8,
        reach: 78,
        hitboxTop: 0.22,
        hitboxBottom: 0.78,
        hitstunFrames: 12,
        knockback: 180
      },
      heavy: {
        startupFrames: 11,
        activeFrames: 4,
        recoveryFrames: 18,
        damage: 14,
        reach: 100,
        hitboxTop: 0.16,
        hitboxBottom: 0.76,
        hitstunFrames: 20,
        knockback: 280
      }
    }
  };

  function freezeDeep(value) {
    Object.values(value).forEach((item) => {
      if (item && typeof item === 'object') freezeDeep(item);
    });
    return Object.freeze(value);
  }

  const frozenConfig = freezeDeep(config);
  globalThis.CenFighterConfig = frozenConfig;

  if (typeof module === 'object' && module.exports) module.exports = frozenConfig;
})();
