(() => {
  'use strict';

  function freezeDeep(value) {
    Object.values(value).forEach((item) => {
      if (item && typeof item === 'object') freezeDeep(item);
    });
    return Object.freeze(value);
  }

  const entries = [
    { id: 'fighter-01', name: 'Brasa', archetype: 'Equilibrado', palette: { accent: '#ffad70', shadow: '#a64d4c', skin: '#ffe0ae' }, stats: { health: 100, groundSpeed: 310, airSpeed: 260, jumpVelocity: 740 }, moves: { light: { damage: 8, reach: 79, startupFrames: 5, recoveryFrames: 10, knockback: 180 }, heavy: { damage: 14, reach: 101, startupFrames: 11, recoveryFrames: 18, knockback: 280 } } },
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
