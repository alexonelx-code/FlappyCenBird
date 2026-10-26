const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/js/fighter/sprite-atlas.js');
const atlas = globalThis.CenFighterSpriteAtlas;

test('recupera los píxeles que rebasan una celda y descarta fragmentos vecinos', () => {
  const atlasWidth = 8;
  const atlasHeight = 16;
  const pixels = new Uint8ClampedArray(atlasWidth * atlasHeight * 4);
  const paint = (x, y) => {
    pixels[(y * atlasWidth + x) * 4 + 3] = 255;
  };

  for (let y = 3; y <= 10; y += 1) paint(3, y);
  for (let y = 9; y <= 10; y += 1) {
    paint(2, y);
    paint(4, y);
  }
  for (let y = 9; y <= 11; y += 1) paint(7, y);

  const frame = atlas.extractFrame(pixels, atlasWidth, atlasHeight, 8, 8, 0, 1);

  assert.deepEqual({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }, {
    x: 2, y: 3, width: 3, height: 8
  });
  assert.equal(frame.pixels[(7 * frame.width + 1) * 4 + 3], 255);
  assert.equal(frame.pixels.reduce((count, value, index) => count + (index % 4 === 3 && value ? 1 : 0), 0), 12);
  assert.equal(frame.y + frame.height, 11, 'el límite inferior sigue la silueta hasta sus píxeles de contacto');
});

test('prepara y reutiliza frames pixelados desde el atlas cargado', () => {
  const originalDocument = global.document;
  const atlasWidth = 8;
  const atlasHeight = 16;
  const pixels = new Uint8ClampedArray(atlasWidth * atlasHeight * 4);
  for (let y = 3; y <= 10; y += 1) pixels[(y * atlasWidth + 3) * 4 + 3] = 255;
  let reads = 0;
  class MockCanvas {
    constructor() {
      this.context = {
        drawImage() {},
        getImageData() { reads += 1; return { data: pixels }; },
        createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
        putImageData(data) { this.pixels = data.data; }
      };
    }
    getContext() { return this.context; }
  }
  global.document = { createElement: () => new MockCanvas() };

  try {
    const image = { src: 'synthetic-atlas.png', naturalWidth: atlasWidth, naturalHeight: atlasHeight };
    const first = atlas.getFrame(image, 8, 8, 0);
    const second = atlas.getFrame(image, 8, 8, 0);

    assert.strictEqual(first, second);
    assert.equal(first.y, 3);
    assert.equal(first.height, 8);
    assert.equal(first.image.context.pixels[(7 * first.width) * 4 + 3], 255);
    assert.equal(reads, 1, 'lee el atlas una sola vez y reutiliza el recorte');
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
});
