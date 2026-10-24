(() => {
  'use strict';

  const PALETTES = [
    ['#6ed4c7', '#276d74', '#ffd18f'], ['#ff9b77', '#a64057', '#ffe0a5'],
    ['#a5a0ff', '#4d4d93', '#f7d29a'], ['#f4d36b', '#a8593c', '#fce7b3'],
    ['#7fbbff', '#315a91', '#f7c893'], ['#d886d9', '#713e83', '#ffd49c'],
    ['#91d487', '#386b54', '#f7d69e'], ['#f28f9e', '#843f58', '#ffdaa9'],
    ['#8fdae5', '#356377', '#f4c89f'], ['#efa95d', '#8c4d32', '#ffe0aa']
  ];

  function paletteFor(fighter) {
    const match = /-(\d+)$/.exec(fighter.characterId || fighter.id || '');
    return PALETTES[(Math.max(1, Number(match && match[1]) || 1) - 1) % PALETTES.length];
  }

  function pixel(ctx, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function drawFighter(ctx, fighter, side, frame) {
    const [accent, shadow, skin] = paletteFor(fighter);
    const bodyHeight = fighter.crouching && fighter.grounded ? fighter.crouchHeight : fighter.height;
    const scale = bodyHeight / 116;
    const x = fighter.x;
    const top = fighter.y - bodyHeight;
    const width = fighter.width;
    const facing = fighter.facing;
    const moving = Math.abs(fighter.vx) > 18;
    const stride = moving && fighter.grounded ? Math.sin(frame * 0.28) * 4 : 0;
    const flash = fighter.hitstunFrames > 0 && Math.floor(frame / 3) % 2 === 0;
    const main = flash ? '#fff2c5' : accent;
    const outline = flash ? '#ffffff' : '#101e2e';
    const rect = (offsetX, offsetY, rectWidth, rectHeight, color) => pixel(ctx,
      x + offsetX * scale - rectWidth * scale / 2,
      top + offsetY * scale,
      rectWidth * scale,
      rectHeight * scale,
      color);

    ctx.save();
    ctx.globalAlpha = fighter.knockedOut ? 0.48 : 1;
    pixel(ctx, x - width * 0.62, fighter.y + 5, width * 1.24, 6, 'rgba(5, 12, 23, .38)');
    rect(0, 16, 42, 34, outline);
    rect(0, 17, 36, 28, shadow);
    rect(0, 20, 28, 21, main);
    rect(0, 60, 42, 38, outline);
    rect(0, 61, 36, 32, main);
    rect(-15, 65, 9, 26, shadow);
    rect(15, 65, 9, 26, shadow);
    rect(-11, 94 + stride, 13, 22, outline);
    rect(11, 94 - stride, 13, 22, outline);
    rect(-11, 94 + stride, 7, 16, shadow);
    rect(11, 94 - stride, 7, 16, shadow);
    rect(0, 97, 14, 5, skin);
    rect(facing * 12, 29, 4, 4, '#18202c');

    const attacking = fighter.attackId && fighter.attackFrame >= 2;
    const armX = attacking ? facing * 24 : facing * 19;
    const armY = attacking ? 65 : 57;
    rect(armX, armY, attacking ? 27 : 15, 11, outline);
    rect(armX, armY + 1, attacking ? 23 : 11, 7, main);
    rect(attacking ? facing * 37 : -facing * 19, 61, 12, 11, outline);
    rect(attacking ? facing * 37 : -facing * 19, 62, 7, 7, skin);

    if (fighter.guarding) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#b8eced';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + facing * 23, fighter.y - bodyHeight * 0.57, 26 * scale, -1.15, 1.15);
      ctx.stroke();
    }
    if (attacking) {
      const move = fighter.attackId;
      const moveWidth = move === 'heavy' ? 66 : 47;
      const active = fighter.attackFrame >= (move === 'heavy' ? 11 : 5)
        && fighter.attackFrame < (move === 'heavy' ? 15 : 8);
      if (active) {
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = move === 'heavy' ? '#ffd58a' : '#93e9db';
        ctx.beginPath();
        ctx.moveTo(x + facing * 28, fighter.y - bodyHeight * 0.54);
        ctx.lineTo(x + facing * (28 + moveWidth), fighter.y - bodyHeight * 0.67);
        ctx.lineTo(x + facing * (22 + moveWidth), fighter.y - bodyHeight * 0.43);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBackground(ctx, frame) {
    const sky = ctx.createLinearGradient(0, 0, 0, 540);
    sky.addColorStop(0, '#20385c');
    sky.addColorStop(0.58, '#596a84');
    sky.addColorStop(1, '#e89d75');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = 'rgba(255, 218, 157, .78)';
    ctx.beginPath();
    ctx.arc(730, 133, 52, 0, Math.PI * 2);
    ctx.fill();
    for (let index = 0; index < 9; index += 1) {
      const x = index * 116 - 12;
      const height = 90 + (index * 37 % 90);
      pixel(ctx, x, 348 - height, 84, height, index % 2 ? '#293854' : '#32425e');
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          pixel(ctx, x + 12 + column * 23, 365 - height + row * 31, 7, 11,
            (row + column + index) % 3 ? 'rgba(255, 208, 140, .44)' : 'rgba(20, 35, 58, .5)');
        }
      }
    }
    pixel(ctx, 0, 365, 960, 175, '#1e3145');
    pixel(ctx, 0, 369, 960, 12, '#f3b776');
    pixel(ctx, 0, 381, 960, 159, '#21364a');
    ctx.globalAlpha = 0.14;
    for (let index = 0; index < 35; index += 1) {
      const x = (index * 127 + frame * 0.28) % 960;
      pixel(ctx, x, 395 + (index * 29 % 126), 31, 3, '#b5d5dc');
    }
    ctx.globalAlpha = 1;
    pixel(ctx, 0, 508, 960, 32, '#15263a');
    for (let index = 0; index < 60; index += 1) {
      pixel(ctx, index * 17, 510, 8, 3, index % 2 ? '#8c7a72' : '#b38875');
    }
  }

  function draw(context, match, frame = 0) {
    if (!context || !match || !match.duel) return;
    drawBackground(context, frame);
    drawFighter(context, match.duel.left, 'left', frame);
    drawFighter(context, match.duel.right, 'right', frame);
  }

  globalThis.CenFighterRenderer = Object.freeze({ draw });
})();
