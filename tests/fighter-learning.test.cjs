const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/js/fighter/config.js');
require('../src/js/fighter/engine.js');
require('../src/js/fighter/random.js');
require('../src/js/fighter/cpu.js');
const teams = require('../src/js/fighter/team-match.js');
const learning = require('../src/js/fighter/learning.js');
const engine = globalThis.CenFighterEngine;

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    values
  };
}

test('la política de combate es reproducible con la misma semilla', () => {
  const first = learning.createController({ difficulty: 'normal', seed: 173 });
  const second = learning.createController({ difficulty: 'normal', seed: 173 });
  let duelA = engine.createDuel();
  let duelB = engine.createDuel();
  for (let frame = 0; frame < 90; frame += 1) {
    const a = learning.stepController(first, duelA);
    const b = learning.stepController(second, duelB);
    assert.deepEqual(a.input, b.input);
    duelA = engine.stepDuel(duelA, { right: a.input }).state;
    duelB = engine.stepDuel(duelB, { right: b.input }).state;
    assert.deepEqual(duelA.right, duelB.right);
  }
});

test('guarda aprendizaje por perfil solo al cerrar un combate y permite reiniciarlo', () => {
  const storage = memoryStorage();
  const controller = learning.createController({ profileId: 'perfil-a', seed: 29, storage });
  assert.equal(storage.getItem(learning.policyKey('perfil-a')), null);
  learning.completeMatch(controller, 'cpu');
  const saved = storage.getItem(learning.policyKey('perfil-a'));
  assert.ok(saved);
  assert.equal(learning.completeMatch(controller, 'cpu'), false);
  assert.equal(storage.getItem(learning.policyKey('perfil-a')), saved);

  const restored = learning.createController({ profileId: 'perfil-a', seed: 29, storage });
  assert.deepEqual(learning.inspectPolicy(restored), learning.inspectPolicy(controller));
  assert.equal(learning.resetPolicy('perfil-a', storage), true);
  assert.equal(storage.getItem(learning.policyKey('perfil-a')), null);
});

test('el controlador aprendido termina un match de equipos sin entradas inválidas', () => {
  let match = teams.createMatch({
    playerTeam: ['fighter-01', 'fighter-02', 'fighter-03'],
    cpuTeam: ['fighter-04', 'fighter-05', 'fighter-06'],
    seed: 733
  });
  let controller = learning.createController({ difficulty: 'normal', seed: match.cpuSeed });
  let frames = 0;

  while (match.phase !== 'finished' && frames < 15_000) {
    let cpuInput = {};
    if (match.phase === 'fight') {
      const decision = learning.stepController(controller, match.duel);
      controller = decision.state;
      cpuInput = decision.input;
    }
    match = teams.stepMatch(match, { player: {}, cpu: cpuInput }).state;
    frames += 1;
  }

  assert.equal(match.phase, 'finished');
  assert.ok(match.result);
  assert.ok(match.bouts.length >= 1 && match.bouts.length <= 5);
  assert.equal(learning.completeMatch(controller, match.result.winnerSide), true);
});
