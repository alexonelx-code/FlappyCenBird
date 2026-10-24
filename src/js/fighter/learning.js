((root, factory) => {
  'use strict';

  const engine = root.CenFighterEngine || (typeof module === 'object' && module.exports
    ? require('./engine.js')
    : null);
  const cpu = root.CenFighterCpu || (typeof module === 'object' && module.exports
    ? require('./cpu.js')
    : null);
  const random = root.CenFighterRandom || (typeof module === 'object' && module.exports
    ? require('./random.js')
    : null);
  const api = factory(engine, cpu, random);

  root.CenFighterLearning = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, (engine, cpu, random) => {
  'use strict';

  const ACTIONS = Object.freeze(['approach', 'retreat', 'block', 'light', 'heavy', 'jump']);
  const POLICY_PREFIX = 'cengames_fighter_policy_v1:';
  const LEARNING = Object.freeze({ alpha: 0.16, gamma: 0.92, trainingEpisodes: 12, trainingFrames: 240 });
  const EXPLORATION = Object.freeze({ 'muy-facil': 0.42, normal: 0.2, dificil: 0.07 });
  let baseline = null;

  function cloneTable(table) {
    return Object.fromEntries(Object.entries(table).map(([state, values]) => [state, { ...values }]));
  }

  function qValues(table, key) {
    if (!table[key]) table[key] = Object.fromEntries(ACTIONS.map((action) => [action, 0]));
    return table[key];
  }

  function distanceBetween(actor, opponent) {
    return Math.max(0, Math.abs(actor.x - opponent.x) - (actor.width + opponent.width) / 2);
  }

  function observe(duel, side) {
    const actor = duel[side];
    const opponent = duel[side === 'left' ? 'right' : 'left'];
    const distance = distanceBetween(actor, opponent);
    const move = opponent.attackId && duel.rules.moves[opponent.attackId];
    const threat = Boolean(move && distance <= move.reach + 12
      && opponent.attackFrame >= Math.max(0, move.startupFrames - 7)
      && opponent.attackFrame < move.startupFrames + move.activeFrames);
    const healthDelta = actor.health / actor.maxHealth - opponent.health / opponent.maxHealth;
    return {
      actor,
      opponent,
      distance,
      threat,
      key: [distance > 150 ? 'far' : distance > 82 ? 'mid' : 'close', threat ? 'threat' : 'safe',
        healthDelta < -0.18 ? 'behind' : healthDelta > 0.18 ? 'ahead' : 'even',
        actor.hitstunFrames > 0 ? 'stunned' : actor.attackId ? 'busy' : 'free'].join(':'),
      health: { actor: actor.health, opponent: opponent.health }
    };
  }

  function draw(rng) {
    const result = random.nextRandom(rng.state);
    rng.state = result.state;
    return result.value;
  }

  function choose(table, key, epsilon, rng) {
    const values = qValues(table, key);
    if (draw(rng) < epsilon) return ACTIONS[Math.floor(draw(rng) * ACTIONS.length)];
    return ACTIONS.reduce((best, action) => values[action] > values[best] ? action : best, ACTIONS[0]);
  }

  function actionInput(action, actor, opponent, rules) {
    const toward = actor.x < opponent.x ? 1 : -1;
    const distance = distanceBetween(actor, opponent);
    const moveId = action;
    if ((moveId === 'light' || moveId === 'heavy') && rules.moves[moveId]
        && distance <= rules.moves[moveId].reach) {
      return { moveX: 0, crouch: false, block: false, jump: false, attack: moveId };
    }
    if (action === 'block') return { moveX: 0, crouch: false, block: true, jump: false, attack: null };
    if (action === 'retreat') return { moveX: -toward, crouch: false, block: false, jump: false, attack: null };
    if (action === 'jump') return { moveX: distance > 100 ? toward : 0, crouch: false, block: false, jump: true, attack: null };
    return { moveX: toward, crouch: false, block: false, jump: false, attack: null };
  }

  function update(table, stateKey, action, nextKey, reward, terminal = false) {
    if (!stateKey || !action) return;
    const values = qValues(table, stateKey);
    const future = terminal ? 0 : Math.max(...ACTIONS.map((item) => qValues(table, nextKey)[item]));
    values[action] += LEARNING.alpha * (reward + LEARNING.gamma * future - values[action]);
  }

  function transitionReward(previous, current, action) {
    const damageDealt = previous.health.opponent - current.health.opponent;
    const damageTaken = previous.health.actor - current.health.actor;
    const approach = action === 'approach' && current.distance < previous.distance ? 0.025 : 0;
    const guard = action === 'block' && previous.threat && damageTaken <= 1 ? 0.2 : 0;
    return damageDealt * 1.4 - damageTaken * 1.65 + approach + guard - (action === 'jump' ? 0.015 : 0);
  }

  function trainBaseline() {
    const table = {};
    const rng = { state: random.normalizeSeed('cengames-fighter-q-learning-v1') };
    for (let episode = 0; episode < LEARNING.trainingEpisodes; episode += 1) {
      const seed = random.forkSeed(rng.state, `baseline:${episode}`);
      const duel = engine.createDuel({
        left: { id: 'training-learner' },
        right: { id: 'training-cpu' }
      });
      let opponent = cpu.createController({ side: 'right', difficulty: 'normal', seed });
      let previous = null;
      let previousAction = null;
      let activeAction = 'approach';
      for (let frame = 0; frame < LEARNING.trainingFrames && duel.phase !== 'finished'; frame += 1) {
        const state = observe(duel, 'left');
        if (frame % 12 === 0) activeAction = choose(table, state.key, 0.28 - episode * 0.012, rng);
        const playerInput = actionInput(activeAction, state.actor, state.opponent, duel.rules);
        const cpuStep = cpu.stepController(opponent, duel);
        opponent = cpuStep.state;
        const next = engine.stepDuel(duel, { left: playerInput, right: cpuStep.input });
        const nextObservation = observe(next.state, 'left');
        let reward = transitionReward(state, nextObservation, activeAction);
        if (next.state.result) reward += next.state.result.winnerId === 'training-learner' ? 10 : -10;
        if (previous) update(table, previous.key, previousAction, state.key, transitionReward(previous, state, previousAction));
        previous = state;
        previousAction = activeAction;
        Object.assign(duel, next.state);
        if (next.state.result) update(table, state.key, activeAction, null, reward, true);
      }
    }
    return table;
  }

  function getBaseline() {
    if (!baseline) baseline = trainBaseline();
    return baseline;
  }

  function policyKey(profileId) {
    return `${POLICY_PREFIX}${encodeURIComponent(String(profileId || 'invitado'))}`;
  }

  function storageFor(explicit) {
    if (explicit) return explicit;
    if (typeof window === 'undefined') return null;
    try { return window.localStorage || null; } catch (error) { return null; }
  }

  function readPolicy(storage, key) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).slice(0, 200).map(([state, values]) => [state,
        Object.fromEntries(ACTIONS.map((action) => [action,
          Number.isFinite(values && values[action]) ? Math.max(-40, Math.min(40, values[action])) : 0]))]));
    } catch (error) {
      return {};
    }
  }

  function createController(options = {}) {
    const side = options.side || 'right';
    if (side !== 'left' && side !== 'right') throw new RangeError('El lado del aprendizaje debe ser left o right.');
    const seed = random.normalizeSeed(options.seed === undefined ? 1 : options.seed);
    const cpuState = cpu.createController({ side, difficulty: options.difficulty, seed: random.forkSeed(seed, 'reaction') });
    const difficulty = cpuState.difficulty;
    const profileId = String(options.profileId || 'invitado');
    const storage = storageFor(options.storage);
    const key = policyKey(profileId);
    const table = cloneTable(getBaseline());
    Object.entries(readPolicy(storage, key)).forEach(([state, values]) => { table[state] = { ...qValues(table, state), ...values }; });
    return {
      version: 1,
      side,
      difficulty,
      profileId,
      key,
      storage,
      table,
      rng: { state: seed },
      cpu: cpuState,
      intent: { moveX: 0, crouch: false, block: false },
      pulse: { jump: false, attack: null },
      action: 'approach',
      previousObservation: null,
      previousAction: null,
      previousHealth: null,
      completed: false
    };
  }

  function stepController(state, duel) {
    if (!state || !state.table || !state.cpu || !state.intent || !state.pulse) {
      throw new TypeError('El controlador de aprendizaje no es válido.');
    }
    if (!duel || !duel.left || !duel.right || !duel.rules) throw new TypeError('Se necesita el estado observable del duelo.');
    const actor = duel[state.side];
    const opponent = duel[state.side === 'left' ? 'right' : 'left'];
    const previousFighters = state.cpu.duelFighters;
    const newBout = !previousFighters || previousFighters.actor !== actor.id || previousFighters.opponent !== opponent.id;
    const observation = observe(duel, state.side);
    const next = {
      ...state,
      rng: { ...state.rng },
      intent: { ...state.intent },
      pulse: { jump: false, attack: null }
    };
    if (!newBout && state.previousObservation && state.previousAction) {
      update(next.table, state.previousObservation.key, state.previousAction, observation.key,
        transitionReward(state.previousObservation, observation, state.previousAction));
    }

    const decisionReady = state.cpu.decisionFramesRemaining === 0 || newBout;
    const cpuStep = cpu.stepController(state.cpu, duel);
    next.cpu = cpuStep.state;
    if (decisionReady && duel.phase !== 'finished') {
      next.action = choose(next.table, observation.key, EXPLORATION[state.difficulty], next.rng);
      const input = actionInput(next.action, actor, opponent, duel.rules);
      next.intent = { moveX: input.moveX, crouch: input.crouch, block: input.block };
      next.pulse = { jump: input.jump, attack: input.attack };
    }
    next.previousObservation = observation;
    next.previousAction = next.action;
    next.previousHealth = observation.health;
    const input = duel.phase === 'finished'
      ? { moveX: 0, jump: false, crouch: false, block: false, attack: null }
      : { ...next.intent, ...next.pulse };
    return { state: next, input };
  }

  function completeMatch(controller, winnerSide) {
    if (!controller || !controller.table) throw new TypeError('El controlador de aprendizaje no es válido.');
    if (controller.completed) return false;
    const win = winnerSide === (controller.side === 'left' ? 'player' : 'cpu');
    const loss = winnerSide && !win;
    if (controller.previousObservation && controller.previousAction) {
      update(controller.table, controller.previousObservation.key, controller.previousAction, null,
        win ? 12 : loss ? -12 : 0, true);
    }
    controller.completed = true;
    try { controller.storage && controller.storage.setItem(controller.key, JSON.stringify(controller.table)); } catch (error) {}
    return true;
  }

  function resetPolicy(profileId, explicitStorage) {
    const storage = storageFor(explicitStorage);
    if (!storage) return false;
    try { storage.removeItem(policyKey(profileId)); return true; } catch (error) { return false; }
  }

  function inspectPolicy(controller) {
    return cloneTable(controller && controller.table || getBaseline());
  }

  if (!engine || !cpu || !random) throw new Error('Carga el motor, random.js y cpu.js antes de learning.js.');
  return Object.freeze({ ACTIONS, policyKey, createController, stepController, completeMatch, resetPolicy, inspectPolicy });
});
