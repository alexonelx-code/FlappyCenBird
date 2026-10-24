const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'src/js/game-config.js'), 'utf8'), context);
vm.runInNewContext(readFileSync(join(root, 'src/js/game-pace.js'), 'utf8'), context);

const config = context.window.FlappyGameConfig.pace;
const pace = context.window.FlappyPace;

test('the pace starts gently, rises, and stabilizes at the ramp limit', () => {
  const profile = pace.createProfile(config, () => 0.5);

  assert.equal(pace.speedAt(0, profile, config), config.initialSpeed);
  assert.ok(pace.speedAt(5, profile, config) < pace.speedAt(20, profile, config));
  assert.equal(pace.speedAt(50, profile, config), config.maxSpeed);
  assert.equal(pace.speedAt(80, profile, config), config.maxSpeed);
});

test('random phases create slower and faster passages before the plateau', () => {
  const values = [0, 0, 0, 0.99, 0, 0.01];
  let index = 0;
  const profile = pace.createProfile(config, () => values[index++ % values.length]);
  const baselineAt = (score) => config.initialSpeed + (config.maxSpeed - config.initialSpeed) * score / config.rampPoints;

  assert.ok(pace.speedAt(3, profile, config) < baselineAt(3));
  assert.ok(pace.speedAt(6, profile, config) > baselineAt(6));
  assert.equal(pace.speedAt(50, profile, config), config.maxSpeed);
});

test('each randomized phase stays within its configured point range', () => {
  const profile = pace.createProfile(config, Math.random);

  assert.equal(profile[0].start, 0);
  assert.equal(profile.at(-1).end, config.rampPoints);
  profile.forEach((phase) => {
    const length = phase.end - phase.start;
    assert.ok(length >= config.phaseMinPoints);
    assert.ok(length <= config.phaseMaxPoints);
    for (let score = phase.start; score < phase.end; score++) {
      const speed = pace.speedAt(score, profile, config);
      assert.ok(speed >= config.initialSpeed);
      assert.ok(speed <= config.maxSpeed);
    }
  });
});
