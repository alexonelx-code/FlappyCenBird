(() => {
  'use strict';
  let ctx, bird;

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

    // El cuerpo se dibuja al final para cubrir las uniones.
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

  // Completa la tela donde se une el brazo.
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
    const style = BIRD_STYLES[character] || BIRD_STYLES.classic;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    ctx.scale(1.18, 1.18);

    ctx.fillStyle = 'rgba(0, 0, 0, .10)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = style.mid;
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = style.light;
    ctx.beginPath();
    ctx.ellipse(-4, 5, 7.5, 5.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.beginPath();
    ctx.arc(2.5, 2.5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = style.cheek;
    ctx.fill();

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

  function draw(context, nextBird) {
    ctx = context;
    bird = nextBird;
    drawBird();
  }

  window.FlappyCharacterRenderer = Object.freeze({ draw });
})();
