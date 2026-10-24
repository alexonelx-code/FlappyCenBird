(() => {
  'use strict';

  const { width: W, height: H } = window.FlappyGameConfig;
  let ctx, state, score, best, newBest, t, scorePop, flash;

  function rr(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function text(str, x, y, size, fill, stroke, lw, align) {
    ctx.font = `700 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
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

    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, .8)';
    ctx.fill();
  }

  function drawGameOver() {
    const px = 22, py = 154, pw = 316, ph = 324;

    ctx.save();
    ctx.shadowColor = 'rgba(4, 16, 22, .3)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    const glass = ctx.createLinearGradient(px, py, px + pw, py + ph);
    glass.addColorStop(0, 'rgba(20, 53, 64, .8)');
    glass.addColorStop(1, 'rgba(10, 31, 40, .76)');
    ctx.fillStyle = glass;
    rr(px, py, pw, ph, 24);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 240, 209, .65)';
    ctx.lineWidth = 1.5;
    rr(px, py, pw, ph, 24);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, .13)';
    ctx.lineWidth = 1;
    rr(px + 4, py + 4, pw - 8, ph - 8, 21);
    ctx.stroke();

    text('VUELO TERMINADO', W / 2, 198, 18, '#fff0d1');
    text(newBest ? '¡RÉCORD PERSONAL!' : score > 0 ? 'SIGUE ALETEANDO' : 'UN ALETEO MÁS', W / 2, 222, 10, '#c1d1c8');

    const statCard = (y, label, value) => {
      ctx.fillStyle = 'rgba(239, 247, 242, .075)';
      rr(44, y, 166, 56, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 247, 242, .2)';
      ctx.lineWidth = 1;
      rr(44, y, 166, 56, 14);
      ctx.stroke();
      text(label, 58, y + 19, 10, '#c6d4cb', null, 0, 'left');
      text(String(value), 194, y + 38, 23, '#fff0d1', null, 0, 'right');
    };
    statCard(242, 'PUNTOS', score);
    statCard(305, 'RÉCORD', best);

    ctx.fillStyle = 'rgba(255, 255, 255, .045)';
    rr(222, 242, 94, 119, 17);
    ctx.fill();
    drawMedal(269, 286, 27, score);
    text(score >= 40 ? 'LEYENDA' : score >= 20 ? 'ORO' : score >= 10 ? 'PLATA' : score >= 5 ? 'BRONCE' : 'META: 5', 269, 343, 8, '#d7c49f');

    const rewardY = 373;
    ctx.fillStyle = 'rgba(242, 184, 111, .12)';
    rr(44, rewardY, 272, 30, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 184, 111, .3)';
    ctx.lineWidth = 1;
    rr(44, rewardY, 272, 30, 12);
    ctx.stroke();
    text(`¢  +${score} CENT`, W / 2, rewardY + 15, 12, '#ffd38f');

    const bx = W / 2 - 120, by = 418, bw = 240, bh = 46;
    ctx.fillStyle = '#f2b86f';
    rr(bx, by, bw, bh, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 209, .65)';
    ctx.lineWidth = 1;
    rr(bx + 1, by + 1, bw - 2, bh - 2, 14);
    ctx.stroke();
    text('VOLVER A INTENTARLO', W / 2, by + bh / 2 + 1, 13, '#243d43');
  }


  function draw(context, frame) {
    ctx = context;
    ({ state, score, best, newBest, t, scorePop, flash } = frame);
    if (state === 'ready') drawReady();
    if (state === 'playing' || state === 'dying' || state === 'gameover') drawBigScore();
    if (state === 'gameover') drawGameOver();
    if (flash > 0.01) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (flash * 0.55) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  window.FlappyOverlayRenderer = Object.freeze({ draw });
})();
