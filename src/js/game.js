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
    skyGrad.addColorStop(0, '#35b2c7');
    skyGrad.addColorStop(0.55, '#79d8e3');
    skyGrad.addColorStop(1, '#c2eff1');
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas, { passive: true });

  /* ---------------------------------------------------------------
     Estado
  --------------------------------------------------------------- */
  let best = 0;
  try { best = Math.max(0, parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0); } catch (e) {}

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
    height: 102,
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
    const gap = Math.max(150, 196 - score * 2.4);
    const minY = 70 + gap / 2;
    const maxY = FLOOR_Y - 70 - gap / 2;
    const gapY = minY + Math.random() * (maxY - minY);
    pipes.push({ x: W + 40, gapY, gap, scored: false });
  }

  function pipeSpeed() {
    return 152 + Math.min(score * 2.2, 68);
  }

  function resetGame() {
    state = 'ready';
    score = 0;
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
  }

  function startGame() {
    state = 'playing';
    score = 0;
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
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) {}
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
      bird.vy = Math.min(bird.vy + GRAVITY * dt, 950);
      bird.y += bird.vy * dt;
      bird.rot = Math.min(bird.rot + 4.5 * dt, 1.65);
      bird.wing += dt * 4;

      if (bird.y + 42 >= FLOOR_Y) {
        bird.y = FLOOR_Y - 42;
        state = 'gameover';
        gameOverAt = t;
        shake = Math.max(shake, 7);
        emitState();
      }
    }
  }

  function physics(dt) {
    const speed = pipeSpeed();

    bird.vy = Math.min(bird.vy + GRAVITY * dt, 780);
    bird.y += bird.vy * dt;
    bird.rot = Math.max(-0.5, Math.min(1.45, (bird.vy / 700) * 1.25));
    bird.wingSpeed += (7 - bird.wingSpeed) * Math.min(1, dt * 4);
    bird.wing += dt * bird.wingSpeed;

    if (bird.y < 52) {
      bird.y = 52;
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

    const r = 11;
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
        const hits = [[-32, 17.5], [-9, 18], [14, 17.5]];
        for (const [oy, rr] of hits) {
          if (circleRect(bird.x, bird.y + oy, rr, p.x, -400, PIPE_W, topY + 400) ||
              circleRect(bird.x, bird.y + oy, rr, p.x, botY, PIPE_W, FLOOR_Y - botY + 40)) {
            die();
            return;
          }
        }
      }
    }

    if (bird.y + 42 >= FLOOR_Y) die();
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
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
    if (document.getElementById('playerDialog').open) return;
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
    const cx = 288, cy = 92;
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 78);
    glow.addColorStop(0, 'rgba(255, 246, 190, .85)');
    glow.addColorStop(0.35, 'rgba(255, 240, 160, .35)');
    glow.addColorStop(1, 'rgba(255, 240, 160, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 78, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 252, 224, .95)';
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds() {
    for (const c of clouds) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.s, c.s);
      ctx.fillStyle = 'rgba(255, 255, 255, .82)';
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
    ctx.fillStyle = '#a9e58c';
    hillPath(groundOff * 0.16, 476, 26, 0.0085);
    ctx.fill();

    ctx.fillStyle = '#83d45c';
    hillPath(groundOff * 0.3, 512, 20, 0.0135);
    ctx.fill();
  }

  function pipeGradient(x, w) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#3d8823');
    g.addColorStop(0.18, '#84d94e');
    g.addColorStop(0.45, '#5cb634');
    g.addColorStop(0.8, '#3d8d25');
    g.addColorStop(1, '#2a6618');
    return g;
  }

  function pipeBody(x, y, w, h) {
    if (h <= 0) return;
    ctx.fillStyle = pipeGradient(x, w);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#20510f';
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

    ctx.strokeStyle = '#20510f';
    ctx.lineWidth = 2;
    rr(x + 1, y + 1, w - 2, h - 2, 4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
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
    g.addColorStop(0, '#e9dc92');
    g.addColorStop(1, '#d6c164');
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // franja de césped
    ctx.fillStyle = '#7fce38';
    ctx.fillRect(0, FLOOR_Y, W, 13);
    ctx.fillStyle = '#5ba72a';
    ctx.fillRect(0, FLOOR_Y + 13, W, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, .28)';
    ctx.fillRect(0, FLOOR_Y, W, 3);

    // rayas diagonales
    const step = 34;
    const off = -(((groundOff % step) + step) % step);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FLOOR_Y + 17, W, H - FLOOR_Y - 17);
    ctx.clip();
    ctx.fillStyle = 'rgba(120, 95, 30, .10)';
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

    ctx.fillStyle = 'rgba(0, 0, 0, .08)';
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
        light: '#fff6b0', mid: '#ffd93b', dark: '#f2a41c', edge: '#8a5a16',
        wing: '#fff8dc', wingEdge: '#cf8f1e', beak: '#ff9412', beakEdge: '#c25a08',
        tail: '#f7b733', cheek: 'rgba(255, 130, 50, .32)'
      },
      laguna: {
        light: '#d8fbff', mid: '#55cde0', dark: '#1285ad', edge: '#07516f',
        wing: '#e6fcff', wingEdge: '#1683a6', beak: '#ffbd46', beakEdge: '#b86b16',
        tail: '#37b8d4', cheek: 'rgba(255, 122, 128, .4)'
      },
      mango: {
        light: '#ffe3c3', mid: '#ff9b55', dark: '#e34c4a', edge: '#802d3d',
        wing: '#fff0d8', wingEdge: '#ba5045', beak: '#ffd05e', beakEdge: '#b8751a',
        tail: '#f17651', cheek: 'rgba(255, 225, 174, .48)'
      }
    };
    const style = styles[character] || styles.classic;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);

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
    const bodyG = ctx.createRadialGradient(-5, -7, 3, 0, 0, 19);
    bodyG.addColorStop(0, style.light);
    bodyG.addColorStop(0.5, style.mid);
    bodyG.addColorStop(1, style.dark);
    ctx.fillStyle = bodyG;
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

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
    text(String(score), 0, 0, 54, '#ffffff', 'rgba(35, 70, 60, .55)', 9);
    ctx.restore();
  }

  function drawReady() {
    // título
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, .28)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    text('FLAPPY CEN PRO', W / 2, 152 + Math.sin(t * 2) * 2, 34, '#ffffff', '#2f6b4f', 8);
    ctx.restore();

    text('RÉCORD: ' + best, W / 2, 198, 17, 'rgba(255, 255, 255, .95)', 'rgba(35, 70, 60, .45)', 5);

    const pulse = 0.72 + 0.28 * Math.sin(t * 3.4);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(255, 255, 255, .92)';
    rr(W / 2 - 108, 452, 216, 42, 21);
    ctx.fill();
    ctx.strokeStyle = 'rgba(47, 107, 79, .45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    text('TOCA PARA VOLAR', W / 2, 473, 15, '#2f6b4f');
    text('ESPACIO · ↑ · W TAMBIÉN VUELAN', W / 2, 520, 11, 'rgba(255, 255, 255, .92)', 'rgba(38, 86, 58, .5)', 4);
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
      text('?', cx, cy + 1, 26, 'rgba(140, 115, 70, .55)');
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
    const px = 45, py = 177, pw = 270, ph = 277;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, .38)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    const panelG = ctx.createLinearGradient(0, py, 0, py + ph);
    panelG.addColorStop(0, '#fffaea');
    panelG.addColorStop(1, '#f1dfad');
    ctx.fillStyle = panelG;
    rr(px, py, pw, ph, 18);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 3;
    rr(px, py, pw, ph, 18);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, .7)';
    ctx.lineWidth = 1.5;
    rr(px + 5, py + 5, pw - 10, ph - 10, 14);
    ctx.stroke();

    text('GAME OVER', W / 2, py + 34, 28, '#7a5423');

    // cápsula puntos
    ctx.fillStyle = '#f8eecb';
    rr(63, 250, 158, 52, 10);
    ctx.fill();
    ctx.strokeStyle = '#ddc38d';
    ctx.lineWidth = 2;
    ctx.stroke();
    text('PUNTOS', 77, 276, 12, '#ad8a52', null, 0, 'left');
    text(String(score), 205, 276, 26, '#59411f', null, 0, 'right');

    // cápsula récord
    ctx.fillStyle = '#f8eecb';
    rr(63, 310, 158, 42, 10);
    ctx.fill();
    ctx.strokeStyle = '#ddc38d';
    ctx.lineWidth = 2;
    ctx.stroke();
    text('RÉCORD', 77, 331, 11, newBest ? '#e08a1e' : '#ad8a52', null, 0, 'left');
    if (newBest) text('¡NUEVO!', 148, 331, 11, '#e08a1e');
    text(String(best), 205, 331, 18, '#59411f', null, 0, 'right');

    drawMedal(262, 306, 33, score);

    const buttons = window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches ? [] : [
      { y: 364, top: '#ffb64d', bottom: '#eb9025', label: 'OTRA PARTIDA', color: '#ffffff' },
      { y: 410, top: '#ffffff', bottom: '#e9f7f1', label: 'COMPARTIR RETO', color: '#24573f' }
    ];
    for (const button of buttons) {
      const bx = W / 2 - 72, bw = 144, bh = 38;
      const gradient = ctx.createLinearGradient(0, button.y, 0, button.y + bh);
      gradient.addColorStop(0, button.top);
      gradient.addColorStop(1, button.bottom);
      ctx.fillStyle = gradient;
      rr(bx, button.y, bw, bh, 19);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, .65)';
      ctx.lineWidth = 2;
      rr(bx + 2, button.y + 2, bw - 4, bh - 4, 17);
      ctx.stroke();
      text(button.label, W / 2, button.y + bh / 2 + 1, 13, button.color);
    }
  }

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
    if (!frameId && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function frame(now) {
    frameId = 0;
    if (document.hidden) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    if (!document.getElementById('playerDialog').open) update(dt);
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
