(() => {
  'use strict';

  const {
    width: W,
    height: H,
    floorY: FLOOR_Y,
    pipeWidth: PIPE_W,
    birdX: BIRD_X,
    gravity: GRAVITY,
    flapVelocity: FLAP_V,
    spawnDistance: SPAWN_DIST,
    pace: PACE,
    birdProfiles: BIRD_PROFILES
  } = window.FlappyGameConfig;
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
  let currentScene = window.CenEconomy ? window.CenEconomy.backgroundById('costa') : null;

  function activeScene() {
    return currentScene;
  }

  function refreshActiveScene(profile) {
    if (!window.CenEconomy) return;
    const player = profile || window.CenEconomy.getProfile();
    if (player) currentScene = window.CenEconomy.backgroundById(player.backgroundId);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(W * dpr);
    const height = Math.round(H * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const colors = activeScene()?.sky || ['#1b394b', '#4f7880', '#efa47e'];
    skyGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    skyGrad.addColorStop(0, colors[0]);
    skyGrad.addColorStop(0.58, colors[1]);
    skyGrad.addColorStop(1, colors[2]);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('cengames:profile', (event) => {
    refreshActiveScene(event.detail && event.detail.profile);
    resizeCanvas();
    render();
  });

  let best = loadPlayerBest();

  let state = 'ready';
  let score = 0;
  let newBest = false;
  let t = 0;
  let gameOverAt = -99;
  let groundOff = 0;
  let spawnDist = 140;
  let shake = 0;
  let flash = 0;
  let scorePop = 0;
  let currentPipeSpeed = PACE.initialSpeed;
  let paceProfile = [];

  function emitState() {
    window.dispatchEvent(new CustomEvent('flappy:state', {
      detail: { state, score, best }
    }));
  }

  const bird = { x: BIRD_X, y: 330, vy: 0, rot: 0, wing: 0, wingSpeed: 9 };
  let pipes = [];

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


  function addPipe() {
    const gap = Math.max(160, 196 - score * 1.6);
    const minY = 70 + gap / 2;
    const maxY = FLOOR_Y - 70 - gap / 2;
    const gapY = minY + Math.random() * (maxY - minY);
    pipes.push({ x: W + 40, gapY, gap, scored: false });
  }

  function targetPipeSpeed() {
    return window.FlappyPace.speedAt(score, paceProfile, PACE);
  }

  function pipeSpeed(dt) {
    // Cambios suaves para que cada tramo acelere o dé un respiro sin saltos bruscos.
    const blend = 1 - Math.exp(-PACE.transitionRate * dt);
    currentPipeSpeed += (targetPipeSpeed() - currentPipeSpeed) * blend;
    return currentPipeSpeed;
  }

  function resetGame() {
    state = 'ready';
    score = 0;
    best = loadPlayerBest();
    newBest = false;
    paceProfile = window.FlappyPace.createProfile(PACE);
    pipes = [];
    particles = [];
    shake = 0;
    flash = 0;
    scorePop = 0;
    currentPipeSpeed = PACE.initialSpeed;
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
    paceProfile = window.FlappyPace.createProfile(PACE);
    pipes = [];
    particles = [];
    spawnDist = 140;
    groundOff = 0;
    shake = 0;
    flash = 0;
    scorePop = 0;
    currentPipeSpeed = PACE.initialSpeed;
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
    const speed = pipeSpeed(dt);
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

  function birdProfile() {
    return window.FlappyUI.getCharacter() === 'friend' ? BIRD_PROFILES.friend : BIRD_PROFILES.bird;
  }

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

  window.FlappyGame = Object.freeze({
    reset: resetGame,
    getBestScore() { return loadPlayerBest(); }
  });

  function render() {
    ctx.save();
    if (shake > 0.15) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    window.FlappySceneRenderer.draw(ctx, {
      skyGrad,
      scene: activeScene(),
      clouds,
      groundOff,
      pipes,
      particles
    });
    window.FlappyCharacterRenderer.draw(ctx, bird);
    ctx.restore();

    window.FlappyOverlayRenderer.draw(ctx, {
      state,
      score,
      best,
      newBest,
      t,
      scorePop,
      flash
    });
  }

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
