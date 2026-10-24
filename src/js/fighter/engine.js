((root, factory) => {
  'use strict';

  const config = root.CenFighterConfig || (typeof module === 'object' && module.exports
    ? require('./config.js')
    : null);
  const engine = factory(config);

  root.CenFighterEngine = engine;
  if (typeof module === 'object' && module.exports) module.exports = engine;
})(globalThis, (defaultConfig) => {
  'use strict';

  function assertConfig(config) {
    if (!config || !config.arena || !config.duel || !config.physics || !config.fighter || !config.moves) {
      throw new TypeError('Se necesita una configuración de combate completa.');
    }
    if (!Number.isInteger(config.tickRate) || config.tickRate <= 0) {
      throw new RangeError('tickRate debe ser un entero positivo.');
    }
    if (!Number.isFinite(config.arena.width) || config.arena.width <= 0
        || !Number.isFinite(config.arena.height) || config.arena.height <= 0
        || !Number.isFinite(config.arena.floorY) || config.arena.floorY <= 0
        || !Number.isFinite(config.arena.wallPadding) || config.arena.wallPadding < 0
        || config.arena.floorY > config.arena.height) {
      throw new RangeError('La arena necesita dimensiones y suelo válidos.');
    }
    const fighter = config.fighter;
    if (!Number.isFinite(fighter.width) || fighter.width <= 0
        || !Number.isFinite(fighter.height) || fighter.height <= 0
        || !Number.isFinite(fighter.crouchHeight) || fighter.crouchHeight <= 0 || fighter.crouchHeight > fighter.height
        || !Number.isFinite(fighter.health) || fighter.health <= 0
        || !Number.isFinite(fighter.guardDamageScale) || fighter.guardDamageScale < 0 || fighter.guardDamageScale > 1
        || !Number.isFinite(fighter.guardKnockbackScale) || fighter.guardKnockbackScale < 0 || fighter.guardKnockbackScale > 1
        || !Number.isFinite(fighter.chipDamage) || fighter.chipDamage < 0
        || !Number.isInteger(fighter.hitstunFrames) || fighter.hitstunFrames < 0
        || !Number.isInteger(fighter.inputBufferFrames) || fighter.inputBufferFrames < 0
        || config.arena.width <= config.arena.wallPadding * 2 + fighter.width) {
      throw new RangeError('Los valores base del peleador no son válidos para esta arena.');
    }
    const physics = config.physics;
    if (!Number.isFinite(physics.gravity) || physics.gravity <= 0
        || !Number.isFinite(physics.jumpVelocity) || physics.jumpVelocity <= 0
        || !Number.isFinite(physics.maxFallSpeed) || physics.maxFallSpeed <= 0
        || !Number.isFinite(physics.moveSpeed) || physics.moveSpeed <= 0
        || !Number.isFinite(physics.airSpeed) || physics.airSpeed <= 0
        || !Number.isFinite(physics.groundFriction) || physics.groundFriction < 0 || physics.groundFriction > 1
        || !Number.isFinite(physics.knockbackFriction) || physics.knockbackFriction < 0 || physics.knockbackFriction > 1) {
      throw new RangeError('Los valores de física no son válidos.');
    }
    if (!Number.isFinite(config.duel.durationSeconds) || config.duel.durationSeconds <= 0
        || !Number.isFinite(config.duel.suddenDeathSeconds) || config.duel.suddenDeathSeconds < 0) {
      throw new RangeError('Los límites de tiempo del duelo no son válidos.');
    }
    Object.entries(config.moves).forEach(([id, move]) => {
      if (!move || !Number.isInteger(move.startupFrames) || move.startupFrames < 0
          || !Number.isInteger(move.activeFrames) || move.activeFrames < 1
          || !Number.isInteger(move.recoveryFrames) || move.recoveryFrames < 0
          || !Number.isFinite(move.damage) || move.damage < 0
          || !Number.isFinite(move.reach) || move.reach <= 0
          || !Number.isFinite(move.knockback) || move.knockback < 0
          || (move.hitstunFrames !== undefined && (!Number.isInteger(move.hitstunFrames) || move.hitstunFrames < 0))
          || !Number.isFinite(move.hitboxTop) || !Number.isFinite(move.hitboxBottom)
          || move.hitboxTop < 0 || move.hitboxBottom > 1 || move.hitboxTop >= move.hitboxBottom) {
        throw new RangeError(`El movimiento ${id} tiene datos inválidos.`);
      }
    });
  }

  function freezeDeep(value) {
    Object.values(value).forEach((item) => {
      if (item && typeof item === 'object') freezeDeep(item);
    });
    return Object.freeze(value);
  }

  function copyConfig(config) {
    const copy = JSON.parse(JSON.stringify(config));
    assertConfig(copy);
    return freezeDeep(copy);
  }

  function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function makeFighter(input, side, rules) {
    const width = Math.max(1, finiteOr(input.width, rules.fighter.width));
    const height = Math.max(1, finiteOr(input.height, rules.fighter.height));
    const maxHealth = Math.max(1, Math.floor(finiteOr(input.maxHealth, rules.fighter.health)));
    const defaultX = rules.arena.width * (side === 'left' ? 0.28 : 0.72);
    const x = finiteOr(input.x, defaultX);
    return {
      id: String(input.id || side),
      x: clamp(x, rules.arena.wallPadding + width / 2, rules.arena.width - rules.arena.wallPadding - width / 2),
      y: rules.arena.floorY,
      vx: 0,
      vy: 0,
      facing: side === 'left' ? 1 : -1,
      width,
      height,
      crouchHeight: clamp(finiteOr(input.crouchHeight, rules.fighter.crouchHeight), 1, height),
      health: clamp(Math.floor(finiteOr(input.health, maxHealth)), 0, maxHealth),
      maxHealth,
      grounded: true,
      guarding: false,
      crouching: false,
      attackId: null,
      attackFrame: 0,
      attackConnected: false,
      hitstunFrames: 0,
      bufferedAttack: null,
      previousAttack: null,
      previousJump: false,
      knockedOut: false
    };
  }

  function createDuel(options = {}) {
    const rules = copyConfig(options.config || defaultConfig);
    const left = makeFighter(options.left || {}, 'left', rules);
    const right = makeFighter(options.right || {}, 'right', rules);
    if (left.id === right.id) throw new RangeError('Los peleadores deben tener ID distintos.');

    return {
      version: 1,
      phase: 'fight',
      frame: 0,
      tickRate: rules.tickRate,
      remainingFrames: Math.round(rules.duel.durationSeconds * rules.tickRate),
      suddenDeathRemainingFrames: 0,
      rules,
      left,
      right,
      result: null
    };
  }

  function cloneFighter(fighter) {
    return {
      ...fighter,
      bufferedAttack: fighter.bufferedAttack ? { ...fighter.bufferedAttack } : null
    };
  }

  function cloneDuel(state) {
    return {
      ...state,
      left: cloneFighter(state.left),
      right: cloneFighter(state.right),
      result: state.result ? { ...state.result } : null
    };
  }

  function normalizeInput(input) {
    if (!input || typeof input !== 'object') input = {};
    return {
      moveX: clamp(finiteOr(input.moveX, 0), -1, 1),
      jump: input.jump === true,
      crouch: input.crouch === true,
      block: input.block === true,
      attack: typeof input.attack === 'string' ? input.attack : null
    };
  }

  function startAttack(fighter, moveId) {
    fighter.attackId = moveId;
    fighter.attackFrame = 0;
    fighter.attackConnected = false;
    fighter.bufferedAttack = null;
  }

  function bodyHeight(fighter) {
    return fighter.crouching && fighter.grounded ? fighter.crouchHeight : fighter.height;
  }

  function advanceFighter(fighter, input, rules) {
    const actionPressed = input.attack && input.attack !== fighter.previousAttack;
    const jumpPressed = input.jump && !fighter.previousJump;
    const hadAttack = Boolean(fighter.attackId);
    const wasStunned = fighter.hitstunFrames > 0;

    fighter.previousAttack = input.attack;
    fighter.previousJump = input.jump;
    fighter.guarding = false;
    fighter.crouching = false;

    if (actionPressed && rules.moves[input.attack] && (hadAttack || wasStunned)) {
      fighter.bufferedAttack = { id: input.attack, frames: rules.fighter.inputBufferFrames };
    }

    if (fighter.knockedOut) return;

    if (wasStunned) {
      fighter.hitstunFrames -= 1;
    } else if (!hadAttack && input.block && fighter.grounded) {
      fighter.guarding = true;
      fighter.bufferedAttack = null;
    } else if (!hadAttack && input.crouch && fighter.grounded) {
      fighter.crouching = true;
    } else if (!hadAttack && !input.block && !input.crouch) {
      if (actionPressed && rules.moves[input.attack] && fighter.grounded) {
        startAttack(fighter, input.attack);
      } else if (fighter.bufferedAttack && fighter.bufferedAttack.frames > 0 && fighter.grounded) {
        startAttack(fighter, fighter.bufferedAttack.id);
      }
    }

    const canMove = !fighter.attackId && !wasStunned && !fighter.guarding;
    const moveX = canMove ? input.moveX : 0;
    const speed = fighter.grounded ? rules.physics.moveSpeed : rules.physics.airSpeed;
    if (moveX) {
      fighter.vx = moveX * speed;
    } else {
      const friction = wasStunned ? rules.physics.knockbackFriction : rules.physics.groundFriction;
      fighter.vx *= friction;
      if (Math.abs(fighter.vx) < 1) fighter.vx = 0;
    }

    if (jumpPressed && fighter.grounded && !fighter.attackId && !wasStunned && !fighter.guarding) {
      fighter.grounded = false;
      fighter.vy = -rules.physics.jumpVelocity;
    }

    fighter.vy = Math.min(fighter.vy + rules.physics.gravity / rules.tickRate, rules.physics.maxFallSpeed);
    fighter.x += fighter.vx / rules.tickRate;
    fighter.y += fighter.vy / rules.tickRate;

    const minX = rules.arena.wallPadding + fighter.width / 2;
    const maxX = rules.arena.width - rules.arena.wallPadding - fighter.width / 2;
    fighter.x = clamp(fighter.x, minX, maxX);

    const height = bodyHeight(fighter);
    if (fighter.y - height < 0) {
      fighter.y = height;
      if (fighter.vy < 0) fighter.vy = 0;
    }
    if (fighter.y >= rules.arena.floorY && fighter.vy >= 0) {
      fighter.y = rules.arena.floorY;
      fighter.vy = 0;
      fighter.grounded = true;
    } else {
      fighter.grounded = false;
    }

    if (fighter.bufferedAttack && !actionPressed) {
      fighter.bufferedAttack.frames -= 1;
      if (fighter.bufferedAttack.frames <= 0) fighter.bufferedAttack = null;
    }
  }

  function faceOpponents(left, right) {
    if (left.x < right.x) {
      left.facing = 1;
      right.facing = -1;
    } else if (left.x > right.x) {
      left.facing = -1;
      right.facing = 1;
    }
  }

  function overlaps(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function attackBox(attacker, move) {
    const bodyHeightValue = bodyHeight(attacker);
    const front = attacker.x + attacker.facing * attacker.width / 2;
    const left = attacker.facing > 0 ? front : front - move.reach;
    const right = attacker.facing > 0 ? front + move.reach : front;
    const bodyTop = attacker.y - bodyHeightValue;
    return {
      left,
      right,
      top: bodyTop + bodyHeightValue * move.hitboxTop,
      bottom: bodyTop + bodyHeightValue * move.hitboxBottom
    };
  }

  function hurtBox(defender) {
    const height = bodyHeight(defender);
    return {
      left: defender.x - defender.width / 2,
      right: defender.x + defender.width / 2,
      top: defender.y - height,
      bottom: defender.y
    };
  }

  function canConnect(attacker, defender, rules) {
    if (!attacker.attackId || attacker.attackConnected || attacker.knockedOut) return false;
    const move = rules.moves[attacker.attackId];
    const activeStart = move.startupFrames;
    const activeEnd = activeStart + move.activeFrames;
    if (attacker.attackFrame < activeStart || attacker.attackFrame >= activeEnd) return false;
    return overlaps(attackBox(attacker, move), hurtBox(defender));
  }

  function finishDuel(state, winnerId, loserId, reason, events) {
    state.phase = 'finished';
    state.result = { winnerId, loserId, reason, frame: state.frame };
    events.push({ type: 'duel-finished', ...state.result });
  }

  function resolveStrike(attacker, defender, moveId, rules, events) {
    const move = rules.moves[moveId];
    const blocked = defender.guarding;
    const proposedDamage = blocked
      ? Math.max(rules.fighter.chipDamage, Math.floor(move.damage * rules.fighter.guardDamageScale))
      : move.damage;
    const damage = blocked
      ? Math.min(proposedDamage, Math.max(0, defender.health - 1))
      : Math.min(proposedDamage, defender.health);

    if (attacker.attackId === moveId) attacker.attackConnected = true;
    defender.health = Math.max(0, defender.health - damage);
    defender.vx = attacker.facing * move.knockback * (blocked ? rules.fighter.guardKnockbackScale : 1);
    if (!blocked) {
      defender.hitstunFrames = move.hitstunFrames || rules.fighter.hitstunFrames;
      defender.attackId = null;
      defender.attackFrame = 0;
      defender.attackConnected = false;
      defender.bufferedAttack = null;
    }

    events.push({
      type: blocked ? 'blocked' : 'hit',
      attackerId: attacker.id,
      defenderId: defender.id,
      moveId,
      damage,
      health: defender.health
    });
    if (defender.health <= 0) {
      defender.knockedOut = true;
      defender.attackId = null;
      defender.hitstunFrames = 0;
      events.push({ type: 'ko', fighterId: defender.id });
    }
  }

  function advanceAttackFrames(fighter, rules) {
    if (!fighter.attackId) return;
    const move = rules.moves[fighter.attackId];
    const totalFrames = move.startupFrames + move.activeFrames + move.recoveryFrames;
    if (fighter.attackFrame + 1 >= totalFrames) {
      fighter.attackId = null;
      fighter.attackFrame = 0;
      fighter.attackConnected = false;
    } else {
      fighter.attackFrame += 1;
    }
  }

  function beginSuddenDeath(state, events) {
    state.phase = 'sudden_death';
    state.suddenDeathRemainingFrames = Math.round(state.rules.duel.suddenDeathSeconds * state.tickRate);
    [state.left, state.right].forEach((fighter) => {
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.hitstunFrames = 0;
      fighter.attackId = null;
      fighter.attackFrame = 0;
      fighter.attackConnected = false;
      fighter.bufferedAttack = null;
      fighter.knockedOut = false;
      fighter.grounded = true;
      fighter.y = state.rules.arena.floorY;
    });
    events.push({ type: 'sudden-death-started', frames: state.suddenDeathRemainingFrames });
  }

  function resolveKnockouts(state, events) {
    const leftOut = state.left.health <= 0;
    const rightOut = state.right.health <= 0;
    if (leftOut && rightOut) {
      finishDuel(state, null, null, state.phase === 'sudden_death' ? 'sudden_death_double_ko' : 'double_ko', events);
      return true;
    }
    if (leftOut || rightOut) {
      const loser = leftOut ? state.left : state.right;
      const winner = leftOut ? state.right : state.left;
      finishDuel(state, winner.id, loser.id, state.phase === 'sudden_death' ? 'sudden_death_hit' : 'ko', events);
      return true;
    }
    return false;
  }

  function resolveTimeout(state, events) {
    const leftRatio = state.left.health * state.right.maxHealth;
    const rightRatio = state.right.health * state.left.maxHealth;
    if (leftRatio > rightRatio) {
      finishDuel(state, state.left.id, state.right.id, 'timeout', events);
    } else if (rightRatio > leftRatio) {
      finishDuel(state, state.right.id, state.left.id, 'timeout', events);
    } else {
      beginSuddenDeath(state, events);
    }
  }

  function stepDuel(state, inputs = {}) {
    if (!state || !state.rules || !state.left || !state.right) {
      throw new TypeError('El estado del duelo no es válido.');
    }
    const next = cloneDuel(state);
    const events = [];
    if (next.phase === 'finished') return { state: next, events };

    const rules = next.rules;
    next.frame += 1;
    inputs = inputs && typeof inputs === 'object' ? inputs : {};
    const leftInput = normalizeInput(inputs.left);
    const rightInput = normalizeInput(inputs.right);

    advanceFighter(next.left, leftInput, rules);
    advanceFighter(next.right, rightInput, rules);
    faceOpponents(next.left, next.right);

    const leftHit = canConnect(next.left, next.right, rules);
    const rightHit = canConnect(next.right, next.left, rules);
    const leftMoveId = leftHit ? next.left.attackId : null;
    const rightMoveId = rightHit ? next.right.attackId : null;
    if (leftHit) resolveStrike(next.left, next.right, leftMoveId, rules, events);
    if (rightHit) resolveStrike(next.right, next.left, rightMoveId, rules, events);

    if (next.phase === 'sudden_death' && (leftHit || rightHit) && !next.result) {
      if (leftHit && rightHit) {
        finishDuel(next, null, null, 'sudden_death_double_hit', events);
      } else {
        const winner = leftHit ? next.left : next.right;
        const loser = leftHit ? next.right : next.left;
        finishDuel(next, winner.id, loser.id, 'sudden_death_hit', events);
      }
    } else if (resolveKnockouts(next, events)) {
      return { state: next, events };
    }

    advanceAttackFrames(next.left, rules);
    advanceAttackFrames(next.right, rules);

    if (next.phase === 'fight') {
      next.remainingFrames = Math.max(0, next.remainingFrames - 1);
      if (next.remainingFrames === 0) resolveTimeout(next, events);
    } else if (next.phase === 'sudden_death' && !next.result) {
      next.suddenDeathRemainingFrames = Math.max(0, next.suddenDeathRemainingFrames - 1);
      if (next.suddenDeathRemainingFrames === 0) {
        finishDuel(next, null, null, 'sudden_death_timeout', events);
      }
    }

    return { state: next, events };
  }

  if (!defaultConfig) throw new Error('Carga fighter/config.js antes del motor.');

  return Object.freeze({
    createDuel,
    stepDuel,
    defaultConfig
  });
});
