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
        || (fighter.spacingWidth !== undefined && (!Number.isFinite(fighter.spacingWidth) || fighter.spacingWidth <= 0))
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
    Object.entries(config.moves).forEach(([id, move]) => assertMove(move, id));
  }

  function assertMove(move, id) {
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

  function makeStats(input, rules) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('La definición del peleador debe ser un objeto.');
    }
    const source = input.stats === undefined ? {} : input.stats;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new TypeError('Las estadísticas del peleador deben ser un objeto.');
    }
    const statKeys = new Set(['width', 'height', 'crouchHeight', 'health', 'groundSpeed', 'airSpeed', 'jumpVelocity',
      'guardDamageScale', 'chipDamage', 'guardKnockbackScale', 'hitstunFrames', 'inputBufferFrames']);
    if (Object.keys(source).some((key) => !statKeys.has(key))) throw new RangeError('Hay una estadística de peleador desconocida.');
    const directKeys = ['width', 'height', 'crouchHeight', 'maxHealth', 'moveSpeed', 'airSpeed', 'jumpVelocity',
      'guardDamageScale', 'chipDamage', 'guardKnockbackScale', 'hitstunFrames', 'inputBufferFrames', 'spacingWidth'];
    if (directKeys.some((key) => input[key] !== undefined && !Number.isFinite(input[key]))) {
      throw new RangeError('Las estadísticas directas del peleador deben ser números finitos.');
    }
    const value = (key, direct, fallback) => source[key] === undefined
      ? finiteOr(input[direct], fallback)
      : source[key];
    const stats = {
      width: value('width', 'width', rules.fighter.width),
      height: value('height', 'height', rules.fighter.height),
      crouchHeight: value('crouchHeight', 'crouchHeight', rules.fighter.crouchHeight),
      health: value('health', 'maxHealth', rules.fighter.health),
      groundSpeed: value('groundSpeed', 'moveSpeed', rules.physics.moveSpeed),
      airSpeed: value('airSpeed', 'airSpeed', rules.physics.airSpeed),
      jumpVelocity: value('jumpVelocity', 'jumpVelocity', rules.physics.jumpVelocity),
      guardDamageScale: value('guardDamageScale', 'guardDamageScale', rules.fighter.guardDamageScale),
      chipDamage: value('chipDamage', 'chipDamage', rules.fighter.chipDamage),
      guardKnockbackScale: value('guardKnockbackScale', 'guardKnockbackScale', rules.fighter.guardKnockbackScale),
      hitstunFrames: value('hitstunFrames', 'hitstunFrames', rules.fighter.hitstunFrames),
      inputBufferFrames: value('inputBufferFrames', 'inputBufferFrames', rules.fighter.inputBufferFrames)
    };
    if (Object.values(stats).some((item) => !Number.isFinite(item))
        || stats.width <= 0 || stats.width > rules.arena.width - rules.arena.wallPadding * 2
        || stats.height <= 0 || stats.crouchHeight <= 0 || stats.crouchHeight > stats.height
        || !Number.isInteger(stats.health) || stats.health <= 0
        || stats.groundSpeed <= 0 || stats.airSpeed <= 0 || stats.jumpVelocity <= 0
        || stats.guardDamageScale < 0 || stats.guardDamageScale > 1
        || stats.chipDamage < 0
        || stats.guardKnockbackScale < 0 || stats.guardKnockbackScale > 1
        || !Number.isInteger(stats.hitstunFrames) || stats.hitstunFrames < 0
        || !Number.isInteger(stats.inputBufferFrames) || stats.inputBufferFrames < 0) {
      throw new RangeError('Las estadísticas individuales del peleador no son válidas.');
    }
    return stats;
  }

  function makeMoveSet(input, rules) {
    const overrides = input.moves === undefined ? {} : input.moves;
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
      throw new TypeError('Los movimientos del peleador deben ser un objeto.');
    }
    const moves = JSON.parse(JSON.stringify(rules.moves));
    const moveKeys = new Set(['startupFrames', 'activeFrames', 'recoveryFrames', 'damage', 'reach', 'knockback',
      'hitstunFrames', 'hitboxTop', 'hitboxBottom']);
    Object.entries(overrides).forEach(([id, values]) => {
      if (!moves[id] || !values || typeof values !== 'object' || Array.isArray(values)) {
        throw new RangeError(`El movimiento ${id} no está disponible para este peleador.`);
      }
      if (Object.keys(values).some((key) => !moveKeys.has(key))) throw new RangeError(`El movimiento ${id} tiene un atributo desconocido.`);
      moves[id] = { ...moves[id], ...values };
      assertMove(moves[id], id);
    });
    return moves;
  }

  function makeFighter(input, side, rules) {
    const stats = makeStats(input, rules);
    const moves = makeMoveSet(input, rules);
    const width = stats.width;
    const height = stats.height;
    const spacingWidth = Math.max(width, finiteOr(input.spacingWidth, finiteOr(rules.fighter.spacingWidth, width)));
    const maxHealth = stats.health;
    if (rules.arena.width <= rules.arena.wallPadding * 2 + width) {
      throw new RangeError('El ancho del peleador no cabe en la arena.');
    }
    if (spacingWidth <= 0 || spacingWidth > rules.arena.width - rules.arena.wallPadding * 2) {
      throw new RangeError('El espacio visual del peleador no cabe en la arena.');
    }
    const defaultX = rules.arena.width * (side === 'left' ? 0.28 : 0.72);
    const x = finiteOr(input.x, defaultX);
    return {
      id: String(input.id || side),
      characterId: String(input.characterId || input.id || side),
      name: String(input.name || input.characterId || input.id || side),
      archetype: String(input.archetype || 'Peleador'),
      palette: input.palette ? freezeDeep({ ...input.palette }) : null,
      sprite: input.sprite ? freezeDeep(JSON.parse(JSON.stringify(input.sprite))) : null,
      x: clamp(x, rules.arena.wallPadding + spacingWidth / 2,
        rules.arena.width - rules.arena.wallPadding - spacingWidth / 2),
      y: rules.arena.floorY,
      vx: 0,
      vy: 0,
      facing: side === 'left' ? 1 : -1,
      width,
      spacingWidth,
      height,
      crouchHeight: stats.crouchHeight,
      stats: freezeDeep(stats),
      moves: freezeDeep(moves),
      health: clamp(Math.floor(finiteOr(input.health, maxHealth)), 0, maxHealth),
      ultimateCharge: 0,
      maxHealth,
      grounded: true,
      airFrames: 0,
      landingFrames: 0,
      guarding: false,
      crouching: false,
      attackId: null,
      attackFrame: 0,
      attackConnected: false,
      attackDriveFrames: 0,
      attackDriveSpeed: 0,
      projectileSpawned: false,
      hitstunFrames: 0,
      blockstunFrames: 0,
      impactFlashFrames: 0,
      knockdownFrames: 0,
      bufferedAttack: null,
      bufferedJump: 0,
      previousAttack: null,
      previousJump: false,
      knockedOut: false
    };
  }

  function validateFighterDefinition(input = {}, config = defaultConfig) {
    const fighter = makeFighter(input, 'left', copyConfig(config || defaultConfig));
    return {
      stats: { ...fighter.stats },
      moves: Object.fromEntries(Object.entries(fighter.moves).map(([id, move]) => [id, { ...move }])),
      spacingWidth: fighter.spacingWidth
    };
  }

  function moveFor(fighter, moveId, rules) {
    return fighter && fighter.moves && fighter.moves[moveId] || rules.moves[moveId];
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
      projectiles: [],
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
      projectiles: (state.projectiles || []).map((projectile) => ({ ...projectile })),
      result: state.result ? { ...state.result } : null
    };
  }

  function normalizeInput(input) {
    if (!input || typeof input !== 'object') input = {};
    return {
      moveX: clamp(finiteOr(input.moveX, 0), -1, 1),
      jump: input.jump === true,
      jumpPulse: input.jumpPulse === true,
      crouch: input.crouch === true,
      block: input.block === true,
      attack: typeof input.attack === 'string' ? input.attack : null,
      attackPulse: input.attackPulse === true
    };
  }

  function startAttack(fighter, moveId) {
    if (moveId === 'ultimate') {
      if (fighter.ultimateCharge < 100) return false;
      fighter.ultimateCharge = 0;
    }
    fighter.attackId = moveId;
    fighter.attackFrame = 0;
    fighter.attackConnected = false;
    fighter.attackDriveFrames = fighter.grounded && (moveId === 'light' || moveId === 'medium') ? 4 : 0;
    fighter.attackDriveSpeed = moveId === 'light' ? 0.8 : moveId === 'medium' ? 1.5 : 0;
    fighter.projectileSpawned = false;
    fighter.bufferedAttack = null;
    return true;
  }

  function bodyHeight(fighter) {
    return fighter.crouching && fighter.grounded ? fighter.crouchHeight : fighter.height;
  }

  function advanceFighter(fighter, input, rules) {
    const actionPressed = input.attack && (input.attackPulse || input.attack !== fighter.previousAttack);
    const jumpPressed = input.jump && (input.jumpPulse || !fighter.previousJump);
    const hadAttack = Boolean(fighter.attackId);
    const wasStunned = fighter.hitstunFrames > 0;
    const wasBlocking = fighter.blockstunFrames > 0;
    const wasGrounded = fighter.grounded;

    fighter.previousAttack = input.attack;
    fighter.previousJump = input.jump;
    fighter.guarding = false;
    fighter.crouching = false;

    if (actionPressed && fighter.moves[input.attack] && (hadAttack || wasStunned || wasBlocking || !fighter.grounded)) {
      fighter.bufferedAttack = { id: input.attack, frames: fighter.stats.inputBufferFrames };
    }
    if (jumpPressed) fighter.bufferedJump = fighter.stats.inputBufferFrames;

    if (hadAttack && fighter.attackConnected && fighter.bufferedAttack && fighter.grounded) {
      const current = fighter.moves[fighter.attackId];
      const nextMove = fighter.bufferedAttack.id;
      const chain = (fighter.attackId === 'light' && nextMove === 'medium')
        || (fighter.attackId === 'medium' && nextMove === 'special');
      if (chain && fighter.attackFrame >= current.startupFrames + current.activeFrames) {
        startAttack(fighter, nextMove);
        if (nextMove === 'medium') fighter.attackDriveSpeed = 5;
        if (nextMove === 'special') fighter.attackFrame = fighter.moves.special.startupFrames;
      }
    }

    if (fighter.knockedOut) return;
    if (fighter.landingFrames > 0) fighter.landingFrames -= 1;
    if (fighter.impactFlashFrames > 0) fighter.impactFlashFrames -= 1;

    if (wasStunned) {
      fighter.hitstunFrames -= 1;
      if (fighter.knockdownFrames > 0) fighter.knockdownFrames -= 1;
    } else if (wasBlocking) {
      fighter.blockstunFrames -= 1;
      fighter.guarding = true;
      fighter.crouching = input.crouch && fighter.grounded;
    } else if (!hadAttack && input.block) {
      fighter.guarding = true;
      fighter.crouching = input.crouch && fighter.grounded;
      fighter.bufferedAttack = null;
    } else if (!hadAttack && !input.block) {
      if (actionPressed && fighter.moves[input.attack] && (input.attack !== 'ultimate' || fighter.ultimateCharge >= 100)
          && (fighter.grounded || input.attack === 'light' || input.attack === 'medium')) {
        startAttack(fighter, input.attack);
      } else if (fighter.bufferedAttack && fighter.bufferedAttack.frames > 0 && fighter.grounded
          && (fighter.bufferedAttack.id !== 'ultimate' || fighter.ultimateCharge >= 100)) {
        startAttack(fighter, fighter.bufferedAttack.id);
      } else if (input.crouch && fighter.grounded) {
        fighter.crouching = true;
      }
    }

    const canMove = !fighter.attackId && !wasStunned && !fighter.guarding && !fighter.crouching;
    const moveX = canMove ? input.moveX : 0;
    const speed = fighter.grounded ? fighter.stats.groundSpeed : fighter.stats.airSpeed;
    if (!fighter.grounded && !wasStunned) {
      if (moveX) {
        const target = moveX * speed;
        const adjustment = speed * 0.16;
        fighter.vx += clamp(target - fighter.vx, -adjustment, adjustment);
      } else {
        fighter.vx *= 0.99;
      }
    } else if (moveX) {
      fighter.vx = moveX * speed;
    } else if (fighter.crouching && !wasStunned && !wasBlocking) {
      fighter.vx = 0;
    } else {
      const friction = wasStunned ? rules.physics.knockbackFriction
        : !fighter.grounded && fighter.attackId ? 1 : rules.physics.groundFriction;
      fighter.vx *= friction;
      if (Math.abs(fighter.vx) < 1) fighter.vx = 0;
    }

    if ((jumpPressed || fighter.bufferedJump > 0) && fighter.grounded && !fighter.attackId && !wasStunned && !fighter.guarding && !fighter.crouching) {
      fighter.grounded = false;
      fighter.vy = -fighter.stats.jumpVelocity;
      fighter.bufferedJump = 0;
      fighter.landingFrames = 0;
      fighter.airFrames = 0;
    }

    fighter.vy = Math.min(fighter.vy + rules.physics.gravity / rules.tickRate, rules.physics.maxFallSpeed);
    fighter.x += fighter.vx / rules.tickRate;
    if (fighter.attackId && fighter.attackDriveFrames > 0 && fighter.grounded && !wasStunned) {
      fighter.x += fighter.facing * fighter.attackDriveSpeed;
      fighter.attackDriveFrames -= 1;
    }
    fighter.y += fighter.vy / rules.tickRate;

    const minX = rules.arena.wallPadding + fighter.spacingWidth / 2;
    const maxX = rules.arena.width - rules.arena.wallPadding - fighter.spacingWidth / 2;
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
      if (!wasGrounded && fighter.airFrames > 0) fighter.landingFrames = 4;
      fighter.airFrames = 0;
    } else {
      fighter.grounded = false;
      fighter.airFrames += 1;
    }

    if (fighter.bufferedAttack && !actionPressed) {
      fighter.bufferedAttack.frames -= 1;
      if (fighter.bufferedAttack.frames <= 0) fighter.bufferedAttack = null;
    }
    if (fighter.bufferedJump > 0 && !jumpPressed) fighter.bufferedJump -= 1;
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

  function separateFighters(left, right, rules) {
    const delta = right.x - left.x;
    const distance = Math.abs(delta);
    const minimumDistance = (left.spacingWidth + right.spacingWidth) / 2;
    if (distance >= minimumDistance) return;

    const leftmost = delta < 0 ? right : left;
    const rightmost = delta < 0 ? left : right;
    const centerMin = rules.arena.wallPadding + leftmost.spacingWidth / 2 + minimumDistance / 2;
    const centerMax = rules.arena.width - rules.arena.wallPadding - rightmost.spacingWidth / 2 - minimumDistance / 2;
    const center = clamp((left.x + right.x) / 2, centerMin, centerMax);
    leftmost.x = center - minimumDistance / 2;
    rightmost.x = center + minimumDistance / 2;
    if (leftmost.vx > 0) leftmost.vx = 0;
    if (rightmost.vx < 0) rightmost.vx = 0;
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
    if (!attacker.attackId || ['special', 'ultimate'].includes(attacker.attackId) || attacker.attackConnected || attacker.knockedOut || defender.knockdownFrames > 0) return false;
    const move = attacker.moves[attacker.attackId];
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

  function resolveStrike(attacker, defender, moveId, rules, events, projectile = null) {
    const move = attacker.moves[moveId];
    const blocked = defender.guarding;
    const proposedDamage = blocked
      ? Math.max(defender.stats.chipDamage, Math.floor(move.damage * defender.stats.guardDamageScale))
      : move.damage;
    const damage = blocked
      ? Math.min(proposedDamage, Math.max(0, defender.health - 1))
      : Math.min(proposedDamage, defender.health);
    const targetBox = hurtBox(defender);
    const sourceBox = projectile
      ? { left: projectile.x - 12, right: projectile.x + 12, top: projectile.y - 12, bottom: projectile.y + 12 }
      : attackBox(attacker, move);
    const impactX = (Math.max(sourceBox.left, targetBox.left) + Math.min(sourceBox.right, targetBox.right)) / 2;
    const impactY = (Math.max(sourceBox.top, targetBox.top) + Math.min(sourceBox.bottom, targetBox.bottom)) / 2;

    if (!projectile && attacker.attackId === moveId) attacker.attackConnected = true;
    defender.health = Math.max(0, defender.health - damage);
    defender.impactFlashFrames = blocked ? 2 : 4;
    attacker.ultimateCharge = Math.min(100, attacker.ultimateCharge + (blocked ? 5 : 25));
    defender.ultimateCharge = Math.min(100, defender.ultimateCharge + (blocked ? 3 : 12));
    defender.vx = (projectile ? projectile.direction : attacker.facing) * move.knockback * (blocked ? defender.stats.guardKnockbackScale : 1);
    if (!blocked) {
      defender.hitstunFrames = move.hitstunFrames ?? defender.stats.hitstunFrames;
      defender.attackId = null;
      defender.attackDriveFrames = 0;
      defender.attackFrame = 0;
      defender.attackConnected = false;
      defender.bufferedAttack = null;
      defender.bufferedJump = 0;
      defender.blockstunFrames = 0;
      defender.knockdownFrames = (moveId === 'heavy' || moveId === 'ultimate') && defender.grounded ? 30 : 0;
      if (defender.knockdownFrames) defender.hitstunFrames = Math.max(defender.hitstunFrames, defender.knockdownFrames);
    } else {
      defender.blockstunFrames = 6;
    }

    events.push({
      type: blocked ? 'blocked' : 'hit',
      attackerId: attacker.id,
      defenderId: defender.id,
      moveId,
      damage,
      x: impactX,
      y: impactY,
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
    const move = fighter.moves[fighter.attackId];
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
      fighter.impactFlashFrames = 0;
      fighter.blockstunFrames = 0;
      fighter.knockdownFrames = 0;
      fighter.attackId = null;
      fighter.attackFrame = 0;
      fighter.attackConnected = false;
      fighter.bufferedAttack = null;
      fighter.bufferedJump = 0;
      fighter.knockedOut = false;
      fighter.grounded = true;
      fighter.airFrames = 0;
      fighter.landingFrames = 0;
      fighter.y = state.rules.arena.floorY;
    });
    state.projectiles = [];
    events.push({ type: 'sudden-death-started', frames: state.suddenDeathRemainingFrames });
  }

  function advanceProjectiles(state, events) {
    const fighters = [state.left, state.right];
    for (const fighter of fighters) {
      const moveId = fighter.attackId;
      const move = fighter.moves[moveId];
      if ((moveId === 'special' || moveId === 'ultimate') && !fighter.projectileSpawned && fighter.attackFrame >= move.startupFrames) {
        fighter.projectileSpawned = true;
        state.projectiles.push({ ownerId: fighter.id, moveId, direction: fighter.facing,
          x: fighter.x + fighter.facing * fighter.width / 2, y: fighter.y - fighter.height * 0.3 });
      }
    }
    const hits = new Set();
    state.projectiles = state.projectiles.filter((projectile) => {
      const owner = fighters.find((fighter) => fighter.id === projectile.ownerId);
      const target = owner === state.left ? state.right : state.left;
      const previousX = projectile.x;
      projectile.x += projectile.direction * (projectile.moveId === 'ultimate' ? 700 : 540) / state.tickRate;
      const radius = projectile.moveId === 'ultimate' ? 20 : 12;
      const box = { left: Math.min(previousX, projectile.x) - radius, right: Math.max(previousX, projectile.x) + radius,
        top: projectile.y - radius, bottom: projectile.y + radius };
      if (!target.knockedOut && !target.knockdownFrames && overlaps(box, hurtBox(target))) {
        resolveStrike(owner, target, projectile.moveId, state.rules, events, projectile);
        hits.add(owner.id);
        return false;
      }
      return projectile.x >= -20 && projectile.x <= state.rules.arena.width + 20;
    });
    return hits;
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
    separateFighters(next.left, next.right, rules);
    faceOpponents(next.left, next.right);

    const leftHit = canConnect(next.left, next.right, rules);
    const rightHit = canConnect(next.right, next.left, rules);
    const leftMoveId = leftHit ? next.left.attackId : null;
    const rightMoveId = rightHit ? next.right.attackId : null;
    if (leftHit) resolveStrike(next.left, next.right, leftMoveId, rules, events);
    if (rightHit) resolveStrike(next.right, next.left, rightMoveId, rules, events);
    const projectileHits = advanceProjectiles(next, events);
    const leftConnected = leftHit || projectileHits.has(next.left.id);
    const rightConnected = rightHit || projectileHits.has(next.right.id);

    if (next.phase === 'sudden_death' && (leftConnected || rightConnected) && !next.result) {
      if (leftConnected && rightConnected) {
        finishDuel(next, null, null, 'sudden_death_double_hit', events);
      } else {
        const winner = leftConnected ? next.left : next.right;
        const loser = leftConnected ? next.right : next.left;
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
    validateFighterDefinition,
    moveFor,
    defaultConfig
  });
});
