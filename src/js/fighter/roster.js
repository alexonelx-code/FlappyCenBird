(() => {
  'use strict';

  function freezeDeep(value) {
    Object.values(value).forEach((item) => {
      if (item && typeof item === 'object') freezeDeep(item);
    });
    return Object.freeze(value);
  }

  const entries = [
    { id: 'fighter-01', name: 'Luis', archetype: 'Equilibrado', portraitSrc: 'assets/fighters/characters/luis-original.jpg', spacingWidth: 168, palette: { accent: '#2875df', shadow: '#183b75', skin: '#f1bd93' }, stats: { health: 100, groundSpeed: 310, airSpeed: 260, jumpVelocity: 740 }, moves: { light: { damage: 8, reach: 79, startupFrames: 5, recoveryFrames: 10, knockback: 180 }, heavy: { damage: 14, reach: 101, startupFrames: 11, recoveryFrames: 18, knockback: 280 } }, sprite: {
      src: 'assets/fighters/characters/fighter-01.png',
      frameWidth: 229,
      frameHeight: 229,
      anchor: { x: 114.5, y: 229 },
      visualScale: 0.82,
      // The generated atlas contains detached shoe fragments around these frames.
      frameDrawBounds: {
        6: { x: 59, y: 25, width: 134, height: 204 }, 7: { x: 47, y: 77, width: 150, height: 152 },
        8: { x: 46, y: 87, width: 142, height: 142 }, 9: { x: 59, y: 91, width: 170, height: 138 },
        10: { x: 63, y: 47, width: 154, height: 182 }, 11: { x: 48, y: 26, width: 171, height: 203 },
        12: { x: 34, y: 34, width: 150, height: 195 }, 13: { x: 33, y: 37, width: 196, height: 192 },
        14: { x: 52, y: 32, width: 133, height: 197 }, 15: { x: 56, y: 30, width: 128, height: 199 },
        16: { x: 35, y: 32, width: 194, height: 197 }, 17: { x: 45, y: 30, width: 163, height: 199 },
        18: { x: 38, y: 33, width: 164, height: 196 }, 19: { x: 21, y: 32, width: 208, height: 197 },
        20: { x: 56, y: 36, width: 159, height: 193 }, 21: { x: 47, y: 64, width: 156, height: 165 },
        22: { x: 8, y: 50, width: 221, height: 179 }, 23: { x: 43, y: 26, width: 168, height: 203 },
        24: { x: 39, y: 21, width: 190, height: 201 }, 25: { x: 52, y: 19, width: 157, height: 203 },
        26: { x: 0, y: 112, width: 229, height: 113 },
        28: { x: 63, y: 21, width: 162, height: 202 }, 29: { x: 50, y: 23, width: 164, height: 200 }
      },
      // These poses have transparent padding below their ground-contact pixels.
      frameFootAnchors: { 24: 221, 25: 221, 26: 225, 28: 221, 29: 221 },
      animations: {
        idle: { frames: [0, 1], fps: 5, loop: true },
        walk: { frames: [2, 3, 4, 5], fps: 10, loop: true },
        jump: { frames: [6], fps: 8, loop: false },
        crouch: { frames: [7, 8, 9], fps: 8, loop: true },
        block: { frames: [10], fps: 6, loop: true },
        light: { frames: [12, 13, 14], fps: 12, loop: false },
        medium: { frames: [15, 16, 17], fps: 12, loop: false },
        heavy: { frames: [18, 19, 20], fps: 8, loop: false },
        special: { frames: [21, 22, 23], fps: 8, loop: false },
        hurt: { frames: [24, 25], fps: 12, loop: false },
        ko: { frames: [26], fps: 8, loop: false },
        enter: { frames: [11], fps: 8, loop: false },
        victory: { frames: [28, 29], fps: 6, loop: true }
      },
      hitboxes: {
        body: { x: -38, y: -170, width: 76, height: 170 },
        light: { x: 2, y: -116, width: 96, height: 45 },
        medium: { x: 4, y: -126, width: 120, height: 68 },
        heavy: { x: 2, y: -128, width: 116, height: 58 },
        special: { x: 4, y: -128, width: 146, height: 76 }
      }
    } },
    { id: 'fighter-02', name: 'Rayo', archetype: 'Rápido', palette: { accent: '#ffe06e', shadow: '#b6683f', skin: '#ffe4b0' }, stats: { health: 94, groundSpeed: 350, airSpeed: 290, jumpVelocity: 760 }, moves: { light: { damage: 7, reach: 72, startupFrames: 4, recoveryFrames: 9, knockback: 158 }, heavy: { damage: 12, reach: 92, startupFrames: 10, recoveryFrames: 16, knockback: 232 } } },
    { id: 'fighter-03', name: 'Marea', archetype: 'Técnica', palette: { accent: '#7bd8d6', shadow: '#326c86', skin: '#f4d09e' }, stats: { health: 98, groundSpeed: 315, airSpeed: 270, jumpVelocity: 755, guardDamageScale: 0.22 }, moves: { light: { damage: 8, reach: 82, startupFrames: 5, recoveryFrames: 10, knockback: 170 }, heavy: { damage: 13, reach: 104, startupFrames: 10, recoveryFrames: 17, knockback: 250 } } },
    { id: 'fighter-04', name: 'Roca', archetype: 'Potente', palette: { accent: '#c79c75', shadow: '#654456', skin: '#ffdaa2' }, stats: { health: 112, groundSpeed: 270, airSpeed: 235, jumpVelocity: 690 }, moves: { light: { damage: 9, reach: 80, startupFrames: 6, recoveryFrames: 12, knockback: 210 }, heavy: { damage: 17, reach: 108, startupFrames: 12, recoveryFrames: 20, knockback: 330 } } },
    { id: 'fighter-05', name: 'Sombra', archetype: 'Alcance', palette: { accent: '#a99ce8', shadow: '#4c476f', skin: '#f3d0ad' }, stats: { health: 96, groundSpeed: 290, airSpeed: 250, jumpVelocity: 730 }, moves: { light: { damage: 7, reach: 94, startupFrames: 6, recoveryFrames: 12, knockback: 150 }, heavy: { damage: 12, reach: 126, startupFrames: 12, recoveryFrames: 20, knockback: 260 } } },
    { id: 'fighter-06', name: 'Jaguar', archetype: 'Asalto', palette: { accent: '#ef9b59', shadow: '#754346', skin: '#f6d19c' }, stats: { health: 100, groundSpeed: 332, airSpeed: 278, jumpVelocity: 775 }, moves: { light: { damage: 8, reach: 76, startupFrames: 4, recoveryFrames: 10, knockback: 178 }, heavy: { damage: 13, reach: 96, startupFrames: 9, recoveryFrames: 17, knockback: 250 } } },
    { id: 'fighter-07', name: 'Chispa', archetype: 'Aérea', palette: { accent: '#96d889', shadow: '#3f7559', skin: '#f7dba8' }, stats: { health: 92, groundSpeed: 324, airSpeed: 300, jumpVelocity: 820 }, moves: { light: { damage: 7, reach: 75, startupFrames: 5, recoveryFrames: 10, knockback: 160 }, heavy: { damage: 13, reach: 95, startupFrames: 10, recoveryFrames: 17, knockback: 250 } } },
    { id: 'fighter-08', name: 'Nopal', archetype: 'Defensivo', palette: { accent: '#a3cc73', shadow: '#547049', skin: '#f1d2a0' }, stats: { health: 110, groundSpeed: 280, airSpeed: 245, jumpVelocity: 710, guardDamageScale: 0.18, guardKnockbackScale: 0.22 }, moves: { light: { damage: 8, reach: 78, startupFrames: 5, recoveryFrames: 11, knockback: 180 }, heavy: { damage: 13, reach: 104, startupFrames: 11, recoveryFrames: 18, knockback: 260 } } },
    { id: 'fighter-09', name: 'Cometa', archetype: 'Largo alcance', palette: { accent: '#93caef', shadow: '#3c6385', skin: '#f7d5ad' }, stats: { health: 97, groundSpeed: 302, airSpeed: 265, jumpVelocity: 750 }, moves: { light: { damage: 7, reach: 100, startupFrames: 6, recoveryFrames: 12, knockback: 160 }, heavy: { damage: 13, reach: 132, startupFrames: 13, recoveryFrames: 20, knockback: 275 } } },
    { id: 'fighter-10', name: 'Fénix', archetype: 'Versátil', palette: { accent: '#ec8294', shadow: '#9b4a61', skin: '#ffddb0' }, stats: { health: 101, groundSpeed: 310, airSpeed: 265, jumpVelocity: 750, guardDamageScale: 0.24 }, moves: { light: { damage: 8, reach: 80, startupFrames: 5, recoveryFrames: 10, knockback: 182 }, heavy: { damage: 15, reach: 104, startupFrames: 10, recoveryFrames: 18, knockback: 300 } } }
  ];

  const frozenEntries = freezeDeep(entries);
  const byId = new Map(frozenEntries.map((fighter) => [fighter.id, fighter]));
  globalThis.CenFighterRoster = Object.freeze({
    entries: frozenEntries,
    getById(id) { return byId.get(String(id)) || null; }
  });
})();
