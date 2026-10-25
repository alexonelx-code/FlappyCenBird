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

function spriteContext() {
  const calls = { spriteDraws: [], fills: 0, shadows: [] };
  const translations = [];
  let translateY = 0;
  return {
    calls,
    fillStyle: '',
    fillRect(x, y, width, height) {
      calls.fills += 1;
      if (String(this.fillStyle).startsWith('rgba(5, 12, 23')) calls.shadows.push({ x, y, width, height });
    },
    createLinearGradient() { return { addColorStop() {} }; },
    beginPath() {}, arc() {}, fill() {},
    save() { translations.push(translateY); },
    restore() { translateY = translations.pop() || 0; },
    translate(_x, y) { translateY += y; },
    scale() {},
    drawImage(image, ...args) {
      const src = String(image && image.src || '');
      if (src.endsWith('/fighter-01.png') || src.endsWith('/luis-block-guard-v2.png')) {
        calls.spriteDraws.push({ translateY, args, src });
      }
    },
    moveTo() {}, lineTo() {}, closePath() {}, stroke() {}
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

test('alinea al piso los frames de daño de Luis con anclas medidas del atlas', () => {
  const originalImage = global.Image;
  global.Image = class MockImage {
    constructor() {
      this.complete = true;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.src = '';
    }
    set src(path) {
      this._src = path;
      [this.naturalWidth, this.naturalHeight] = path.endsWith('/fighter-01.png') || path.endsWith('/luis-block-guard-v2.png')
        ? [1374, 1145]
        : [960, 540];
    }
    get src() { return this._src; }
  };

  try {
    const match = teams.createMatch({
      playerTeam: ['fighter-01', 'fighter-01', 'fighter-01'],
      cpuTeam: ['fighter-02', 'fighter-03', 'fighter-04'],
      seed: 8
    });
    const ctx = spriteContext();
    const fighter = match.duel.left;
    const scale = fighter.height * fighter.sprite.visualScale / fighter.sprite.anchor.y;

    [
      { remainingStun: 12, renderFrame: 0, expectedFrame: 24 },
      { remainingStun: 7, renderFrame: 0, expectedFrame: 25 },
      { remainingStun: 0, renderFrame: 6, expectedFrame: 3 }
    ].forEach(({ remainingStun, renderFrame, expectedFrame }) => {
      fighter.hitstunFrames = remainingStun;
      fighter.vx = remainingStun ? 0 : 40;
      renderer.draw(ctx, match, renderFrame, [], { stageId: 'fachada' });
      const { translateY, args } = ctx.calls.spriteDraws.at(-1);
      const frame = Math.floor(args[0] / fighter.sprite.frameWidth)
        + Math.floor(args[1] / fighter.sprite.frameHeight) * 6;
      const frameFootAnchor = fighter.sprite.frameFootAnchors[frame] || fighter.sprite.anchor.y;
      const cropY = fighter.sprite.frameDrawBounds?.[frame]?.y || 0;
      const baseline = translateY + (args[5] + frameFootAnchor - cropY) * scale;

      assert.equal(frame, expectedFrame);
      assert.ok(Math.abs(baseline - fighter.y) < 1e-9);
    });
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
});

test('usa la pose completa de bloqueo de Luis y fija ambos pies al piso', () => {
  const originalImage = global.Image;
  global.Image = class MockImage {
    constructor() { this.complete = true; this.naturalWidth = 0; this.naturalHeight = 0; this.src = ''; }
    set src(path) {
      this._src = path;
      [this.naturalWidth, this.naturalHeight] = path.endsWith('/fighter-01.png')
        ? [1374, 1145]
        : path.endsWith('/luis-block-guard-v2.png') ? [1374, 1145] : [960, 540];
    }
    get src() { return this._src; }
  };

  try {
    const match = teams.createMatch({
      playerTeam: ['fighter-01', 'fighter-01', 'fighter-01'],
      cpuTeam: ['fighter-02', 'fighter-03', 'fighter-04'],
      seed: 28
    });
    const fighter = match.duel.left;
    fighter.guarding = true;
    const ctx = spriteContext();

    renderer.draw(ctx, match, 0, [], { stageId: 'fachada' });

    const draw = ctx.calls.spriteDraws.find((entry) => entry.src.endsWith('/luis-block-guard-v2.png'));
    assert.ok(draw, 'la pose block debe dibujar el asset completo de Luis');
    assert.deepEqual(draw.args.slice(0, 4), [248, 67, 914, 1029]);
    assert.deepEqual(draw.args.slice(4), [-101.5, -229, 203, 229]);
    const scale = fighter.height * fighter.sprite.visualScale / fighter.sprite.anchor.y;
    const baseline = draw.translateY + (draw.args[5] + fighter.sprite.frameOverrides[10].footAnchor) * scale;
    assert.ok(Math.abs(baseline - match.duel.rules.arena.floorY) < 1e-9);
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
});

test('mantiene la sombra de Luis en el suelo mientras salta', () => {
  const originalImage = global.Image;
  global.Image = class MockImage {
    constructor() { this.complete = true; this.naturalWidth = 0; this.naturalHeight = 0; this.src = ''; }
    set src(path) {
      this._src = path;
      [this.naturalWidth, this.naturalHeight] = path.endsWith('/fighter-01.png') ? [1374, 1145] : [960, 540];
    }
    get src() { return this._src; }
  };

  try {
    const match = teams.createMatch({
      playerTeam: ['fighter-01', 'fighter-01', 'fighter-01'],
      cpuTeam: ['fighter-02', 'fighter-03', 'fighter-04'],
      seed: 12
    });
    const ctx = spriteContext();
    const fighter = match.duel.left;
    const floorY = match.duel.rules.arena.floorY;

    fighter.grounded = false;
    fighter.y = floorY - 120;
    renderer.draw(ctx, match, 0, [], { stageId: 'monumento' });
    const airborneShadow = ctx.calls.shadows[0];
    assert.equal(airborneShadow.y, floorY + 1);
    assert.ok(Number.isFinite(airborneShadow.y));

    ctx.calls.shadows.length = 0;
    fighter.grounded = true;
    fighter.y = floorY;
    renderer.draw(ctx, match, 0, [], { stageId: 'monumento' });
    const groundedShadow = ctx.calls.shadows[0];
    assert.equal(groundedShadow.y, floorY + 1);
    assert.ok(groundedShadow.width > airborneShadow.width);
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
});

test('recorta los fragmentos sueltos de los frames de daño de Luis', () => {
  const originalImage = global.Image;
  global.Image = class MockImage {
    constructor() { this.complete = true; this.naturalWidth = 0; this.naturalHeight = 0; this.src = ''; }
    set src(path) {
      this._src = path;
      [this.naturalWidth, this.naturalHeight] = path.endsWith('/fighter-01.png') ? [1374, 1145] : [960, 540];
    }
    get src() { return this._src; }
  };

  try {
    const match = teams.createMatch({
      playerTeam: ['fighter-01', 'fighter-01', 'fighter-01'],
      cpuTeam: ['fighter-02', 'fighter-03', 'fighter-04'],
      seed: 18
    });
    match.duel.left.hitstunFrames = 7;
    const ctx = spriteContext();
    renderer.draw(ctx, match, 0, [], { stageId: 'monumento' });
    const { args } = ctx.calls.spriteDraws.at(-1);
    const bounds = match.duel.left.sprite.frameDrawBounds[25];

    assert.deepEqual(args.slice(0, 4), [229 + bounds.x, 4 * 229 + bounds.y, bounds.width, bounds.height]);
    assert.deepEqual(args.slice(4), [bounds.x - 114.5, bounds.y - 229, bounds.width, bounds.height]);
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
});

