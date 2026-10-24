const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/js/fighter/config.js');
require('../src/js/fighter/engine.js');
require('../src/js/fighter/random.js');
require('../src/js/fighter/sprite-contract.js');
require('../src/js/fighter/roster.js');
const teams = require('../src/js/fighter/team-match.js');
require('../src/js/fighter/renderer.js');
const renderer = globalThis.CenFighterRenderer;

function contextMock() {
  const calls = { fills: 0, images: 0 };
  return {
    calls,
    fillRect() { calls.fills += 1; },
    createLinearGradient() { return { addColorStop() {} }; },
    beginPath() {},
    arc() {},
    fill() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage() { calls.images += 1; },
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {}
  };
}

test('dibuja la arena, placeholders y efectos de impacto sin depender de sprites', () => {
  const match = teams.createMatch({
    playerTeam: ['fighter-01', 'fighter-02', 'fighter-04'],
    cpuTeam: ['fighter-03', 'fighter-08', 'fighter-10'],
    seed: 9
  });
  const ctx = contextMock();

  renderer.draw(ctx, match, 3, [{ type: 'hit', frame: 3, x: 460, y: 250 }]);

  assert.ok(ctx.calls.fills > 100);
  assert.equal(ctx.calls.images, 0);
});

