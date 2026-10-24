((root, factory) => {
  'use strict';

  const random = factory();
  root.CenFighterRandom = random;
  if (typeof module === 'object' && module.exports) module.exports = random;
})(globalThis, () => {
  'use strict';

  function hashSeed(seed) {
    const text = String(seed);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 0x6d2b79f5;
  }

  function normalizeSeed(seed = 1) {
    if (Number.isFinite(seed)) return (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
    return hashSeed(seed);
  }

  function forkSeed(seed, label) {
    return hashSeed(`${normalizeSeed(seed)}:${label}`);
  }

  function nextRandom(state) {
    let value = normalizeSeed(state);
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return { value: value / 0x100000000, state: value || 0x6d2b79f5 };
  }

  return Object.freeze({ normalizeSeed, forkSeed, nextRandom });
});
