(() => {
  'use strict';

  const PALETTES = [
    ['#6ed4c7', '#276d74', '#ffd18f'], ['#ff9b77', '#a64057', '#ffe0a5'],
    ['#a5a0ff', '#4d4d93', '#f7d29a'], ['#f4d36b', '#a8593c', '#fce7b3'],
    ['#7fbbff', '#315a91', '#f7c893'], ['#d886d9', '#713e83', '#ffd49c'],
    ['#91d487', '#386b54', '#f7d69e'], ['#f28f9e', '#843f58', '#ffdaa9'],
    ['#8fdae5', '#356377', '#f4c89f'], ['#efa95d', '#8c4d32', '#ffe0aa']
  ];
  const HAIR_COLORS = ['#251d2a', '#4a2928', '#1d293e', '#5a382c', '#272437', '#56334a', '#2b3327', '#492936', '#1e3035', '#5c342b'];
  const spriteImages = new Map();
  const motionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const STAGE_ASSETS = [
    '01-biblioteca.png',
    '02-campus-nocturno.png',
    '03-jardin.png',
    '04-fachada.png',
    '05-monumento.png'
  ];
  let backgroundCanvas = null;

  function paletteFor(fighter) {
    if (fighter.palette) return [fighter.palette.accent, fighter.palette.shadow, fighter.palette.skin];
    const match = /-(\d+)$/.exec(fighter.characterId || fighter.id || '');
    return PALETTES[(Math.max(1, Number(match && match[1]) || 1) - 1) % PALETTES.length];
  }

  function spriteImage(src) {
    if (typeof Image === 'undefined') return null;
    if (!spriteImages.has(src)) {
      const image = new Image();
      image.src = src;
      spriteImages.set(src, image);
    }
    const image = spriteImages.get(src);
    return image.complete && image.naturalWidth ? image : null;
  }

  function pixelStage(boutNumber) {
    const index = ((Math.max(1, Number(boutNumber) || 1) - 1) % STAGE_ASSETS.length);
    return spriteImage(`assets/fighters/stages/${STAGE_ASSETS[index]}`);
  }

  function drawRosterSprite(ctx, fighter, frame, reducedMotion, portrait) {
    const image = spriteImage('assets/fighters/roster-atlas.png');
    if (!image) return false;
    const match = /fighter-(\d+)/.exec(fighter.characterId || fighter.id || '');
    const index = Math.max(0, Math.min(9, Number(match && match[1]) - 1 || 0));
    const cellWidth = image.naturalWidth / 5;
    const cellHeight = image.naturalHeight / 2;
    const sourceX = (index % 5) * cellWidth;
    const sourceY = Math.floor(index / 5) * cellHeight;
    const bodyHeight = fighter.crouching && fighter.grounded ? fighter.crouchHeight : fighter.height;
    const artHeight = portrait
      ? Math.min(bodyHeight * (fighter.crouching && fighter.grounded ? 0.78 : 1.15), 140)
      : bodyHeight * (fighter.crouching && fighter.grounded ? 0.98 : 1.38);
    const artWidth = artHeight * (portrait ? 1.35 : 1);
    const moving = Math.abs(fighter.vx) > 30 && fighter.grounded;
    const attack = fighter.attackId && fighter.moves && fighter.moves[fighter.attackId];
    const strikeStart = attack ? attack.startupFrames : 0;
    const strikeEnd = attack ? strikeStart + attack.activeFrames : 0;
    const striking = Boolean(attack && fighter.attackFrame >= strikeStart && fighter.attackFrame < strikeEnd);
    const advancing = Boolean(attack && fighter.attackFrame >= Math.floor(strikeStart * 0.55));
    const bob = reducedMotion ? 0 : moving ? Math.abs(Math.sin(frame * 0.42)) * 3 : Math.sin(frame * 0.13) * 1.2;
    const lunge = advancing ? (striking ? 13 : 5) : 0;
    const recoil = fighter.hitstunFrames > 0 ? fighter.facing * -4 : 0;

    ctx.save();
    ctx.globalAlpha = fighter.knockedOut ? 0.55 : 1;
    pixel(ctx, fighter.x - artWidth * 0.31, fighter.y + 5, artWidth * 0.62, 6, 'rgba(6, 11, 20, .55)');
    ctx.translate(fighter.x + recoil + fighter.facing * lunge, fighter.y - bob);
    ctx.scale(fighter.facing, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sourceX, sourceY, cellWidth, cellHeight,
      -artWidth / 2, -artHeight, artWidth, artHeight);
    if (striking) {
      const tint = fighter.attackId === 'special' ? '#b7f5ff'
        : fighter.attackId === 'heavy' ? '#ffe28a'
          : fighter.attackId === 'medium' ? '#ffbc7b' : '#fff4ce';
      const reach = fighter.attackId === 'special' ? 50 : fighter.attackId === 'heavy' ? 38 : 28;
      ctx.globalAlpha = 0.85;
      pixel(ctx, artWidth * 0.19, -artHeight * 0.65, reach, 5, tint);
      pixel(ctx, artWidth * 0.27, -artHeight * 0.58, reach * 0.68, 3, '#fff9de');
      pixel(ctx, artWidth * 0.19 + reach, -artHeight * 0.7, 7, 7, tint);
    }
    if (fighter.hitstunFrames > 0 && !reducedMotion) {
      ctx.globalAlpha = 0.78;
      pixel(ctx, -artWidth * 0.18, -artHeight * 0.72, 6, 6, '#fff3c0');
      pixel(ctx, artWidth * 0.13, -artHeight * 0.8, 4, 5, '#ffb16d');
    }
    ctx.restore();
    return true;
  }

  function drawSprite(ctx, fighter, frame, bodyHeight, reducedMotion) {
    const sprite = fighter.sprite;
    const contract = globalThis.CenFighterArtContract;
    if (!sprite || !contract) return false;
    const image = spriteImage(sprite.src);
    if (!image) return false;
    const clip = sprite.animations[contract.animationFor(fighter)];
    const columns = Math.floor(image.naturalWidth / sprite.frameWidth);
    const rows = Math.floor(image.naturalHeight / sprite.frameHeight);
    if (!columns || !rows || clip.frames.some((index) => index >= columns * rows)) return false;
    const animationFrame = fighter.attackId
      ? fighter.attackFrame
      : fighter.hitstunFrames > 0 && fighter.stats
        ? Math.max(0, fighter.stats.hitstunFrames - fighter.hitstunFrames)
        : frame;
    const step = reducedMotion ? 0 : Math.floor(animationFrame * clip.fps / 60);
    const clipStep = clip.loop ? step % clip.frames.length : Math.min(step, clip.frames.length - 1);
    const index = clip.frames[clipStep];
    const scale = bodyHeight / sprite.anchor.y;
    const width = sprite.frameWidth * scale;
    ctx.save();
    ctx.globalAlpha = fighter.knockedOut ? 0.58 : 1;
    pixel(ctx, fighter.x - width * 0.34, fighter.y + 5, width * 0.68, 6, 'rgba(5, 12, 23, .38)');
    ctx.translate(fighter.x, fighter.y);
    ctx.scale(fighter.facing * scale, scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, (index % columns) * sprite.frameWidth, Math.floor(index / columns) * sprite.frameHeight,
      sprite.frameWidth, sprite.frameHeight, -sprite.anchor.x, -sprite.anchor.y, sprite.frameWidth, sprite.frameHeight);
    ctx.restore();
    return true;
  }

  function pixel(ctx, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function drawFighter(ctx, fighter, side, frame, reducedMotion, portrait) {
    const [accent, shadow, skin] = paletteFor(fighter);
    const bodyHeight = fighter.crouching && fighter.grounded ? fighter.crouchHeight : fighter.height;
    const scaleX = bodyHeight / 116 * 1.24;
    const scaleY = bodyHeight / 116 * 1.24;
    const number = Math.max(0, Number((/-(\d+)$/.exec(fighter.characterId || fighter.id || '') || [])[1] || 1) - 1);
    const moving = Math.abs(fighter.vx) > 18;
    const stride = moving && fighter.grounded && !reducedMotion ? Math.sin(frame * 0.28) * 5 : 0;
    const flash = !reducedMotion && fighter.hitstunFrames > 0 && Math.floor(frame / 3) % 2 === 0;
    const cloth = flash ? '#fff4ce' : accent;
    const shade = flash ? '#fff4ce' : shadow;
    const ink = '#211d2a';
    const hair = flash ? '#fff4ce' : HAIR_COLORS[number % HAIR_COLORS.length];
    const lightSkin = flash ? '#fff4ce' : '#fff0c2';
    const attack = fighter.attackId && fighter.moves && fighter.moves[fighter.attackId];
    const startup = attack ? attack.startupFrames : 0;
    const active = Boolean(attack && fighter.attackFrame >= startup
      && fighter.attackFrame < startup + attack.activeFrames);
    const attackPose = Boolean(attack && fighter.attackFrame >= Math.floor(startup * 0.55));
    const handX = attackPose ? 49 + (fighter.attackId === 'special' ? 9 : 0) : 24;
    const armY = attackPose ? -99 : -83;
    const rect = (cx, bottom, width, height, color) => pixel(ctx, cx - width / 2, -bottom - height, width, height, color);

    ctx.save();
    if (drawSprite(ctx, fighter, frame, bodyHeight, reducedMotion)
        || drawRosterSprite(ctx, fighter, frame, reducedMotion, portrait)) {
      ctx.restore();
      return;
    }
    ctx.globalAlpha = fighter.knockedOut ? 0.48 : 1;
    pixel(ctx, fighter.x - fighter.width * 0.78, fighter.y + 5, fighter.width * 1.56, 7, 'rgba(9, 10, 24, .55)');
    ctx.translate(fighter.x + (fighter.hitstunFrames > 0 ? -fighter.facing * 3 : 0), fighter.y);
    ctx.scale(fighter.facing * scaleX, scaleY);

    rect(-12, 15 + stride, 22, 53, ink);
    rect(-12, 15 + stride, 16, 48, shade);
    rect(-12, 37 + stride, 9, 4, cloth);
    rect(12, 14 - stride, 22, 54, ink);
    rect(12, 14 - stride, 16, 49, shade);
    rect(12, 39 - stride, 8, 4, cloth);
    rect(-13, 2 + stride, 27, 15, ink);
    rect(-15, 3 + stride, 24, 11, '#302c3b');
    rect(13, 2 - stride, 27, 15, ink);
    rect(15, 3 - stride, 24, 11, '#302c3b');
    rect(-15, 3 + stride, 10, 2, '#f0bd6f');
    rect(14, 3 - stride, 10, 2, '#f0bd6f');

    rect(-24, 80, 13, 31, ink);
    rect(-24, 82, 8, 24, skin);
    rect(-20, 102, 12, 13, ink);
    rect(-20, 104, 8, 7, lightSkin);
    rect(24, 80, 14, 31, ink);
    rect(24, 82, 9, 24, skin);
    rect(24, 104, 13, 13, ink);
    rect(24, 106, 8, 7, lightSkin);

    rect(0, 67, 43, 10, ink);
    rect(0, 69, 35, 5, '#342739');
    rect(0, 71, 8, 6, '#e7b467');
    rect(0, 75, 49, 57, ink);
    rect(0, 77, 41, 49, shade);
    rect(0, 80, 33, 42, cloth);
    rect(-17, 78, 7, 40, shade);
    rect(16, 78, 7, 40, shade);
    rect(-3, 82, 6, 26, '#f4e7cf');
    rect(0, 87, 13, 3, '#f4e7cf');
    rect(0, 102, 18, 4, '#342739');
    rect(0, 111, 22, 3, '#f0bd6f');
    rect(-7, 117, 10, 11, skin);
    rect(7, 117, 10, 11, skin);

    if (fighter.guarding) {
      rect(-3, 92, 15, 15, ink);
      rect(12, 99, 15, 14, ink);
      rect(-3, 94, 9, 10, cloth);
      rect(12, 101, 9, 9, shade);
    } else {
      rect(-20, 86, 15, 13, ink);
      rect(-20, 88, 10, 8, cloth);
      rect(-24, 98, 13, 17, ink);
      rect(-24, 100, 8, 11, skin);
      rect(handX, armY + 3, attackPose ? 23 : 14, 16, ink);
      rect(handX + (attackPose ? 0 : -2), armY + 5, attackPose ? 17 : 9, 10, cloth);
      rect(handX + (attackPose ? 17 : -1), armY + 5, 14, 14, ink);
      rect(handX + (attackPose ? 17 : -1), armY + 7, 8, 8, lightSkin);
      if (attackPose && fighter.attackId !== 'special') {
        rect(37, armY + 7, 13, 12, skin);
        rect(47, armY + 6, 17, 15, ink);
        rect(47, armY + 8, 10, 9, lightSkin);
      }
    }

    rect(0, 126, 14, 10, skin);
    rect(0, 124, 22, 26, ink);
    rect(0, 126, 17, 20, skin);
    rect(-12, 146, 30, 11, ink);
    rect(-11, 147, 24, 7, hair);
    rect(-15, 146, 7, 9, hair);
    rect(13, 146, 24, 11, ink);
    rect(13, 147, 18, 7, hair);
    rect(20, 144, 8, 7, hair);
    rect(8, 135, 6, 3, ink);
    rect(11, 130, 3, 5, '#b77b57');
    rect(8, 125, 7, 2, '#8f4548');
    rect(0, 142, 21, 4, number % 3 === 0 ? '#f0bd6f' : cloth);
    rect(0, 150, 28, 10, hair);
    rect(-12, 144, 8, 12, hair);
    rect(-6, 150, 9, 7, hair);
    rect(2, 151, 8, 7, hair);
    rect(10, 144, 8, 12, hair);
    if (number % 3 === 1) {
      rect(0, 144, 22, 4, '#f4e7cf');
      rect(10, 143, 7, 4, '#f4e7cf');
    } else if (number % 3 === 2) {
      rect(-16, 132, 8, 19, hair);
      rect(-21, 128, 10, 6, hair);
    }

    if (fighter.guarding) {
      ctx.globalAlpha = 0.86;
      [[30, -74], [36, -82], [40, -91], [37, -101], [30, -108]].forEach(([px, py]) => {
        pixel(ctx, px, py, 4, 6, '#92eeff');
        pixel(ctx, px + 4, py + 2, 2, 3, '#fff2bd');
      });
      ctx.globalAlpha = fighter.knockedOut ? 0.48 : 1;
    }

    if (active) {
      const color = fighter.attackId === 'special' ? '#ff8176'
        : fighter.attackId === 'heavy' ? '#ffd36c'
          : fighter.attackId === 'medium' ? '#8ce8ff' : '#fff0a6';
      const length = fighter.attackId === 'special' ? 56 : fighter.attackId === 'heavy' ? 45 : 31;
      ctx.globalAlpha = 0.9;
      pixel(ctx, 45, -105, length, 5, color);
      pixel(ctx, 51, -96, length - 12, 4, '#fff2c0');
      pixel(ctx, 57 + length, -111, 7, 7, color);
      pixel(ctx, 60 + length, -104, 4, 4, '#fff7d5');
    }
    ctx.restore();
  }

  function drawBackgroundBase(ctx) {
    pixel(ctx, 0, 0, 960, 540, '#171b39');
    pixel(ctx, 0, -540, 960, 105, '#171b39');
    pixel(ctx, 0, -435, 960, 100, '#202344');
    pixel(ctx, 0, -335, 960, 91, '#302947');
    pixel(ctx, 0, -244, 960, 85, '#4c3450');
    pixel(ctx, 0, -159, 960, 80, '#70415b');
    pixel(ctx, 0, 0, 960, 78, '#20264a');
    pixel(ctx, 0, 78, 960, 72, '#373253');
    pixel(ctx, 0, 150, 960, 70, '#70415b');
    pixel(ctx, 0, 220, 960, 73, '#b65460');
    pixel(ctx, 0, 293, 960, 62, '#e88c68');

    [[90, 74], [223, 133], [830, 91]].forEach(([x, y]) => {
      pixel(ctx, x, y, 62, 12, '#71728a');
      pixel(ctx, x + 17, y - 9, 40, 10, '#71728a');
      pixel(ctx, x + 10, y + 12, 35, 8, '#555572');
    });

    for (let index = 0; index < 30; index += 1) {
      const x = (index * 97 + (index * 31 % 43)) % 940;
      const y = -510 + (index * 67 % 410);
      pixel(ctx, x, y, index % 5 === 0 ? 4 : 2, index % 4 === 0 ? 4 : 2,
        index % 3 === 0 ? '#e8a771' : '#a98caa');
    }
    [[115, -390], [438, -295], [724, -455]].forEach(([x, y], index) => {
      pixel(ctx, x, y, 52, 8, index % 2 ? '#72718d' : '#85819a');
      pixel(ctx, x + 14, y - 7, 33, 7, index % 2 ? '#72718d' : '#85819a');
      pixel(ctx, x + 8, y + 8, 29, 5, '#4c496c');
    });

    pixel(ctx, 661, 89, 132, 18, '#ffbf73');
    pixel(ctx, 646, 106, 162, 16, '#ffd684');
    pixel(ctx, 661, 122, 132, 34, '#f4a666');
    pixel(ctx, 676, 156, 102, 11, '#df7764');
    pixel(ctx, 692, 167, 70, 7, '#b65a67');

    const skyline = [105, 147, 94, 184, 127, 212, 143, 176, 108, 192, 128, 158, 116, 203, 139];
    skyline.forEach((height, index) => {
      const x = index * 67 - 8;
      const top = 354 - height;
      const color = index % 3 === 0 ? '#252541' : index % 3 === 1 ? '#302945' : '#392b49';
      pixel(ctx, x, top, 59, height, color);
      pixel(ctx, x + 5, top - 8, 24, 8, color);
      for (let row = 0; row < Math.floor((height - 22) / 22); row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const lit = (row * 3 + col + index) % 4 !== 0;
          pixel(ctx, x + 9 + col * 16, top + 17 + row * 22, 7, 10,
            lit ? (index % 2 ? '#f0ad72' : '#e58b73') : '#39324c');
        }
      }
    });

    pixel(ctx, 0, 348, 960, 14, '#a34a5e');
    pixel(ctx, 0, 359, 960, 14, '#eb916d');
    pixel(ctx, 0, 373, 960, 112, '#4b3a55');
    pixel(ctx, 0, 373, 960, 7, '#f1b379');
    pixel(ctx, 0, 480, 960, 16, '#372d4b');
    pixel(ctx, 0, 496, 960, 44, '#25263d');
    pixel(ctx, 0, 496, 960, 5, '#cf735f');

    for (let row = 0; row < 6; row += 1) {
      const y = 388 + row * 16;
      const inset = row * 10;
      for (let column = -1; column < 14; column += 1) {
        const x = column * 78 + (row % 2) * 39 + inset;
        pixel(ctx, x, y, 2, 14, row % 2 ? '#695064' : '#685064');
      }
      pixel(ctx, 0, y + 14, 960, 2, '#40344e');
    }
    for (let index = 0; index < 38; index += 1) {
      const x = index * 27;
      pixel(ctx, x, 503, 14, 3, index % 2 ? '#f2b66f' : '#d47a65');
      pixel(ctx, x + 4, 514, 7, 2, '#827083');
    }

    pixel(ctx, 42, 259, 8, 104, '#542e4a');
    pixel(ctx, 29, 246, 36, 12, '#d96863');
    pixel(ctx, 20, 239, 54, 8, '#f3b56f');
    pixel(ctx, 909, 259, 8, 104, '#542e4a');
    pixel(ctx, 896, 246, 36, 12, '#d96863');
    pixel(ctx, 887, 239, 54, 8, '#f3b56f');

    for (let index = 0; index < 16; index += 1) {
      const x = index * 61 + 8;
      const width = index % 3 === 0 ? 16 : 12;
      pixel(ctx, x, 347, width, 15, '#181b31');
      pixel(ctx, x + 2, 340, width - 4, 9, '#181b31');
      pixel(ctx, x + 4, 343, 2, 3, '#e6a176');
    }
  }

  function staticBackground() {
    if (typeof document === 'undefined') return null;
    if (backgroundCanvas) return backgroundCanvas;
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const context = canvas.getContext('2d');
    if (!context) return null;
    drawBackgroundBase(context);
    backgroundCanvas = canvas;
    return backgroundCanvas;
  }

  function drawBackground(ctx, frame, reducedMotion, boutNumber) {
    [
      [-540, 105, '#171b39'], [-435, 100, '#202344'], [-335, 91, '#302947'],
      [-244, 85, '#4c3450'], [-159, 80, '#70415b']
    ].forEach(([y, height, color]) => pixel(ctx, 0, y, 960, height, color));
    for (let index = 0; index < 30; index += 1) {
      const x = (index * 97 + (index * 31 % 43)) % 940;
      const y = -510 + (index * 67 % 410);
      pixel(ctx, x, y, index % 5 === 0 ? 4 : 2, index % 4 === 0 ? 4 : 2,
        index % 3 === 0 ? '#e8a771' : '#a98caa');
    }
    [[115, -390], [438, -295], [724, -455]].forEach(([x, y], index) => {
      pixel(ctx, x, y, 52, 8, index % 2 ? '#72718d' : '#85819a');
      pixel(ctx, x + 14, y - 7, 33, 7, index % 2 ? '#72718d' : '#85819a');
      pixel(ctx, x + 8, y + 8, 29, 5, '#4c496c');
    });
    const stage = pixelStage(boutNumber);
    if (stage) {
      const smoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(stage, 0, 0, 960, 540);
      ctx.imageSmoothingEnabled = smoothing;
      return;
    }
    const background = staticBackground();
    if (background) {
      const smoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(background, 0, 0);
      ctx.imageSmoothingEnabled = smoothing;
    }
    else drawBackgroundBase(ctx);
    ctx.globalAlpha = 0.14;
    for (let index = 0; index < 35; index += 1) {
      const x = (index * 127 + (reducedMotion ? 0 : frame * 0.28)) % 960;
      pixel(ctx, x, 395 + (index * 29 % 126), 31, 3, '#b5d5dc');
    }
    ctx.globalAlpha = 1;
  }

  function drawImpact(ctx, effect, frame, reducedMotion) {
    const age = frame - effect.frame;
    if (age < 0 || age > 10) return;
    const growth = reducedMotion ? 0 : Math.floor(age / 2) * 3;
    const size = reducedMotion ? 4 : Math.max(2, 5 - Math.floor(age / 3));
    const radius = 9 + growth;
    const color = effect.type === 'blocked' ? '#a9eaff' : '#ffe2a1';
    ctx.save();
    ctx.globalAlpha = reducedMotion ? 0.78 : 1 - age / 11;
    pixel(ctx, effect.x - size / 2, effect.y - size / 2, size, size, '#fff8d8');
    pixel(ctx, effect.x - radius, effect.y - 2, size, size, color);
    pixel(ctx, effect.x + radius - size, effect.y - 2, size, size, color);
    pixel(ctx, effect.x - 2, effect.y - radius, size, size, color);
    pixel(ctx, effect.x - 2, effect.y + radius - size, size, size, color);
    if (!reducedMotion) {
      pixel(ctx, effect.x - radius * 0.7, effect.y - radius * 0.7, size, size, color);
      pixel(ctx, effect.x + radius * 0.7, effect.y + radius * 0.7, size, size, color);
    }
    ctx.restore();
  }

  function draw(context, match, frame = 0, effects = [], options = {}) {
    if (!context || !match || !match.duel) return;
    const reducedMotion = Boolean(motionQuery && motionQuery.matches);
    context.imageSmoothingEnabled = false;
    drawBackground(context, frame, reducedMotion, match.boutNumber);
    drawFighter(context, match.duel.left, 'left', frame, reducedMotion, Boolean(options.portrait));
    drawFighter(context, match.duel.right, 'right', frame, reducedMotion, Boolean(options.portrait));
    effects.forEach((effect) => drawImpact(context, effect, frame, reducedMotion));
  }

  globalThis.CenFighterRenderer = Object.freeze({ draw });
})();
