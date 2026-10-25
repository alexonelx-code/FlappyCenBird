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
      moveSpeed: 330,
      airSpeed: 280,
      groundFriction: 0.76,
      knockbackFriction: 0.88
    },
    fighter: {
      width: 72,
      spacingWidth: 124,
      height: 176,
      crouchHeight: 120,
      health: 100,
      guardDamageScale: 0.25,
      chipDamage: 1,
      guardKnockbackScale: 0.3,
      hitstunFrames: 12,
      inputBufferFrames: 6
    },
    controls: {
      attacks: {
        KeyZ: 'light',
        KeyX: 'medium',
        KeyC: 'heavy',
        KeyV: 'special'
      }
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
      medium: {
        startupFrames: 7,
        activeFrames: 3,
        recoveryFrames: 13,
        damage: 10,
        reach: 88,
        hitboxTop: 0.19,
        hitboxBottom: 0.78,
        hitstunFrames: 15,
        knockback: 220
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
      },
      special: {
        startupFrames: 16,
        activeFrames: 4,
        recoveryFrames: 25,
        damage: 21,
        reach: 126,
        hitboxTop: 0.2,
        hitboxBottom: 0.76,
        hitstunFrames: 25,
        knockback: 340
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
