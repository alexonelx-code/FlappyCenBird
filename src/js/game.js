(() => {
  'use strict';

  /* ---------------------------------------------------------------
     Configuración
  --------------------------------------------------------------- */
  const W = 360;
  const H = 640;
  const FLOOR_Y = 544;         // altura del suelo
  const PIPE_W = 62;
  const BIRD_X = 96;
  const GRAVITY = 1500;
  const FLAP_V = -430;
  const SPAWN_DIST = 210;      // separación entre tuberías (px)
  const STORAGE_KEY = 'flappy_best_v1';
  const BEST_MIGRATION_KEY = 'flappy_best_migrated_v2';
  const gameScreen = document.getElementById('gameScreen');

  function playerBestKey() {
    const name = window.FlappyUI.getPlayerName().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    return `${STORAGE_KEY}:player:${encodeURIComponent(name || 'jugador')}`;
  }

  function loadPlayerBest() {
    if (!window.FlappyUI.hasPlayerName()) return 0;
    try {
      const saved = localStorage.getItem(playerBestKey());
      if (saved !== null) return Math.max(0, parseInt(saved, 10) || 0);

      // Conserva el récord anterior en la primera cuenta que entre al portal.
      if (localStorage.getItem(BEST_MIGRATION_KEY) !== 'true') {
        const legacy = Math.max(0, parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0);
        if (legacy > 0) localStorage.setItem(playerBestKey(), String(legacy));
        localStorage.setItem(BEST_MIGRATION_KEY, 'true');
        return legacy;
      }
    } catch (e) {}
    return 0;
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const sfx = window.FlappyAudio;
  let skyGrad;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(W * dpr);
    const height = Math.round(H * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    skyGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    skyGrad.addColorStop(0, '#1b394b');
    skyGrad.addColorStop(0.58, '#4f7880');
    skyGrad.addColorStop(1, '#efa47e');
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas, { passive: true });

  /* ---------------------------------------------------------------
     Estado
  --------------------------------------------------------------- */
  let best = loadPlayerBest();

  let state = 'ready';        // ready | playing | dying | gameover
  let score = 0;
  let newBest = false;
  let t = 0;
  let gameOverAt = -99;
  let groundOff = 0;
  let spawnDist = 140;
  let shake = 0;
  let flash = 0;
  let scorePop = 0;

  function emitState() {
    window.dispatchEvent(new CustomEvent('flappy:state', {
      detail: { state, score, best }
    }));
  }

  const bird = { x: BIRD_X, y: 330, vy: 0, rot: 0, wing: 0, wingSpeed: 9 };
  let pipes = [];

  /* ---------------------------------------------------------------
     Personaje (sprite recortado de la foto)
  --------------------------------------------------------------- */
  const SPR = {
    pngW: 182,
    pngH: 260,
    anchor: { x: 92, y: 140 },
    pivL: { x: 33.9, y: 86.6 },
    pivR: { x: 150.9, y: 85.1 },
    webL: { piv: { x: 33.9, y: 86.6 }, innerX: 40, hemY: 164, dir: 1,
            edge: [[33.9, 86.6], [33.9, 110], [32.3, 136.6], [31.7, 164]], col: '#15233a' },
    webR: { piv: { x: 150.9, y: 85.1 }, innerX: 145.5, hemY: 164, dir: -1,
            edge: [[150.9, 85.1], [151.3, 105.9], [152.1, 136.6], [151.7, 164]], col: '#1e2f49' },
    height: 110,
    body: new Image(),
    armL: new Image(),
    armR: new Image(),
    ready: false
  };
  (() => {
    let n = 0;
    const done = () => { if (++n === 3) SPR.ready = true; };
    SPR.body.onload = done;
    SPR.armL.onload = done;
    SPR.armR.onload = done;
    SPR.body.src = 'assets/images/personaje/cuerpo.png';
    SPR.armL.src = 'assets/images/personaje/brazo_i.png';
    SPR.armR.src = 'assets/images/personaje/brazo_d.png';
  })();
  let particles = [];
  let clouds = [];

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 7; i++) {
      clouds.push({
        x: Math.random() * (W + 160) - 80,
        y: 30 + Math.random() * 270,
        s: 0.55 + Math.random() * 0.85,
        v: 6 + Math.random() * 12
      });
    }
  }
  initClouds();


  /* ---------------------------------------------------------------
     Lógica del juego
  --------------------------------------------------------------- */
  function addPipe() {
    const gap = Math.max(160, 196 - score * 1.6);
    const minY = 70 + gap / 2;
    const maxY = FLOOR_Y - 70 - gap / 2;
    const gapY = minY + Math.random() * (maxY - minY);
    pipes.push({ x: W + 40, gapY, gap, scored: false });
  }

  function pipeSpeed() {
    return 148 + Math.min(score * 1.7, 56);
  }

  function resetGame() {
    state = 'ready';
    score = 0;
    best = loadPlayerBest();
    newBest = false;
    pipes = [];
    particles = [];
    shake = 0;
    flash = 0;
    scorePop = 0;
    spawnDist = 140;
    groundOff = 0;
    bird.y = 330;
    bird.vy = 0;
    bird.rot = 0;
    bird.wing = 0;
    bird.wingSpeed = 9;
    gameOverAt = -99;
    emitState();
    render();
    scheduleFrame();
  }

  function startGame() {
    state = 'playing';
    score = 0;
    best = loadPlayerBest();
    newBest = false;
    pipes = [];
    particles = [];
    spawnDist = 140;
    groundOff = 0;
    shake = 0;
    flash = 0;
    scorePop = 0;
    bird.y = 300;
    bird.vy = 0;
    bird.rot = 0;
    bird.wing = 0;
    bird.wingSpeed = 9;
    gameOverAt = -99;
    emitState();
  }

  function flap() {
    bird.vy = FLAP_V;
    bird.wingSpeed = 26;
    bird.wing = 0;
    sfx.flap();
  }

  function die() {
    if (state !== 'playing') return;
    state = 'dying';
    bird.vy = -190;
    shake = 11;
    flash = 1;
    sfx.hit();
    sfx.die();
    spawnFeathers();
    if (score > best) {
      best = score;
      newBest = true;
      try { localStorage.setItem(playerBestKey(), String(best)); } catch (e) {}
    }
    emitState();
  }

  function spawnFeathers() {
    for (let i = 0; i < 16; i++) {
      const life = 0.7 + Math.random() * 0.5;
      particles.push({
        x: bird.x,
        y: bird.y,
        vx: (Math.random() - 0.35) * 230,
        vy: -Math.random() * 280 - 20,
        gravity: 850,
        life,
        max: life,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 12,
        size: 2.5 + Math.random() * 3.5,
        color: Math.random() < 0.5 ? '#ffe066' : '#fff6cf'
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function update(dt) {
    t += dt;
    shake = Math.max(0, shake - dt * 34);
    flash = Math.max(0, flash - dt * 3.4);
    scorePop = Math.max(0, scorePop - dt * 3.2);

    for (const c of clouds) {
      c.x -= c.v * dt;
      if (c.x < -100) {
        c.x = W + 40 + Math.random() * 90;
        c.y = 30 + Math.random() * 270;
        c.s = 0.55 + Math.random() * 0.85;
      }
    }

    updateParticles(dt);

    if (state === 'ready') {
      bird.y = 330 + Math.sin(t * 2.6) * 8;
      bird.rot = Math.sin(t * 2.6) * 0.07;
      bird.wingSpeed = 9;
      bird.wing += dt * bird.wingSpeed;
    } else if (state === 'playing') {
      physics(dt);
    } else if (state === 'dying') {
      const profile = birdProfile();
      bird.vy = Math.min(bird.vy + GRAVITY * dt, 950);
      bird.y += bird.vy * dt;
      bird.rot = Math.min(bird.rot + 4.5 * dt, 1.65);
      bird.wing += dt * 4;

      if (bird.y + profile.bottom >= FLOOR_Y) {
        bird.y = FLOOR_Y - profile.bottom;
        state = 'gameover';
        gameOverAt = t;
        shake = Math.max(shake, 7);
        emitState();
      }
    }
  }

  function physics(dt) {
    const speed = pipeSpeed();
    const profile = birdProfile();

    bird.vy = Math.min(bird.vy + GRAVITY * dt, 780);
    bird.y += bird.vy * dt;
    bird.rot = Math.max(-0.5, Math.min(1.45, (bird.vy / 700) * 1.25));
    bird.wingSpeed += (7 - bird.wingSpeed) * Math.min(1, dt * 4);
    bird.wing += dt * bird.wingSpeed;

    if (bird.y < profile.top) {
      bird.y = profile.top;
      bird.vy = Math.max(bird.vy, 0);
    }

    groundOff += speed * dt;
    spawnDist += speed * dt;
    if (spawnDist >= SPAWN_DIST) {
      spawnDist -= SPAWN_DIST;
      addPipe();
    }

    for (const p of pipes) p.x -= speed * dt;
    pipes = pipes.filter(p => p.x > -PIPE_W - 30);

    for (const p of pipes) {
      if (!p.scored && p.x + PIPE_W < bird.x - 5) {
        p.scored = true;
        score++;
        scorePop = 1;
        sfx.score();
        window.dispatchEvent(new CustomEvent('flappy:score', { detail: { score } }));
        emitState();
      }

      if (p.x < bird.x + 48 && p.x + PIPE_W > bird.x - 48) {
        const topY = p.gapY - p.gap / 2;
        const botY = p.gapY + p.gap / 2;
        for (const [oy, hitRadius] of profile.hits) {
          if (circleRect(bird.x, bird.y + oy, hitRadius, p.x, -400, PIPE_W, topY + 400) ||
              circleRect(bird.x, bird.y + oy, hitRadius, p.x, botY, PIPE_W, FLOOR_Y - botY + 40)) {
            die();
            return;
          }
        }
      }
    }

    if (bird.y + profile.bottom >= FLOOR_Y) die();
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  const BIRD_PROFILES = {
    friend: { top: 60, bottom: 52, hits: [[-34, 18], [-6, 20], [29, 19]] },
    bird: { top: 22, bottom: 22, hits: [[-8, 12], [3, 13], [14, 12]] }
  };

  function birdProfile() {
    return window.FlappyUI.getCharacter() === 'friend' ? BIRD_PROFILES.friend : BIRD_PROFILES.bird;
  }

  /* ---------------------------------------------------------------
     Entrada
  --------------------------------------------------------------- */
  function press() {
    sfx.unlock(); // desbloquea el audio en móviles
    if (state === 'ready') {
      startGame();
      flap();
    } else if (state === 'playing') {
      flap();
    } else if (state === 'gameover') {
      startGame();
      flap();
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    press();
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (gameScreen.hidden) return;
    if (document.getElementById('leaderboardDialog').open) return;
    const target = e.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      press();
    } else if (e.code === 'KeyR') {
      resetGame();
    } else if (e.code === 'KeyM') {
      sfx.toggleMute();
    }
  });

  document.getElementById('retryButton').addEventListener('click', () => {
    if (state !== 'gameover') return;
    sfx.unlock();
    startGame();
    flap();
  });

  /* ---------------------------------------------------------------
     Dibujo: utilidades
  --------------------------------------------------------------- */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, fill, stroke, lw, align) {
    ctx.font = 'bold ' + size + 'px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    if (stroke && lw) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  /* ---------------------------------------------------------------
     Dibujo: escenario
  --------------------------------------------------------------- */
  function drawSky() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, FLOOR_Y);
  }

  function drawSun() {
    const cx = 286, cy = 104;
    ctx.fillStyle = '#f4b975';
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 226, 184, .72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 37, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(95, 70, 72, .28)';
    ctx.fillRect(cx - 17, cy + 4, 34, 3);
    ctx.fillRect(cx - 12, cy + 11, 24, 2);
  }

  function drawClouds() {
    for (const c of clouds) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.s, c.s);
      ctx.fillStyle = 'rgba(255, 229, 202, .24)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.arc(20, 4, 14, 0, Math.PI * 2);
      ctx.arc(-20, 5, 13, 0, Math.PI * 2);
      ctx.arc(5, -11, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function hillPath(off, base, amp, freq) {
    ctx.beginPath();
    ctx.moveTo(-12, FLOOR_Y + 2);
    for (let x = -12; x <= W + 12; x += 6) {
      const y = base
        - Math.sin((x + off) * freq) * amp
        - Math.sin((x + off) * freq * 2.7) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 12, FLOOR_Y + 2);
    ctx.closePath();
  }

  function drawHills() {
    ctx.fillStyle = '#426a68';
    hillPath(groundOff * 0.16, 476, 26, 0.0085);
    ctx.fill();

    ctx.fillStyle = '#244b50';
    hillPath(groundOff * 0.3, 512, 20, 0.0135);
    ctx.fill();

    // Silueta de palapa para darle al paisaje una referencia propia.
    ctx.fillStyle = '#1c4148';
    ctx.fillRect(52, 459, 8, 39);
    ctx.beginPath();
    ctx.moveTo(33, 466);
    ctx.quadraticCurveTo(56, 438, 80, 466);
    ctx.quadraticCurveTo(55, 458, 33, 466);
    ctx.fill();
  }

  function pipeGradient(x, w) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#8f454c');
    g.addColorStop(0.18, '#f28c68');
    g.addColorStop(0.48, '#d9655c');
    g.addColorStop(0.82, '#b44f52');
    g.addColorStop(1, '#783b49');
    return g;
  }

  function pipeBody(x, y, w, h) {
    if (h <= 0) return;
    ctx.fillStyle = pipeGradient(x, w);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(65, 41, 52, .16)';
    ctx.fillRect(x + w - 8, y, 6, h);
    ctx.fillStyle = 'rgba(255, 218, 174, .28)';
    ctx.fillRect(x + 6, y, 3, h);
    ctx.strokeStyle = '#523641';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y);
    ctx.lineTo(x + 1, y + h);
    ctx.moveTo(x + w - 1, y);
    ctx.lineTo(x + w - 1, y + h);
    ctx.stroke();
  }

  function pipeCap(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, .18)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = pipeGradient(x, w);
    rr(x, y, w, h, 5);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#523641';
    ctx.lineWidth = 2;
    rr(x + 1, y + 1, w - 2, h - 2, 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 216, 164, .72)';
    ctx.fillRect(x + 8, y + 7, w - 16, 3);

    ctx.strokeStyle = 'rgba(255, 225, 188, .55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 5);
    ctx.lineTo(x + 7, y + h - 6);
    ctx.stroke();
  }

  function drawPipes() {
    for (const p of pipes) {
      const topH = p.gapY - p.gap / 2;
      const botY = p.gapY + p.gap / 2;

      pipeBody(p.x, 0, PIPE_W, topH - 22);
      pipeCap(p.x - 5, topH - 24, PIPE_W + 10, 26);

      pipeCap(p.x - 5, botY, PIPE_W + 10, 26);
      pipeBody(p.x, botY + 24, PIPE_W, FLOOR_Y - botY - 20);
    }
  }

  function drawGround() {
    const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    g.addColorStop(0, '#3e5751');
    g.addColorStop(1, '#213a3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // Borde de la costa en coral, con una línea oscura para separar el suelo.
    ctx.fillStyle = '#e27b5e';
    ctx.fillRect(0, FLOOR_Y, W, 13);
    ctx.fillStyle = '#6c4246';
    ctx.fillRect(0, FLOOR_Y + 13, W, 4);
    ctx.fillStyle = 'rgba(255, 229, 190, .34)';
    ctx.fillRect(0, FLOOR_Y, W, 3);

    // rayas diagonales
    const step = 34;
    const off = -(((groundOff % step) + step) % step);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FLOOR_Y + 17, W, H - FLOOR_Y - 17);
    ctx.clip();
    ctx.fillStyle = 'rgba(237, 190, 132, .10)';
    for (let x = -step * 2 + off; x < W + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR_Y + 17);
      ctx.lineTo(x + 17, FLOOR_Y + 17);
      ctx.lineTo(x + 17 - 26, H);
      ctx.lineTo(x - 26, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(0, 0, 0, .18)';
    ctx.fillRect(0, FLOOR_Y + 17, W, 2);
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Dibujo: pájaro
  --------------------------------------------------------------- */
  function drawBird() {
    const character = window.FlappyUI.getCharacter();
    if (character !== 'friend' || !SPR.ready) {
      drawBirdClassic(character);
      return;
    }

    const s = SPR.height / SPR.pngH;
    const amp = 0.5 - 0.5 * Math.cos(bird.wing);
    const ang = (24 * amp) * Math.PI / 180;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    ctx.shadowColor = 'rgba(9, 24, 31, .48)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    // web, arms and body, in that order: the body covers every seam
    drawWeb(SPR.webL, ang, s);
    drawWeb(SPR.webR, -ang, s);
    drawArm(SPR.armL, SPR.pivL, ang, s);
    drawArm(SPR.armR, SPR.pivR, -ang, s);

    ctx.drawImage(
      SPR.body,
      -SPR.anchor.x * s, -SPR.anchor.y * s,
      SPR.pngW * s, SPR.pngH * s
    );

    ctx.restore();
  }

  // tela de la camiseta entre el torso y el brazo levantado
  function drawWeb(w, ang, s) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const dx = w.innerX - w.piv.x, dy = w.hemY - w.piv.y;
    const ax = w.piv.x + dx * c - dy * sn;
    const ay = w.piv.y + dx * sn + dy * c;

    ctx.save();
    ctx.translate(-SPR.anchor.x * s, -SPR.anchor.y * s);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(w.piv.x, w.piv.y);
    for (const p of w.edge) ctx.lineTo(p[0] + 2 * w.dir, p[1]);
    ctx.lineTo(ax, ay);
    ctx.closePath();
    ctx.fillStyle = w.col;
    ctx.fill();
    ctx.restore();
  }

  function drawArm(img, piv, ang, s) {
    ctx.save();
    ctx.translate((piv.x - SPR.anchor.x) * s, (piv.y - SPR.anchor.y) * s);
    ctx.rotate(ang);
    ctx.drawImage(img, -piv.x * s, -piv.y * s, SPR.pngW * s, SPR.pngH * s);
    ctx.restore();
  }

  function drawBirdClassic(character) {
    const styles = {
      classic: {
        light: '#fff0cf', mid: '#e8ae5d', dark: '#ca704c', edge: '#503747',
        wing: '#fff0d0', wingEdge: '#9e5c4d', beak: '#f08757', beakEdge: '#793f4a',
        tail: '#edbd72', cheek: 'rgba(240, 127, 92, .4)'
      },
      laguna: {
        light: '#d9f2dd', mid: '#62b8a6', dark: '#287b7c', edge: '#214c59',
        wing: '#f0e9cf', wingEdge: '#47817c', beak: '#f08757', beakEdge: '#793f4a',
        tail: '#66c3b0', cheek: 'rgba(240, 127, 92, .42)'
      },
      mango: {
        light: '#ffe0bd', mid: '#e9825d', dark: '#ad4f54', edge: '#513649',
        wing: '#fff0d8', wingEdge: '#a34e51', beak: '#f5bd72', beakEdge: '#805042',
        tail: '#ec9265', cheek: 'rgba(255, 224, 174, .48)'
      },
      nube: {
        light: '#eef6e8', mid: '#9abbd3', dark: '#597e9a', edge: '#3e5d78',
        wing: '#f8f4df', wingEdge: '#6f92a3', beak: '#f2b86f', beakEdge: '#805042',
        tail: '#b8cee0', cheek: 'rgba(255, 220, 177, .45)'
      }
    };
    const style = styles[character] || styles.classic;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    ctx.scale(1.18, 1.18);

    // sombra suave
    ctx.fillStyle = 'rgba(0, 0, 0, .10)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // cola
    ctx.beginPath();
    ctx.moveTo(-12.5, -4);
    ctx.quadraticCurveTo(-20, -7.5, -22, -4.5);
    ctx.quadraticCurveTo(-18, -1.5, -21, 2.5);
    ctx.quadraticCurveTo(-17, 2.5, -12, 1.5);
    ctx.closePath();
    ctx.fillStyle = style.tail;
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // cuerpo
    ctx.fillStyle = style.mid;
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pecho claro en una sola forma, como marca de cada personaje.
    ctx.fillStyle = style.light;
    ctx.beginPath();
    ctx.ellipse(-4, 5, 7.5, 5.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // ala
    const wing = Math.sin(bird.wing) * 7;
    ctx.save();
    ctx.translate(-3, 1.5);
    ctx.rotate(-0.32 + Math.sin(bird.wing) * 0.24);
    ctx.beginPath();
    ctx.ellipse(0, wing * 0.35, 8.6, 5.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = style.wing;
    ctx.fill();
    ctx.strokeStyle = style.wingEdge;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3.5, wing * 0.35 + 1.6);
    ctx.lineTo(3.5, wing * 0.35 + 1.6);
    ctx.strokeStyle = style.wingEdge;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // mejilla
    ctx.beginPath();
    ctx.arc(2.5, 2.5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = style.cheek;
    ctx.fill();

    // ojo
    ctx.beginPath();
    ctx.arc(6, -5.8, 5.1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(7.7, -5.8, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = '#33251a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(8.6, -6.8, 0.85, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // pico
    ctx.beginPath();
    ctx.moveTo(11, -1.5);
    ctx.quadraticCurveTo(20, -1.5, 19.5, 2.5);
    ctx.quadraticCurveTo(16, 5.5, 10.5, 3);
    ctx.closePath();
    ctx.fillStyle = style.beak;
    ctx.fill();
    ctx.strokeStyle = style.beakEdge;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    // plumas de la cabeza
    ctx.beginPath();
    ctx.moveTo(1, -12.5);
    ctx.quadraticCurveTo(0.5, -16.5, 3.5, -16);
    ctx.moveTo(5, -12.8);
    ctx.quadraticCurveTo(6, -16, 9, -15);
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------------------------------------------------------
     Dibujo: interfaz
  --------------------------------------------------------------- */
  function drawBigScore() {
    const s = 1 + scorePop * 0.16;
    ctx.save();
    ctx.translate(W / 2, 86);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0, 0, 0, .25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    text(String(score), 0, 0, 54, '#fff0d1', 'rgba(18, 43, 52, .7)', 8);
    ctx.restore();
  }

  function drawReady() {
    // Identidad del minijuego y récord personal.
    ctx.save();
    ctx.shadowColor = 'rgba(11, 29, 36, .42)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 3;
    text('FLAPPY BIRDCEN', W / 2, 158 + Math.sin(t * 2) * 1.5, 30, '#fff0d1', '#284a50', 5);
    ctx.restore();

    text('ALETEA Y HAZ HISTORIA', W / 2, 190, 12, '#f6c28d');

    ctx.fillStyle = 'rgba(17, 45, 53, .78)';
    rr(W / 2 - 88, 222, 176, 36, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 225, 186, .3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    text('RÉCORD  ·  ' + best, W / 2, 240, 13, '#f7d49f');

    const pulse = 0.94 + 0.06 * Math.sin(t * 2.6);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#f2b86f';
    rr(W / 2 - 104, 450, 208, 48, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 238, 203, .32)';
    rr(W / 2 - 96, 455, 192, 2, 1);
    ctx.fill();
    ctx.restore();

    text('TOCA PARA JUGAR', W / 2, 474, 15, '#243d43');
    text('ESPACIO  ·  FLECHA ↑  ·  W', W / 2, 520, 11, '#f6e4c9', 'rgba(26, 53, 59, .45)', 3);
  }

  function starPath(cx, cy, spikes, outer, inner) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    for (let i = 0; i < spikes; i++) {
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    }
    ctx.closePath();
  }

  function medalColors(s) {
    if (s >= 40) return { top: '#effdff', bottom: '#7fd3e6', edge: '#3f9db3' };
    if (s >= 20) return { top: '#fff0b3', bottom: '#eeb020', edge: '#a87a0d' };
    if (s >= 10) return { top: '#ffffff', bottom: '#b6c3cf', edge: '#7d8b99' };
    if (s >= 5)  return { top: '#f6c995', bottom: '#bf7431', edge: '#84491a' };
    return null;
  }

  function drawMedal(cx, cy, r, scoreValue) {
    const c = medalColors(scoreValue);
    if (!c) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(140, 115, 70, .12)';
      ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(140, 115, 70, .45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      starPath(cx, cy - 5, 5, r * 0.43, r * 0.19);
      ctx.strokeStyle = 'rgba(230, 196, 137, .72)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text('5', cx, cy + 20, 10, 'rgba(255, 225, 176, .84)');
      return;
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, .22)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 4;

    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.15, cx, cy, r);
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, .55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    starPath(cx, cy + 1, 5, r * 0.46, r * 0.2);
    ctx.fillStyle = 'rgba(255, 255, 255, .9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, .12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // brillo
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, .8)';
    ctx.fill();
  }

  function drawGameOver() {
    const px = 28, py = 145, pw = 304, ph = 315;

    ctx.save();
    ctx.shadowColor = 'rgba(8, 23, 30, .36)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#132e37';
    rr(px, py, pw, ph, 16);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#edbd78';
    ctx.lineWidth = 2;
    rr(px, py, pw, ph, 16);
    ctx.stroke();

    ctx.fillStyle = 'rgba(242, 184, 111, .12)';
    ctx.beginPath();
    ctx.arc(W / 2, py + 34, 19, 0, Math.PI * 2);
    ctx.fill();
    starPath(W / 2, py + 34, 5, 9, 4);
    ctx.fillStyle = '#f2b86f';
    ctx.fill();
    text(score > 0 ? 'VUELO TERMINADO' : 'CASI, CASI', W / 2, py + 68, 20, '#fff0d1');
    text(newBest ? '¡NUEVO RÉCORD!' : 'VUELVE A INTENTARLO', W / 2, py + 89, 10, '#b8c7bd');

    // El resultado y la recompensa comparten una tarjeta para que cada vuelo se lea de un vistazo.
    ctx.fillStyle = '#203d43';
    rr(48, 244, 170, 58, 11);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 201, 142, .3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    text('PUNTOS', 62, 263, 10, '#f2c78d', null, 0, 'left');
    text(String(score), 202, 276, 29, '#fff0d1', null, 0, 'right');

    ctx.fillStyle = '#203d43';
    rr(48, 311, 170, 48, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 201, 142, .3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    text('RÉCORD', 62, 340, 10, newBest ? '#f2b86f' : '#d0b991', null, 0, 'left');
    text(String(best), 202, 343, 20, '#fff0d1', null, 0, 'right');

    ctx.fillStyle = 'rgba(242, 184, 111, .075)';
    rr(232, 244, 80, 115, 14);
    ctx.fill();
    drawMedal(272, 294, 34, score);
    text(score >= 40 ? 'LEYENDA' : score >= 20 ? 'ORO' : score >= 10 ? 'PLATA' : score >= 5 ? 'BRONCE' : 'META: 5', 272, 347, 9, '#d7c49f');

    const rewardY = 372;
    ctx.fillStyle = 'rgba(242, 184, 111, .15)';
    rr(48, rewardY, 264, 32, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 184, 111, .28)';
    ctx.lineWidth = 1;
    rr(48, rewardY, 264, 32, 10);
    ctx.stroke();
    text(`¢  +${score} CENT`, W / 2, rewardY + 16, 12, '#ffd38f');

    const buttons = window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches ? [] : [
      { y: 418, fill: '#f2b86f', label: 'REVANCHA', color: '#243d43' }
    ];
    for (const button of buttons) {
      const bx = W / 2 - 120, bw = 240, bh = 44;
      ctx.fillStyle = button.fill;
      rr(bx, button.y, bw, bh, 15);
      ctx.fill();
      ctx.strokeStyle = button.fill === '#f2b86f' ? 'rgba(255, 240, 209, .58)' : 'rgba(255, 240, 209, .3)';
      ctx.lineWidth = 1;
      rr(bx + 1, button.y + 1, bw - 2, bh - 2, 14);
      ctx.stroke();
      text(button.label, W / 2, button.y + bh / 2 + 1, 14, button.color);
    }
  }

  window.FlappyGame = Object.freeze({
    reset: resetGame,
    getBestScore() { return loadPlayerBest(); }
  });

  /* ---------------------------------------------------------------
     Render
  --------------------------------------------------------------- */
  function render() {
    ctx.save();
    if (shake > 0.15) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    drawSky();
    drawSun();
    drawClouds();
    drawHills();
    drawPipes();
    drawGround();
    drawParticles();
    drawBird();

    ctx.restore();

    if (state === 'ready') drawReady();
    if (state === 'playing' || state === 'dying' || state === 'gameover') drawBigScore();
    if (state === 'gameover') drawGameOver();

    if (flash > 0.01) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (flash * 0.55) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------------------------------------------------------
     Bucle principal
  --------------------------------------------------------------- */
  let last = performance.now();
  let frameId = 0;

  function scheduleFrame() {
    if (!frameId && !document.hidden && !gameScreen.hidden) frameId = requestAnimationFrame(frame);
  }

  function frame(now) {
    frameId = 0;
    if (document.hidden || gameScreen.hidden) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    const gamePaused = document.getElementById('leaderboardDialog').open
      || document.getElementById('gameMenuDialog').open
      || document.getElementById('storeDialog').open;
    if (!gamePaused) update(dt);
    render();

    scheduleFrame();
  }

  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    if (document.hidden) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    } else {
      scheduleFrame();
    }
  });

  emitState();
  scheduleFrame();
})();
