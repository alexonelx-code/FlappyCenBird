((root, factory) => {
  'use strict';

  const random = root.CenFighterRandom || (typeof module === 'object' && module.exports
    ? require('./random.js')
    : null);
  const api = factory(random);

  root.CenFighterCpu = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, (random) => {
  'use strict';

  const DIFFICULTIES = Object.freeze({
    'muy-facil': Object.freeze({ reactionFrames: 24, guardChance: 0.28, heavyChance: 0.18 }),
    normal: Object.freeze({ reactionFrames: 12, guardChance: 0.62, heavyChance: 0.4 }),
    dificil: Object.freeze({ reactionFrames: 6, guardChance: 0.88, heavyChance: 0.66 })
  });

  const DIFFICULTY_ALIASES = Object.freeze({
    easy: 'muy-facil',
    'very-easy': 'muy-facil',
    difficult: 'dificil',
    hard: 'dificil'
  });

  function normalizeDifficulty(value) {
    const key = String(value || 'normal').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    const difficulty = DIFFICULTY_ALIASES[key] || key;
    if (!DIFFICULTIES[difficulty]) {
      throw new RangeError('La dificultad debe ser muy-facil, normal o dificil.');
    }
    return difficulty;
  }

  function createController(options = {}) {
    const side = options.side || 'right';
    if (side !== 'left' && side !== 'right') {
      throw new RangeError('El lado de la CPU debe ser left o right.');
    }
    return {
      version: 1,
      side,
      difficulty: normalizeDifficulty(options.difficulty),
      frame: 0,
      decisionFramesRemaining: 0,
      rngState: random.normalizeSeed(options.seed === undefined ? 1 : options.seed),
      duelFighters: null,
      intent: { moveX: 0, crouch: false, block: false },
      pulse: { jump: false, attack: null }
    };
  }

  function draw(controller) {
    const result = random.nextRandom(controller.rngState);
    controller.rngState = result.state;
    return result.value;
  }

  function edgeDistance(actor, opponent) {
    return Math.max(0, Math.abs(actor.x - opponent.x) - (actor.width + opponent.width) / 2);
  }

  function isIncomingAttack(actor, opponent, rules, reactionFrames) {
    const move = opponent.attackId && rules.moves[opponent.attackId];
    if (!move || opponent.knockedOut || (actor.x - opponent.x) * opponent.facing <= 0) return false;
    const distance = edgeDistance(actor, opponent);
    const inRange = distance <= move.reach;
    const earlyRead = Math.max(0, move.startupFrames - reactionFrames);
    const attackStillThreatening = opponent.attackFrame >= earlyRead
      && opponent.attackFrame < move.startupFrames + move.activeFrames;
    return inRange && attackStillThreatening;
  }

  function selectAttack(opponent, distance, rules, difficulty, controller) {
    const available = Object.entries(rules.moves)
      .filter(([, move]) => move.reach >= distance)
      .sort((a, b) => a[1].startupFrames - b[1].startupFrames);
    if (!available.length) return null;

    const byName = Object.fromEntries(available);
    const light = byName.light ? ['light', byName.light] : available[0];
    const heavy = byName.heavy ? ['heavy', byName.heavy] : available[available.length - 1];
    const profile = DIFFICULTIES[difficulty];
    const canPunish = opponent.hitstunFrames > heavy[1].startupFrames + 1;
    if (canPunish && draw(controller) < profile.heavyChance) return heavy[0];
    if (opponent.guarding && heavy[1].damage > light[1].damage && draw(controller) < profile.heavyChance) {
      return heavy[0];
    }
    if (light[0] !== heavy[0] && draw(controller) < profile.heavyChance) return heavy[0];
    return light[0];
  }

  function chooseIntent(actor, opponent, duel, controller) {
    const difficulty = controller.difficulty;
    const profile = DIFFICULTIES[difficulty];
    const distance = edgeDistance(actor, opponent);
    const moves = duel.rules.moves;
    const moveIds = Object.keys(moves);
    const light = moves.light || moves[moveIds[0]];
    const heavy = moves.heavy || moves[moveIds[moveIds.length - 1]];
    const preferredReach = light ? light.reach : heavy.reach;
    const moveToward = actor.x < opponent.x ? 1 : -1;

    if (isIncomingAttack(actor, opponent, duel.rules, profile.reactionFrames)
        && actor.grounded && !actor.knockedOut && !actor.attackId && actor.hitstunFrames === 0
        && draw(controller) < profile.guardChance) {
      return {
        intent: { moveX: 0, crouch: false, block: true },
        pulse: { jump: false, attack: null }
      };
    }

    const attackId = selectAttack(opponent, distance, duel.rules, difficulty, controller);
    if (attackId && distance <= moves[attackId].reach && !actor.knockedOut) {
      return {
        intent: { moveX: 0, crouch: false, block: false },
        pulse: { jump: false, attack: attackId }
      };
    }

    let moveX = distance > preferredReach * 0.82 ? moveToward : 0;
    let jump = false;
    let crouch = false;
    if (difficulty === 'muy-facil') {
      if (draw(controller) < 0.16) moveX = -moveToward;
      if (draw(controller) < 0.1) jump = true;
      if (draw(controller) < 0.08) crouch = true;
    } else if (difficulty === 'dificil' && distance > preferredReach * 1.4 && draw(controller) < 0.12) {
      jump = true;
    }

    return {
      intent: { moveX, crouch, block: false },
      pulse: { jump, attack: null }
    };
  }

  function stepController(state, duel) {
    if (!state || !DIFFICULTIES[state.difficulty] || !state.intent || !state.pulse) {
      throw new TypeError('El estado del controlador de CPU no es válido.');
    }
    if (!duel || !duel.left || !duel.right || !duel.rules) {
      throw new TypeError('Se necesita el estado observable de un duelo.');
    }
    const next = {
      ...state,
      frame: state.frame + 1,
      rngState: state.rngState,
      intent: { ...state.intent },
      pulse: { jump: false, attack: null }
    };
    const actor = duel[state.side];
    const opponent = duel[state.side === 'left' ? 'right' : 'left'];
    const profile = DIFFICULTIES[state.difficulty];
    const fighterIds = { actor: actor.id, opponent: opponent.id };
    const newBout = !state.duelFighters
      || state.duelFighters.actor !== fighterIds.actor
      || state.duelFighters.opponent !== fighterIds.opponent;
    if (newBout) {
      next.duelFighters = fighterIds;
      next.decisionFramesRemaining = 0;
      next.intent = { moveX: 0, crouch: false, block: false };
    }
    const canThink = duel.phase !== 'finished' && next.decisionFramesRemaining === 0;

    if (canThink) {
      const choice = chooseIntent(actor, opponent, duel, next);
      next.intent = choice.intent;
      next.pulse = choice.pulse;
      next.decisionFramesRemaining = profile.reactionFrames - 1;
    } else {
      next.decisionFramesRemaining = Math.max(0, next.decisionFramesRemaining - 1);
    }

    const input = duel.phase === 'finished'
      ? { moveX: 0, jump: false, crouch: false, block: false, attack: null }
      : { ...next.intent, ...next.pulse };
    return { state: next, input };
  }

  return Object.freeze({
    DIFFICULTIES,
    createController,
    stepController
  });
});
