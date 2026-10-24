(() => {
  'use strict';
  const { width: W, height: H, floorY: FLOOR_Y, pipeWidth: PIPE_W } = window.FlappyGameConfig;
  let ctx, skyGrad, scene, clouds, groundOff, pipes, particles;

  function activeScene() {
    return scene;
  }

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

  function drawSky() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, FLOOR_Y);
  }

  function drawSun() {
    const scene = activeScene();
    const cx = 286, cy = 104;
    if (scene?.scene === 'cosmos') {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 214, 255, .75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 46, 14, -.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e2a4d7';
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(94, 53, 119, .34)';
      ctx.beginPath();
      ctx.arc(cx - 8, cy - 6, 5, 0, Math.PI * 2);
      ctx.arc(cx + 9, cy + 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = scene?.scene === 'aurora' ? '#d9f5df' : scene?.scene === 'sunset' ? '#ffe0a1' : scene?.scene === 'neon' ? '#b6f2c4' : '#f4b975';
    ctx.beginPath();
    ctx.arc(cx, cy, scene?.scene === 'sunset' ? 33 : 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = scene?.scene === 'aurora' ? 'rgba(220, 255, 241, .72)' : 'rgba(255, 226, 184, .72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 37, 0, Math.PI * 2);
    ctx.stroke();

    if (scene?.scene !== 'neon') {
      ctx.fillStyle = 'rgba(95, 70, 72, .28)';
      ctx.fillRect(cx - 17, cy + 4, 34, 3);
      ctx.fillRect(cx - 12, cy + 11, 24, 2);
    }
  }

  function drawClouds() {
    const scene = activeScene();
    for (const c of clouds) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.s, c.s);
      ctx.fillStyle = scene?.scene === 'aurora' ? 'rgba(181, 246, 232, .2)' : scene?.scene === 'cosmos' ? 'rgba(242, 204, 255, .16)' : 'rgba(255, 229, 202, .24)';
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
    const scene = activeScene() || { hills: ['#426a68', '#244b50'], scene: 'coast' };
    ctx.fillStyle = scene.hills[0];
    hillPath(groundOff * 0.16, 476, 26, 0.0085);
    ctx.fill();

    ctx.fillStyle = scene.hills[1];
    hillPath(groundOff * 0.3, 512, 20, 0.0135);
    ctx.fill();

    if (scene.scene === 'coast') {
      ctx.fillStyle = '#1c4148';
      ctx.fillRect(52, 459, 8, 39);
      ctx.beginPath();
      ctx.moveTo(33, 466);
      ctx.quadraticCurveTo(56, 438, 80, 466);
      ctx.quadraticCurveTo(55, 458, 33, 466);
      ctx.fill();
    } else if (scene.scene === 'neon') {
      ctx.fillStyle = 'rgba(7, 27, 48, .7)';
      for (const [x, y, w, h] of [[15, 447, 35, 61], [55, 430, 43, 82], [103, 452, 28, 58], [259, 435, 42, 73], [308, 448, 36, 63]]) {
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(167, 241, 151, .6)';
        for (let wx = x + 7; wx < x + w - 3; wx += 12) for (let wy = y + 9; wy < y + h - 6; wy += 15) ctx.fillRect(wx, wy, 3, 4);
        ctx.fillStyle = 'rgba(7, 27, 48, .7)';
      }
    } else if (scene.scene === 'cosmos') {
      ctx.fillStyle = 'rgba(246, 210, 255, .65)';
      [[46, 424], [288, 448], [128, 463], [235, 423]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  function drawSceneAccents() {
    const scene = activeScene();
    if (!scene || scene.scene === 'coast') return;
    if (scene.scene === 'aurora') {
      ctx.save();
      ctx.globalAlpha = .22;
      ctx.lineWidth = 13;
      for (let band = 0; band < 3; band++) {
        ctx.strokeStyle = ['#87f1c8', '#5bd4dc', '#b5a8ff'][band];
        ctx.beginPath();
        ctx.moveTo(-20, 177 + band * 24);
        ctx.bezierCurveTo(83, 100 + band * 22, 184, 248 + band * 15, 380, 137 + band * 25);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (scene.scene === 'cosmos' || scene.scene === 'neon') {
      ctx.save();
      const starColor = scene.scene === 'cosmos' ? '#f4ddff' : '#b7f4c3';
      ctx.fillStyle = starColor;
      for (let i = 0; i < 30; i++) {
        const x = (i * 97 + 31) % W;
        const y = (i * 67 + 23) % 380;
        const size = i % 5 === 0 ? 2 : 1;
        ctx.globalAlpha = .35 + (i % 4) * .12;
        if (scene.scene === 'cosmos' && i % 5 === 0) {
          ctx.fillRect(x - size, y, size * 2, 1);
          ctx.fillRect(x, y - size, 1, size * 2);
        } else ctx.fillRect(x, y, size, size);
      }
      ctx.restore();
    }
    if (scene.scene === 'sunset') {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 207, 170, .12)';
      for (let i = 0; i < 4; i++) ctx.fillRect(246, 145 + i * 9, 82 - i * 10, 3);
      ctx.restore();
    }
  }

  function pipeGradient(x, w) {
    const colors = activeScene()?.pipes || ['#8f454c', '#f28c68', '#d9655c', '#b44f52', '#783b49'];
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    [0, .18, .48, .82, 1].forEach((stop, index) => g.addColorStop(stop, colors[index]));
    return g;
  }

  function pipeBody(x, y, w, h) {
    if (h <= 0) return;
    const scene = activeScene();
    ctx.fillStyle = pipeGradient(x, w);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = scene?.scene === 'neon' ? 'rgba(7, 33, 43, .28)' : 'rgba(65, 41, 52, .16)';
    ctx.fillRect(x + w - 8, y, 6, h);
    ctx.fillStyle = scene?.pipeHighlight || 'rgba(255, 218, 174, .28)';
    ctx.globalAlpha = .34;
    ctx.fillRect(x + 6, y, 3, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = scene?.pipeEdge || '#523641';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y);
    ctx.lineTo(x + 1, y + h);
    ctx.moveTo(x + w - 1, y);
    ctx.lineTo(x + w - 1, y + h);
    ctx.stroke();
    if (scene?.scene === 'cosmos' || scene?.scene === 'neon') {
      ctx.save();
      ctx.strokeStyle = scene.pipeHighlight;
      ctx.globalAlpha = .62;
      ctx.lineWidth = scene.scene === 'neon' ? 2 : 1.5;
      for (let seamY = y + 34; seamY < y + h - 8; seamY += scene.scene === 'neon' ? 68 : 52) {
        ctx.beginPath();
        ctx.moveTo(x + 8, seamY);
        ctx.lineTo(x + w - 8, seamY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function pipeCap(x, y, w, h) {
    const scene = activeScene();
    const style = scene?.scene || 'coast';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, .18)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = pipeGradient(x, w);
    if (style === 'aurora') {
      ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + w - 5, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - 5, y + h); ctx.lineTo(x + 5, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
    } else if (style === 'neon' || style === 'sunset') {
      ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 5, y + h); ctx.lineTo(x, y + h); ctx.closePath();
    } else if (style === 'cosmos') {
      ctx.beginPath(); ctx.rect(x, y, w, h);
    } else rr(x, y, w, h, 5);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = scene?.pipeEdge || '#523641';
    ctx.lineWidth = 2;
    if (style === 'coast') {
      rr(x + 1, y + 1, w - 2, h - 2, 4);
      ctx.stroke();
    } else {
      ctx.strokeRect(x + (style === 'aurora' ? 3 : 2), y + 2, w - (style === 'aurora' ? 6 : 4), h - 4);
    }

    ctx.fillStyle = scene?.pipeHighlight || 'rgba(255, 216, 164, .72)';
    ctx.fillRect(x + 8, y + 7, w - 16, 3);

    ctx.strokeStyle = 'rgba(255, 225, 188, .55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 5);
    ctx.lineTo(x + 7, y + h - 6);
    ctx.stroke();
    if (style === 'cosmos') {
      ctx.strokeStyle = scene.pipeHighlight;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(2, w / 2 - 13), 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (style === 'neon') {
      ctx.save();
      ctx.shadowColor = scene.pipeHighlight;
      ctx.shadowBlur = 7;
      ctx.strokeStyle = scene.pipeHighlight;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      ctx.restore();
    }
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
    const scene = activeScene() || { floor: ['#3e5751', '#213a3a'], groundEdge: '#e27b5e', stripes: 'rgba(237, 190, 132, .10)' };
    const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    g.addColorStop(0, scene.floor[0]);
    g.addColorStop(1, scene.floor[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    ctx.fillStyle = scene.groundEdge;
    ctx.fillRect(0, FLOOR_Y, W, 13);
    ctx.fillStyle = scene.pipes[0];
    ctx.fillRect(0, FLOOR_Y + 13, W, 4);
    ctx.fillStyle = scene.pipeHighlight || 'rgba(255, 229, 190, .34)';
    ctx.fillRect(0, FLOOR_Y, W, 3);

    const step = 34;
    const off = -(((groundOff % step) + step) % step);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FLOOR_Y + 17, W, H - FLOOR_Y - 17);
    ctx.clip();
    ctx.fillStyle = scene.stripes;
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

  function draw(context, frame) {
    ctx = context;
    ({ skyGrad, scene, clouds, groundOff, pipes, particles } = frame);
    drawSky();
    drawSun();
    drawClouds();
    drawSceneAccents();
    drawHills();
    drawPipes();
    drawGround();
    drawParticles();
  }

  window.FlappySceneRenderer = Object.freeze({ draw });
})();
