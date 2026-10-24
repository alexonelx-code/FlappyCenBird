const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadAudio() {
  const events = [];
  const window = { dispatchEvent(event) { events.push(event); } };
  const context = {
    window,
    localStorage: { getItem() { return null; }, setItem() {} },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    }
  };
  vm.runInNewContext(fs.readFileSync('src/js/audio.js', 'utf8'), context);
  return { audio: window.FlappyAudio, events };
}

test('publica y permite invocar todos los efectos que usa Cen Fighters', () => {
  const { audio } = loadAudio();

  for (const method of ['fighterHit', 'fighterBlock', 'fighterKo', 'fighterEnter', 'fighterResult']) {
    assert.equal(typeof audio[method], 'function', `${method} debe formar parte de FlappyAudio`);
  }

  assert.doesNotThrow(() => {
    audio.fighterHit();
    audio.fighterBlock();
    audio.fighterKo();
    audio.fighterEnter();
    audio.fighterResult('win');
  });
});

test('los efectos de pelea también son seguros si el navegador no ofrece Web Audio', () => {
  const { audio } = loadAudio();
  audio.fighterHit();
  audio.fighterBlock();
  audio.fighterKo();
  audio.fighterEnter();
  audio.fighterResult('draw');
  assert.equal(audio.isMuted(), false);
});
