const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../src/js/fighter/engine.js');
require('../src/js/fighter/random.js');
require('../src/js/fighter/sprite-contract.js');
require('../src/js/fighter/roster.js');
const teams = require('../src/js/fighter/team-match.js');

function configWith(overrides = {}) {
  const config = JSON.parse(JSON.stringify(engine.defaultConfig));
  Object.assign(config.duel, overrides.duel || {});
  Object.assign(config.fighter, overrides.fighter || {});
  Object.assign(config.moves.light, overrides.light || {});
  return config;
}

test('el duelo es determinista y cada impacto activo se aplica una sola vez', () => {
  const config = configWith({ light: { startupFrames: 2, activeFrames: 3, recoveryFrames: 4, reach: 220 } });
  const options = {
    config,
    left: { id: 'left', x: 400 },
    right: { id: 'right', x: 500 }
  };
  let first = engine.createDuel(options);
  let second = engine.createDuel(options);
  const original = first;
  const events = [];

  for (let frame = 0; frame < 10; frame += 1) {
    const inputs = { left: { attack: frame === 0 ? 'light' : null } };
    const leftStep = engine.stepDuel(first, inputs);
    const rightStep = engine.stepDuel(second, inputs);
    first = leftStep.state;
    second = rightStep.state;
    events.push(...leftStep.events);
    assert.deepEqual(first, second);
  }

  assert.strictEqual(original.left.health, 100);
  assert.equal(events.filter((event) => event.type === 'hit').length, 1);
  assert.equal(first.right.health, 92);
});

test('mantiene separados los cuerpos según el ancho visible del arte sin cambiar las hurtboxes', () => {
  const state = engine.createDuel({
    left: { id: 'luis', x: 430, spacingWidth: 144 },
    right: { id: 'rival', x: 530, spacingWidth: 124 }
  });
  let duel = engine.stepDuel(state).state;
  const minimumDistance = (duel.left.spacingWidth + duel.right.spacingWidth) / 2;

  for (let frame = 0; frame < 90; frame += 1) {
    duel = engine.stepDuel(duel, { left: { moveX: 1 }, right: { moveX: -1 } }).state;
    assert.ok(duel.right.x - duel.left.x >= minimumDistance - 1e-9);
  }
  assert.equal(duel.left.width, 72);
  assert.equal(duel.right.width, 72);
  assert.equal(duel.left.facing, 1);
  assert.equal(duel.right.facing, -1);
});

test('el bloqueo recibe chip damage pero nunca elimina al peleador', () => {
  const state = engine.createDuel({
    config: configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 1, damage: 100, reach: 220 } }),
    left: { id: 'attacker', x: 400 },
    right: { id: 'guard', x: 500, health: 10, stats: { chipDamage: 5, guardDamageScale: 1 } }
  });
  const result = engine.stepDuel(state, {
    left: { attack: 'light' },
    right: { block: true }
  });

  assert.equal(result.state.right.health, 1);
  assert.equal(result.state.right.knockedOut, false);
  assert.ok(result.events.some((event) => event.type === 'blocked' && event.damage === 9));
});

test('el KO termina el duelo y conserva al ganador como resultado', () => {
  const state = engine.createDuel({
    config: configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 0, damage: 100, reach: 220 } }),
    left: { id: 'winner', x: 400 },
    right: { id: 'loser', x: 500 }
  });
  const result = engine.stepDuel(state, { left: { attack: 'light' } });

  assert.equal(result.state.phase, 'finished');
  assert.deepEqual(result.state.result, {
    winnerId: 'winner', loserId: 'loser', reason: 'ko', frame: 1
  });
  assert.ok(result.events.some((event) => event.type === 'ko' && event.fighterId === 'loser'));
});

test('el tiempo resuelve por porcentaje de vida y un empate termina tras muerte súbita', () => {
  const config = configWith({ duel: { durationSeconds: 1, suddenDeathSeconds: 1 } });
  let ahead = engine.createDuel({ config, left: { id: 'ahead', health: 80 }, right: { id: 'behind', health: 50 } });
  for (let frame = 0; frame < config.tickRate; frame += 1) ahead = engine.stepDuel(ahead).state;
  assert.equal(ahead.result.winnerId, 'ahead');
  assert.equal(ahead.result.reason, 'timeout');

  let tied = engine.createDuel({ config, left: { id: 'one' }, right: { id: 'two' } });
  for (let frame = 0; frame < config.tickRate; frame += 1) tied = engine.stepDuel(tied).state;
  assert.equal(tied.phase, 'sudden_death');
  for (let frame = 0; frame < config.tickRate; frame += 1) tied = engine.stepDuel(tied).state;
  assert.deepEqual(tied.result, {
    winnerId: null, loserId: null, reason: 'sudden_death_timeout', frame: config.tickRate * 2
  });
});

test('el match 3v3 conserva la vida del superviviente, repone reservas y concluye', () => {
  const roster = globalThis.CenFighterRoster.entries.map((fighter) => {
    const isPlayer = ['fighter-01', 'fighter-02', 'fighter-03'].includes(fighter.id);
    return {
      ...fighter,
      moves: {
        light: {
          startupFrames: 0,
          activeFrames: 1,
          recoveryFrames: 0,
          damage: isPlayer ? 300 : 10,
          reach: 500,
          knockback: 0
        }
      }
    };
  });
  let match = teams.createMatch({
    roster,
    playerTeam: ['fighter-01', 'fighter-02', 'fighter-03'],
    cpuTeam: ['fighter-04', 'fighter-05', 'fighter-06'],
    seed: 77
  });
  const entered = [];
  let frames = 0;

  while (match.phase !== 'finished' && frames < 1_000) {
    const attack = match.phase === 'fight' && match.duel.frame === 0 ? { attack: 'light' } : {};
    const update = teams.stepMatch(match, { player: attack, cpu: attack });
    match = update.state;
    entered.push(...update.events
      .filter((event) => event.type === 'team-fighter-entered')
      .map((event) => ({
        ...event,
        health: match.combatants[event.combatantId].health,
        maxHealth: match.combatants[event.combatantId].maxHealth
      })));
    frames += 1;
  }

  assert.equal(match.phase, 'finished');
  assert.equal(match.result.winnerSide, 'player');
  assert.equal(match.bouts.length, 3);
  assert.equal(match.combatants['player:fighter-01'].health, 70);
  assert.equal(match.teams.cpu.eliminated.length, 3);
  assert.equal(entered.filter((event) => event.side === 'cpu').length, 2);
  assert.ok(entered.filter((event) => event.side === 'cpu')
    .every((event) => event.health === event.maxHealth));
});
