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

test('el proyectil viaja, golpea una sola vez y no hace daño a distancia instantáneamente', () => {
  let duel = engine.createDuel({ left: { x: 250 }, right: { x: 650 } });
  let hits = 0;
  for (let i = 0; i < 90; i += 1) {
    const result = engine.stepDuel(duel, { left: { attack: i === 0 ? 'special' : null } });
    duel = result.state;
    if (i < 20) assert.equal(duel.right.health, 100);
    hits += result.events.filter((event) => event.type === 'hit' && event.moveId === 'special').length;
  }
  assert.equal(hits, 1);
  assert.equal(duel.right.health, 79);
  assert.equal(duel.projectiles.length, 0);
});

test('la definitiva exige carga, la consume y lanza un proyectil más potente', () => {
  let duel = engine.createDuel({ left: { x: 250 }, right: { x: 650 } });
  duel = engine.stepDuel(duel, { left: { attack: 'ultimate' } }).state;
  assert.equal(duel.left.attackId, null);
  duel.left.ultimateCharge = 100;
  duel = engine.stepDuel(duel).state;
  duel = engine.stepDuel(duel, { left: { attack: 'ultimate' } }).state;
  assert.equal(duel.left.attackId, 'ultimate');
  assert.equal(duel.left.ultimateCharge, 0);
  const events = [];
  for (let i = 0; i < 90; i += 1) {
    const result = engine.stepDuel(duel);
    duel = result.state;
    events.push(...result.events);
  }
  assert.equal(duel.right.health, 68);
  assert.equal(events.filter((event) => event.type === 'hit' && event.moveId === 'ultimate').length, 1);
});

test('la defensa detiene el proyectil y aplica daño de bloqueo una sola vez', () => {
  let duel = engine.createDuel({ left: { x: 250 }, right: { x: 650 } });
  const events = [];
  for (let i = 0; i < 90; i += 1) {
    const result = engine.stepDuel(duel, { left: { attack: i === 0 ? 'special' : null }, right: { block: true } });
    duel = result.state;
    events.push(...result.events);
  }
  assert.equal(events.filter((event) => event.type === 'blocked').length, 1);
  assert.equal(duel.right.health, 95);
  assert.equal(duel.projectiles.length, 0);
});

test('puño conectado puede encadenarse a patada y después al proyectil', () => {
  const config = configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 12, reach: 220, knockback: 0 } });
  Object.assign(config.moves.medium, { startupFrames: 0, activeFrames: 1, recoveryFrames: 12, reach: 220, knockback: 0 });
  let duel = engine.createDuel({ config, left: { x: 400 }, right: { x: 500 } });
  duel = engine.stepDuel(duel, { left: { attack: 'light' } }).state;
  assert.equal(duel.right.health, 92);
  duel = engine.stepDuel(duel, { left: { attack: 'medium' } }).state;
  assert.equal(duel.left.attackId, 'medium');
  assert.equal(duel.right.health, 82);
  duel = engine.stepDuel(duel, { left: { attack: 'special' } }).state;
  assert.equal(duel.left.attackId, 'special');
});

test('el avance de una cadena ocurre de forma gradual durante cuatro cuadros', () => {
  const config = configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 12, reach: 220, knockback: 0 } });
  let duel = engine.createDuel({ config, left: { x: 300 }, right: { x: 440 } });
  duel = engine.stepDuel(duel, { left: { attack: 'light' } }).state;
  const before = duel.left.x;
  duel = engine.stepDuel(duel, { left: { attack: 'medium' } }).state;
  assert.ok(duel.left.x - before <= 5.01);
  assert.ok(duel.left.attackDriveFrames > 0);
  const steps = duel.left.attackDriveFrames;
  for (let i = 0; i < steps; i += 1) duel = engine.stepDuel(duel).state;
  assert.equal(duel.left.attackDriveFrames, 0);
});

test('un impacto ilumina al defensor durante unos cuadros de simulación', () => {
  const duel = engine.createDuel({
    config: configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 2, reach: 220 } }),
    left: { x: 400 }, right: { x: 500 }
  });
  let result = engine.stepDuel(duel, { left: { attack: 'light' } }).state;
  assert.equal(result.right.impactFlashFrames, 4);
  for (let i = 0; i < 4; i += 1) result = engine.stepDuel(result).state;
  assert.equal(result.right.impactFlashFrames, 0);
});

test('el combo de Luis conecta a distancia mínima incluso si el rival intenta cubrirse', () => {
  let duel = engine.createDuel({ left: { ...globalThis.CenFighterRoster.entries[0], x: 400 }, right: { x: 546 } });
  const hits = [];
  for (let frame = 0; frame < 60; frame += 1) {
    const attack = frame === 0 ? 'light' : frame === 8 ? 'medium' : frame === 18 ? 'special' : null;
    const result = engine.stepDuel(duel, { left: { attack }, right: { block: frame >= 16 } });
    duel = result.state;
    hits.push(...result.events.filter((event) => event.type === 'hit').map((event) => event.moveId));
  }
  assert.deepEqual(hits, ['light', 'medium', 'special']);
});

test('la defensa funciona de pie, agachado y en el aire', () => {
  const config = configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 0, reach: 220 } });
  for (const stance of ['standing', 'crouch', 'air']) {
    let duel = engine.createDuel({ config, left: { x: 400 }, right: { x: 500 } });
    if (stance === 'air') duel = engine.stepDuel(duel, { right: { jump: true } }).state;
    const result = engine.stepDuel(duel, { left: { attack: 'light' }, right: { block: true, crouch: stance === 'crouch' } });
    assert.ok(result.events.some((event) => event.type === 'blocked'), stance);
    assert.equal(result.state.right.guarding, true);
    assert.equal(result.state.right.crouching, stance === 'crouch');
  }
});

test('un golpe fuerte tumba, protege durante la caída y permite levantarse', () => {
  const config = configWith();
  Object.assign(config.moves.heavy, { startupFrames: 0, activeFrames: 1, recoveryFrames: 0, reach: 220 });
  let duel = engine.createDuel({ config, left: { x: 400 }, right: { x: 500 } });
  duel = engine.stepDuel(duel, { left: { attack: 'heavy' } }).state;
  assert.equal(duel.right.knockdownFrames, 30);
  const health = duel.right.health;
  duel = engine.stepDuel(duel, { left: { attack: 'light' }, right: { moveX: 1, jump: true } }).state;
  assert.equal(duel.right.health, health);
  assert.equal(duel.right.grounded, true);
  for (let i = 0; i < 30; i += 1) duel = engine.stepDuel(duel).state;
  assert.equal(duel.right.knockdownFrames, 0);
  duel = engine.stepDuel(duel, { right: { jump: true } }).state;
  assert.equal(duel.right.grounded, false);
});

test('un KO en el aire cae al suelo durante la transición sin mutar el estado anterior', () => {
  const config = configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 0, reach: 220, damage: 100 } });
  let match = teams.createMatch({ config, playerTeam: ['fighter-01', 'fighter-01', 'fighter-01'], cpuTeam: ['fighter-02', 'fighter-02', 'fighter-02'], seed: 7 });
  match.duel.left.x = 400;
  match.duel.right.x = 500;
  match.duel.right.health = 1;
  match.duel.right.grounded = false;
  match.duel.right.y = config.arena.floorY - 25;
  match.duel.right.vy = 0;
  match = teams.stepMatch(match, { player: { attack: 'light' } }).state;
  for (let i = 0; i < 8 && match.phase === 'fight'; i += 1) match = teams.stepMatch(match).state;
  assert.equal(match.phase, 'transition');
  const original = match;
  while (match.phase === 'transition' && !match.duel.right.grounded) match = teams.stepMatch(match).state;
  assert.equal(match.duel.right.y, config.arena.floorY);
  assert.equal(original.duel.right.grounded, false);
});

test('se pueden lanzar puños y patadas en el aire conservando impulso', () => {
  for (const attack of ['light', 'medium']) {
    let duel = engine.createDuel();
    duel = engine.stepDuel(duel, { left: { jump: true, moveX: 1 } }).state;
    const speed = duel.left.vx;
    duel = engine.stepDuel(duel, { left: { attack } }).state;
    assert.equal(duel.left.attackId, attack);
    assert.equal(duel.left.vx, speed);
  }
});

test('un ataque bloqueado mantiene la cobertura durante la recuperación', () => {
  let duel = engine.createDuel({
    config: configWith({ light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 4, reach: 220 } }),
    left: { x: 400 }, right: { x: 500 }
  });
  duel = engine.stepDuel(duel, { left: { attack: 'light' }, right: { block: true } }).state;
  assert.equal(duel.right.blockstunFrames, 6);
  duel = engine.stepDuel(duel, { right: { attack: 'light', attackPulse: true } }).state;
  assert.equal(duel.right.guarding, true);
  assert.equal(duel.right.attackId, null);
  for (let i = 0; i < 6; i += 1) duel = engine.stepDuel(duel).state;
  assert.equal(duel.right.attackId, 'light');
});

test('pulsaciones consecutivas del mismo ataque se guardan durante la recuperación', () => {
  let duel = engine.createDuel();
  duel = engine.stepDuel(duel, { left: { attack: 'light', attackPulse: true } }).state;
  duel = engine.stepDuel(duel, { left: { attack: 'light', attackPulse: true } }).state;
  assert.equal(duel.left.bufferedAttack.id, 'light');
});

test('un nuevo pulso de salto se conserva aunque el salto anterior todavía esté registrado', () => {
  let duel = engine.createDuel();
  duel = engine.stepDuel(duel, { left: { jump: true } }).state;
  duel = engine.stepDuel(duel, { left: { jump: true, jumpPulse: true } }).state;
  assert.ok(duel.left.bufferedJump > 0);
});

test('acepta ataques al agacharse y evita desplazarse agachado', () => {
  let duel = engine.createDuel();
  duel = engine.stepDuel(duel, { left: { moveX: 1 } }).state;
  const beforeCrouch = duel.left.x;
  duel = engine.stepDuel(duel, { left: { crouch: true, moveX: 1 } }).state;
  assert.equal(duel.left.x, beforeCrouch);
  assert.equal(duel.left.vx, 0);
  duel = engine.stepDuel(duel, { left: { crouch: true, attack: 'light' } }).state;
  assert.equal(duel.left.attackId, 'light');
});

test('guarda un ataque y un salto poco antes de aterrizar', () => {
  let duel = engine.createDuel();
  duel = engine.stepDuel(duel, { left: { jump: true } }).state;
  while (duel.left.y < duel.rules.arena.floorY - 20 || duel.left.vy < 0) {
    duel = engine.stepDuel(duel).state;
  }
  duel = engine.stepDuel(duel, { left: { attack: 'light' } }).state;
  for (let i = 0; i < 6 && !duel.left.attackId; i += 1) duel = engine.stepDuel(duel).state;
  assert.equal(duel.left.attackId, 'light');

  duel = engine.createDuel();
  duel = engine.stepDuel(duel, { left: { jump: true } }).state;
  while (duel.left.y < duel.rules.arena.floorY - 20 || duel.left.vy < 0) {
    duel = engine.stepDuel(duel).state;
  }
  duel = engine.stepDuel(duel, { left: { jump: true } }).state;
  for (let i = 0; i < 6 && duel.left.vy >= 0; i += 1) duel = engine.stepDuel(duel).state;
  assert.ok(duel.left.vy < 0);
});

test('un movimiento puede especificar cero cuadros de aturdimiento', () => {
  const duel = engine.createDuel({
    config: configWith({ light: { startupFrames: 0, activeFrames: 1, reach: 220, hitstunFrames: 0 } }),
    left: { x: 400 }, right: { x: 500 }
  });
  const result = engine.stepDuel(duel, { left: { attack: 'light' } });
  assert.ok(result.events.some((event) => event.type === 'hit'));
  assert.equal(result.state.right.hitstunFrames, 0);
});

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
  const impact = events.find((event) => event.type === 'hit');
  assert.ok(Number.isFinite(impact.x) && Number.isFinite(impact.y));
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

test('un equipo con tres Luis trae cada reserva sin pisar IDs o vida', () => {
  const roster = globalThis.CenFighterRoster.entries.map((fighter) => {
    if (fighter.id === 'fighter-02') {
      return {
        ...fighter,
        moves: {
          ...fighter.moves,
          light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 0, damage: 300, reach: 500, knockback: 0 }
        }
      };
    }
    return fighter;
  });
  let match = teams.createMatch({
    roster,
    playerTeam: ['fighter-01', 'fighter-01', 'fighter-01'],
    cpuTeam: ['fighter-02', 'fighter-02', 'fighter-02'],
    seed: 5
  });

  for (let reserveIndex = 1; reserveIndex <= 2; reserveIndex += 1) {
    const previousId = match.active.player;
    const update = teams.stepMatch(match, { cpu: { attack: 'light' } });
    match = update.state;

    assert.ok(update.events.some((event) => event.type === 'team-fighter-eliminated'
      && event.side === 'player' && event.combatantId === previousId));
    assert.equal(match.active.player, `player:fighter-01:${reserveIndex + 1}`);
    assert.equal(match.combatants[match.active.player].health, 100);
    assert.equal(match.combatants[previousId].health, 0);

    while (match.phase === 'transition') match = teams.stepMatch(match).state;
  }
});
