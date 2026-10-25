const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/js/fighter/config.js');
require('../src/js/fighter/engine.js');
require('../src/js/fighter/random.js');
require('../src/js/fighter/sprite-contract.js');
require('../src/js/fighter/roster.js');
const teams = require('../src/js/fighter/team-match.js');
const engine = globalThis.CenFighterEngine;
const roster = globalThis.CenFighterRoster;
const art = globalThis.CenFighterArtContract;
const config = globalThis.CenFighterConfig;

function spriteDefinition() {
  const animations = Object.fromEntries(art.ANIMATIONS.map((name) => [name, {
    frames: [0, 1], fps: 8, loop: name !== 'ko'
  }]));
  return {
    src: 'assets/fighters/sample.png',
    frameWidth: 96,
    frameHeight: 112,
    anchor: { x: 48, y: 108 },
    animations,
    hitboxes: {
      body: { x: -22, y: -102, width: 44, height: 102 },
      light: { x: 4, y: -77, width: 68, height: 36 },
      medium: { x: 2, y: -78, width: 80, height: 40 },
      heavy: { x: 3, y: -84, width: 96, height: 48 },
      special: { x: 1, y: -88, width: 116, height: 54 }
    }
  };
}

test('el catálogo tiene diez luchadores distintos con arquetipos y estadísticas propias', () => {
  assert.deepEqual(config.controls.attacks, {
    KeyZ: 'light', KeyX: 'medium', KeyC: 'heavy', KeyV: 'special'
  });
  assert.equal(roster.entries.length, 10);
  assert.equal(new Set(roster.entries.map((fighter) => fighter.id)).size, 10);
  assert.ok(new Set(roster.entries.map((fighter) => fighter.archetype)).size >= 6);
  assert.equal(teams.DEFAULT_ROSTER.length, 10);

  const match = teams.createMatch({
    playerTeam: ['fighter-01', 'fighter-02', 'fighter-04'],
    cpuTeam: ['fighter-03', 'fighter-08', 'fighter-10'],
    seed: 40
  });
  assert.equal(match.combatants[match.active.player].name, 'Luis');
  assert.equal(roster.entries[0].portraitSrc, 'assets/fighters/characters/luis-original.jpg');
  assert.equal(roster.entries[0].sprite.visualScale, 0.82);
  assert.deepEqual(roster.entries[0].sprite.anchor, { x: 114.5, y: 229 });
  assert.deepEqual(roster.entries[0].sprite.frameFootAnchors, { 24: 221, 25: 221, 26: 225, 28: 221, 29: 221 });
  assert.deepEqual(roster.entries[0].sprite.frameDrawBounds[25], { x: 52, y: 19, width: 157, height: 203 });
  assert.equal(roster.entries[0].spacingWidth, 168);
  assert.equal(match.duel.left.stats.health, 100);
  assert.equal(match.duel.right.stats.guardDamageScale, 0.22);
  assert.equal(match.duel.left.moves.light.damage, 8);
  assert.equal(match.duel.left.moves.medium.damage, 10);
  assert.equal(match.duel.left.moves.heavy.damage, 14);
  assert.equal(match.duel.left.moves.special.damage, 21);
  assert.equal(match.duel.right.moves.light.reach, 82);
  assert.notEqual(match.duel.left.stats.groundSpeed, match.duel.right.stats.groundSpeed);

  let duel = engine.createDuel({
    left: { id: 'reach-test', x: 300, moves: { light: { startupFrames: 0, activeFrames: 1, recoveryFrames: 1, damage: 7, reach: 180, knockback: 0 } } },
    right: { id: 'target-test', x: 480 }
  });
  const strike = engine.stepDuel(duel, { left: { attack: 'light' } });
  assert.equal(strike.state.right.health, 93);
  assert.equal(strike.events.some((event) => event.type === 'hit' && event.damage === 7), true);
});

test('permite tres Luis con reservas independientes y IDs de combate únicos', () => {
  const match = teams.createMatch({
    playerTeam: ['fighter-01', 'fighter-01', 'fighter-01'],
    cpuTeam: ['fighter-02', 'fighter-02', 'fighter-02'],
    seed: 24
  });
  const playerIds = match.teams.player.combatantIds;
  const cpuIds = match.teams.cpu.combatantIds;

  assert.deepEqual(match.teams.player.characterIds, ['fighter-01', 'fighter-01', 'fighter-01']);
  assert.equal(new Set([...playerIds, ...cpuIds]).size, 6);
  assert.deepEqual(playerIds, ['player:fighter-01', 'player:fighter-01:2', 'player:fighter-01:3']);
  assert.notStrictEqual(match.combatants[playerIds[0]], match.combatants[playerIds[1]]);
  assert.equal(match.combatants[playerIds[0]].health, 100);
  assert.equal(match.combatants[playerIds[1]].health, 100);
});

test('valida el contrato de atlas, clips, ancla y hitboxes de manera independiente', () => {
  const definition = spriteDefinition();
  assert.equal(art.validate(definition), true);
  assert.equal(art.create(definition).frameHeight, 112);

  assert.throws(() => art.validate({ ...definition, anchor: { x: 48, y: 0 } }), /ancla de pies/);
  assert.throws(() => art.validate({ ...definition, visualScale: 0 }), /escala visual/);
  assert.equal(art.validate({ ...definition, frameFootAnchors: { 0: 108 } }), true);
  assert.throws(() => art.validate({ ...definition, frameFootAnchors: { 0: 0 } }), /anclas de pies por frame/);
  assert.throws(() => art.validate({ ...definition, frameFootAnchors: { 9: 108 } }), /anclas de pies por frame/);
  assert.equal(art.validate({ ...definition, frameDrawBounds: { 0: { x: 1, y: 2, width: 90, height: 108 } } }), true);
  assert.throws(() => art.validate({ ...definition, frameDrawBounds: { 0: { x: 90, y: 2, width: 10, height: 108 } } }), /recortes por frame/);
  assert.throws(() => art.validate({ ...definition, src: 'https://example.com/sprite.png' }), /ruta local/);
  const invalidClip = spriteDefinition();
  invalidClip.animations.walk.frames = [];
  assert.throws(() => art.validate(invalidClip), /clip walk/);
  const invalidHitbox = spriteDefinition();
  invalidHitbox.hitboxes.body.width = 0;
  assert.throws(() => art.validate(invalidHitbox), /caja corporal/);
});

test('el combate conserva la definición de sprite validada sin copiarla en cada tick', () => {
  const sprite = spriteDefinition();
  const catalog = roster.entries.map((fighter, index) => index === 0 ? { ...fighter, sprite } : fighter);
  const match = teams.createMatch({
    roster: catalog,
    playerTeam: ['fighter-01', 'fighter-02', 'fighter-04'],
    cpuTeam: ['fighter-03', 'fighter-08', 'fighter-10'],
    seed: 15
  });
  const original = match.duel.left.sprite;
  const combatantSprite = match.combatants[match.active.player].sprite;
  assert.equal(original.src, sprite.src);
  assert.equal(Object.isFrozen(original.animations.idle.frames), true);

  const next = teams.stepMatch(match, { player: {}, cpu: {} }).state;
  assert.strictEqual(next.duel.left.sprite, original);
  assert.strictEqual(next.combatants[next.active.player].sprite, combatantSprite);
});

test('rechaza configuraciones individuales fuera de balance o mal formadas', () => {
  assert.throws(() => engine.validateFighterDefinition({ id: 'bad', stats: { groundSpeed: 0 } }), /estadísticas individuales/);
  assert.throws(() => engine.validateFighterDefinition({ id: 'bad', moves: { light: { reach: -1 } } }), /movimiento light/);
  assert.throws(() => teams.createMatch({
    roster: roster.entries.map((fighter, index) => index === 0 ? { ...fighter, palette: { accent: 'red' } } : fighter),
    playerTeam: ['fighter-01', 'fighter-02', 'fighter-04'],
    seed: 2
  }), /paleta/);
});
