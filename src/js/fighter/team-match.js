((root, factory) => {
  'use strict';

  const engine = root.CenFighterEngine || (typeof module === 'object' && module.exports
    ? require('./engine.js')
    : null);
  const random = root.CenFighterRandom || (typeof module === 'object' && module.exports
    ? require('./random.js')
    : null);
  const rosterCatalog = root.CenFighterRoster || null;
  const artContract = root.CenFighterArtContract || null;
  const api = factory(engine, random, rosterCatalog, artContract);

  root.CenFighterTeams = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, (engine, random, rosterCatalog, artContract) => {
  'use strict';

  const TEAM_SIZE = 3;
  const ROSTER_SIZE = 10;
  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeDeep);
    return Object.freeze(value);
  }

  const DEFAULT_ROSTER = rosterCatalog && rosterCatalog.entries || Object.freeze(Array.from({ length: 10 }, (_, index) => Object.freeze({
    id: `fighter-${String(index + 1).padStart(2, '0')}`,
    name: `Peleador ${String(index + 1).padStart(2, '0')}`
  })));

  function normalizeRoster(roster, config) {
    if (!Array.isArray(roster) || roster.length !== ROSTER_SIZE) {
      throw new TypeError(`El catálogo debe tener exactamente ${ROSTER_SIZE} peleadores.`);
    }
    const entries = roster.map((entry) => {
      const source = typeof entry === 'string' ? { id: entry } : entry;
      if (!source || typeof source !== 'object' || !source.id) {
        throw new TypeError('Cada peleador del catálogo necesita un ID.');
      }
      const definition = engine.validateFighterDefinition(source, config);
      if (source.palette !== undefined && (!source.palette || typeof source.palette !== 'object'
          || ['accent', 'shadow', 'skin'].some((key) => typeof source.palette[key] !== 'string'
            || !/^#[0-9a-f]{6}$/i.test(source.palette[key])))) {
        throw new RangeError(`La paleta de ${source.id} debe usar tres colores hexadecimales.`);
      }
      const normalized = {
        id: String(source.id).trim(),
        name: String(source.name || source.id),
        archetype: String(source.archetype || 'Peleador'),
        stats: definition.stats,
        moves: definition.moves,
        width: definition.stats.width,
        height: definition.stats.height,
        crouchHeight: definition.stats.crouchHeight,
        maxHealth: definition.stats.health,
        palette: source.palette ? { ...source.palette } : null,
        sprite: source.sprite ? JSON.parse(JSON.stringify(source.sprite)) : null
      };
      if (normalized.sprite && artContract) artContract.validate(normalized.sprite);
      if (!normalized.id) throw new TypeError('Cada peleador del catálogo necesita un ID.');
      return normalized;
    });
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
      throw new RangeError('Los IDs del catálogo deben ser únicos.');
    }
    return entries;
  }

  function normalizeTeam(team, rosterById, label) {
    if (!Array.isArray(team) || team.length !== TEAM_SIZE) {
      throw new RangeError(`${label} debe tener exactamente ${TEAM_SIZE} peleadores.`);
    }
    const ids = team.map((entry) => String(typeof entry === 'string' ? entry : entry && entry.id));
    if (ids.some((id) => !rosterById.has(id))) {
      throw new RangeError(`${label} contiene un peleador que no existe en el catálogo.`);
    }
    if (new Set(ids).size !== TEAM_SIZE) {
      throw new RangeError(`${label} no puede repetir peleadores.`);
    }
    return ids;
  }

  function chooseCpuTeam(roster, seed) {
    const entries = roster.map((entry) => entry.id);
    let rngState = random.normalizeSeed(random.forkSeed(seed, 'cpu-team'));
    for (let index = entries.length - 1; index > 0; index -= 1) {
      const result = random.nextRandom(rngState);
      rngState = result.state;
      const swapIndex = Math.floor(result.value * (index + 1));
      [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
    }
    return { team: entries.slice(0, TEAM_SIZE), rngState };
  }

  function makeCombatant(definition, side, config) {
    const fighter = config.fighter;
    return {
      id: `${side}:${definition.id}`,
      characterId: definition.id,
      name: definition.name,
      archetype: definition.archetype,
      palette: definition.palette ? freezeDeep({ ...definition.palette }) : null,
      sprite: definition.sprite ? freezeDeep(JSON.parse(JSON.stringify(definition.sprite))) : null,
      stats: freezeDeep({ ...definition.stats }),
      moves: freezeDeep(Object.fromEntries(Object.entries(definition.moves).map(([id, move]) => [id, { ...move }]))),
      width: definition.width || fighter.width,
      height: definition.height || fighter.height,
      crouchHeight: definition.crouchHeight || fighter.crouchHeight,
      maxHealth: definition.maxHealth || fighter.health,
      health: definition.maxHealth || fighter.health
    };
  }

  function makeTeam(characterIds, side, rosterById, config) {
    const combatants = characterIds.map((id) => makeCombatant(rosterById.get(id), side, config));
    return {
      characterIds: characterIds.slice(),
      combatantIds: combatants.map((fighter) => fighter.id),
      nextIndex: 1,
      eliminated: []
    };
  }

  function duelFighter(combatant) {
    return {
      id: combatant.id,
      characterId: combatant.characterId,
      name: combatant.name,
      archetype: combatant.archetype,
      palette: combatant.palette,
      sprite: combatant.sprite,
      x: undefined,
      width: combatant.width,
      height: combatant.height,
      crouchHeight: combatant.crouchHeight,
      stats: combatant.stats,
      moves: combatant.moves,
      maxHealth: combatant.maxHealth,
      health: combatant.health
    };
  }

  function buildDuel(match) {
    const center = match.config.arena.width / 2;
    const openingGap = Math.min(270, match.config.arena.width * 0.3);
    return engine.createDuel({
      config: match.config,
      left: { ...duelFighter(match.combatants[match.active.player]), x: center - openingGap / 2 },
      right: { ...duelFighter(match.combatants[match.active.cpu]), x: center + openingGap / 2 }
    });
  }

  function createMatch(options = {}) {
    if (!engine || !random) throw new Error('Carga el motor y random.js antes del coordinador de equipos.');
    const seed = random.normalizeSeed(options.seed === undefined ? 1 : options.seed);
    const config = JSON.parse(JSON.stringify(options.config || engine.defaultConfig));
    const roster = normalizeRoster(options.roster || DEFAULT_ROSTER, config);
    const rosterById = new Map(roster.map((entry) => [entry.id, entry]));
    const playerIds = normalizeTeam(options.playerTeam, rosterById, 'El equipo del jugador');
    const cpuSelection = options.cpuTeam
      ? { team: normalizeTeam(options.cpuTeam, rosterById, 'El equipo de la CPU'), rngState: null }
      : chooseCpuTeam(roster, seed);
    const cpuIds = cpuSelection.team;
    const playerTeam = makeTeam(playerIds, 'player', rosterById, config);
    const cpuTeam = makeTeam(cpuIds, 'cpu', rosterById, config);
    const combatants = {};
    playerTeam.combatantIds.forEach((id, index) => {
      combatants[id] = makeCombatant(rosterById.get(playerIds[index]), 'player', config);
    });
    cpuTeam.combatantIds.forEach((id, index) => {
      combatants[id] = makeCombatant(rosterById.get(cpuIds[index]), 'cpu', config);
    });

    const match = {
      version: 1,
      phase: 'fight',
      frame: 0,
      seed,
      cpuSeed: random.forkSeed(seed, 'cpu-policy'),
      config,
      teamSize: TEAM_SIZE,
      transitionFrames: config.tickRate,
      boutNumber: 1,
      teams: { player: playerTeam, cpu: cpuTeam },
      active: { player: playerTeam.combatantIds[0], cpu: cpuTeam.combatantIds[0] },
      combatants,
      duel: null,
      transitionRemainingFrames: 0,
      bouts: [],
      result: null
    };
    match.duel = buildDuel(match);
    match.config = match.duel.rules;
    return match;
  }

  function cloneTeam(team) {
    return {
      characterIds: team.characterIds.slice(),
      combatantIds: team.combatantIds.slice(),
      nextIndex: team.nextIndex,
      eliminated: team.eliminated.slice()
    };
  }

  function cloneMatch(match) {
    const combatants = {};
    Object.entries(match.combatants).forEach(([id, fighter]) => {
      combatants[id] = { ...fighter };
    });
    return {
      ...match,
      teams: { player: cloneTeam(match.teams.player), cpu: cloneTeam(match.teams.cpu) },
      active: { ...match.active },
      combatants,
      bouts: match.bouts.map((bout) => ({ ...bout, health: { ...bout.health } })),
      result: match.result ? { ...match.result } : null
    };
  }

  function teamRemaining(team) {
    return team.combatantIds.length - team.eliminated.length;
  }

  function eliminate(match, side, reason, events) {
    const combatantId = match.active[side];
    if (!combatantId) return;
    const team = match.teams[side];
    team.eliminated.push(combatantId);
    match.combatants[combatantId].health = 0;
    match.active[side] = null;
    events.push({
      type: 'team-fighter-eliminated',
      side,
      fighterId: match.combatants[combatantId].characterId,
      combatantId,
      reason
    });
  }

  function bringInReserve(match, side, events) {
    const team = match.teams[side];
    if (team.nextIndex >= team.combatantIds.length) return;
    const combatantId = team.combatantIds[team.nextIndex];
    team.nextIndex += 1;
    match.active[side] = combatantId;
    const fighter = match.combatants[combatantId];
    fighter.health = fighter.maxHealth;
    events.push({
      type: 'team-fighter-entered',
      side,
      fighterId: fighter.characterId,
      combatantId,
      reserveIndex: team.nextIndex - 1
    });
  }

  function recordSurvivor(match, side) {
    const fighter = match.duel[side === 'player' ? 'left' : 'right'];
    match.combatants[match.active[side]].health = fighter.health;
  }

  function concludeMatch(match, reason, events) {
    const playerRemaining = teamRemaining(match.teams.player);
    const cpuRemaining = teamRemaining(match.teams.cpu);
    match.phase = 'finished';
    match.transitionRemainingFrames = 0;
    match.result = {
      winnerSide: playerRemaining > 0 && cpuRemaining === 0
        ? 'player'
        : cpuRemaining > 0 && playerRemaining === 0
          ? 'cpu'
          : null,
      reason,
      remaining: { player: playerRemaining, cpu: cpuRemaining },
      bouts: match.bouts.length,
      frame: match.frame
    };
    events.push({ type: 'team-match-finished', ...match.result });
  }

  function processFinishedDuel(match, events) {
    const duelResult = match.duel.result;
    if (!duelResult) return;
    const playerId = match.active.player;
    const cpuId = match.active.cpu;
    const playerFighterId = match.combatants[playerId].characterId;
    const cpuFighterId = match.combatants[cpuId].characterId;
    let winnerSide = null;
    if (duelResult.winnerId === playerId) winnerSide = 'player';
    if (duelResult.winnerId === cpuId) winnerSide = 'cpu';

    if (winnerSide) {
      const loserSide = winnerSide === 'player' ? 'cpu' : 'player';
      recordSurvivor(match, winnerSide);
      eliminate(match, loserSide, duelResult.reason, events);
    } else {
      eliminate(match, 'player', duelResult.reason, events);
      eliminate(match, 'cpu', duelResult.reason, events);
    }

    match.bouts.push({
      number: match.boutNumber,
      reason: duelResult.reason,
      winnerSide,
      playerFighterId,
      cpuFighterId,
      health: {
        player: match.duel.left.health,
        cpu: match.duel.right.health
      },
      duelFrame: match.duel.frame
    });
    events.push({
      type: 'team-bout-finished',
      number: match.boutNumber,
      winnerSide,
      reason: duelResult.reason,
      playerFighterId,
      cpuFighterId
    });

    const playerRemaining = teamRemaining(match.teams.player);
    const cpuRemaining = teamRemaining(match.teams.cpu);
    if (playerRemaining === 0 || cpuRemaining === 0) {
      concludeMatch(match, playerRemaining === 0 && cpuRemaining === 0 ? 'double_elimination' : 'team_elimination', events);
      return;
    }

    if (!match.active.player) bringInReserve(match, 'player', events);
    if (!match.active.cpu) bringInReserve(match, 'cpu', events);
    match.phase = 'transition';
    match.transitionRemainingFrames = match.transitionFrames;
    events.push({
      type: 'team-transition-started',
      frames: match.transitionRemainingFrames,
      nextBout: match.boutNumber + 1
    });
  }

  function stepMatch(state, inputs = {}) {
    if (!state || !state.teams || !state.duel || !state.combatants) {
      throw new TypeError('El estado de la partida por equipos no es válido.');
    }
    if (state.phase === 'finished') return { state: cloneMatch(state), events: [] };
    const next = cloneMatch(state);
    const events = [];
    next.frame += 1;

    if (next.phase === 'transition') {
      next.transitionRemainingFrames = Math.max(0, next.transitionRemainingFrames - 1);
      if (next.transitionRemainingFrames === 0) {
        next.boutNumber += 1;
        next.duel = buildDuel(next);
        next.phase = 'fight';
        events.push({
          type: 'team-bout-started',
          number: next.boutNumber,
          playerFighterId: next.combatants[next.active.player].characterId,
          cpuFighterId: next.combatants[next.active.cpu].characterId
        });
      }
      return { state: next, events };
    }

    const duelStep = engine.stepDuel(next.duel, {
      left: inputs && inputs.player,
      right: inputs && inputs.cpu
    });
    next.duel = duelStep.state;
    events.push(...duelStep.events);
    if (next.duel.phase === 'finished') processFinishedDuel(next, events);
    return { state: next, events };
  }

  return Object.freeze({
    TEAM_SIZE,
    ROSTER_SIZE,
    DEFAULT_ROSTER,
    createMatch,
    stepMatch
  });
});
