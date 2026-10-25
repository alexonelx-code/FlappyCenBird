(() => {
  'use strict';

  const setupScreen = document.getElementById('fighterSetupScreen');
  const gameScreen = document.getElementById('fighterGameScreen');
  const canvas = document.getElementById('fighterCanvas');
  const context = canvas.getContext('2d');
  const rosterRoot = document.getElementById('fighterRoster');
  const selectionSummary = document.getElementById('fighterSelectionSummary');
  const startButton = document.getElementById('startFighterMatchButton');
  const continueToStageButton = document.getElementById('continueToStageButton');
  const stageGrid = document.getElementById('fighterStageGrid');
  const stages = globalThis.CenFighterRenderer.stages;
  const rosterAtlas = new Image();
  rosterAtlas.src = 'assets/fighters/roster-atlas.png';
  const soundButton = document.getElementById('fighterSoundButton');
  const status = document.getElementById('fighterStatus');
  const pauseOverlay = document.getElementById('fighterPauseOverlay');
  const resultOverlay = document.getElementById('fighterResultOverlay');
  const sound = window.FlappyAudio;
  const pressed = new Set();
  const touchAnalog = { x: 0, y: 0 };
  let chosen = [];
  let roster = globalThis.CenFighterRoster?.entries || globalThis.CenFighterTeams.DEFAULT_ROSTER;
  let featuredFighterId = '';
  let selectedStageId = stages[0].id;
  let match = null;
  let controller = null;
  let matchId = '';
  let sessionActive = false;
  let paused = false;
  let frameHandle = 0;
  let lastFrameTime = 0;
  let accumulator = 0;
  let renderFrame = 0;
  let canvasPortrait = false;
  let portraitCameraX = 480;
  let canvasPixelRatio = 1;
  let pendingAttack = null;
  let impactEffects = [];
  let lastHudSignature = '';
  let playerName = 'Jugador';
  const tickDuration = 1000 / globalThis.CenFighterConfig.tickRate;

  function drawAtlasCell(canvas, index) {
    if (!rosterAtlas.complete || !rosterAtlas.naturalWidth) return;
    const cellWidth = rosterAtlas.naturalWidth / 5;
    const cellHeight = rosterAtlas.naturalHeight / 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = cellWidth;
    canvas.height = cellHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cellWidth, cellHeight);
    ctx.drawImage(rosterAtlas, (index % 5) * cellWidth, Math.floor(index / 5) * cellHeight,
      cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
  }

  rosterAtlas.addEventListener('load', () => {
    document.querySelectorAll('.fighter-select-avatar, .fighter-feature-sprite').forEach((canvas) => {
      drawAtlasCell(canvas, Number(canvas.dataset.atlasIndex) || 0);
    });
    drawDifficultyPreview();
  });

  function announce(message) {
    status.textContent = '';
    window.setTimeout(() => { status.textContent = message; }, 20);
  }

  function clearInputs() {
    pressed.clear();
    pendingAttack = null;
    touchAnalog.x = 0;
    touchAnalog.y = 0;
    const thumb = document.querySelector('.fighter-analog-thumb');
    if (thumb) thumb.style.transform = '';
    document.querySelector('[data-fighter-analog]')?.classList.remove('is-active');
    document.querySelectorAll('.fighter-touch-controls .is-pressed').forEach((button) => button.classList.remove('is-pressed'));
  }

  function syncSoundButton(muted = sound ? sound.isMuted() : true) {
    soundButton.setAttribute('aria-pressed', String(muted));
    soundButton.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
    soundButton.firstElementChild.textContent = muted ? '×' : '♪';
  }

  function fighterById(id) {
    return roster.find((fighter) => fighter.id === id) || { id, name: id };
  }

  function showFeaturedFighter(id) {
    const fighter = fighterById(id);
    const index = roster.findIndex((item) => item.id === fighter.id);
    if (index < 0) return;
    featuredFighterId = fighter.id;
    document.getElementById('fighterFeaturedName').textContent = fighter.name;
    document.getElementById('fighterFeaturedArchetype').textContent = fighter.archetype || 'Peleador';
    const sprite = document.getElementById('fighterFeaturedSprite');
    sprite.dataset.atlasIndex = String(index);
    drawAtlasCell(sprite, index);
    if (fighter.palette) {
      sprite.style.setProperty('--fighter-accent', fighter.palette.accent);
      sprite.style.setProperty('--fighter-shadow', fighter.palette.shadow);
    }
    const order = chosen.indexOf(fighter.id);
    document.getElementById('fighterFeaturedOrder').textContent = order >= 0 ? `EQUIPO · ${order + 1}` : 'VISTA PREVIA';
  }

  function drawDifficultyPreview() {
    if (!rosterAtlas.complete || !rosterAtlas.naturalWidth) return;
    const canvas = document.getElementById('fighterDifficultyPreview');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const cellWidth = rosterAtlas.naturalWidth / 5;
    const cellHeight = rosterAtlas.naturalHeight / 2;
    const playerId = chosen[0] || roster[0]?.id;
    const playerIndex = Math.max(0, roster.findIndex((fighter) => fighter.id === playerId));
    const opponentCandidate = roster.findIndex((fighter, index) => index !== playerIndex && !chosen.includes(fighter.id));
    const opponentIndex = opponentCandidate >= 0 ? opponentCandidate : (playerIndex + 1) % roster.length;
    const artHeight = Math.min(canvas.height - 20, 250);
    const artWidth = artHeight * cellWidth / cellHeight;
    const ground = canvas.height - 8;
    const drawFighter = (index, x, flip = false) => {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (flip) {
        ctx.translate(x * 2 + artWidth, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(rosterAtlas, (index % 5) * cellWidth, Math.floor(index / 5) * cellHeight,
        cellWidth, cellHeight, x, ground - artHeight, artWidth, artHeight);
      ctx.restore();
    };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFighter(playerIndex, canvas.width * 0.23);
    drawFighter(opponentIndex, canvas.width * 0.56, true);
  }

  function renderRoster() {
    rosterRoot.replaceChildren();
    roster.forEach((fighter, index) => {
      const button = document.createElement('button');
      button.className = 'fighter-select-card';
      button.type = 'button';
      button.dataset.fighterId = fighter.id;
      const badge = document.createElement('span');
      badge.className = 'fighter-select-index';
      badge.textContent = String(index + 1).padStart(2, '0');
      badge.setAttribute('aria-hidden', 'true');
      const avatar = document.createElement('canvas');
      avatar.className = 'fighter-select-avatar';
      avatar.dataset.palette = String(index % 10);
      avatar.width = 307;
      avatar.height = 512;
      avatar.dataset.atlasIndex = String(index);
      drawAtlasCell(avatar, index);
      if (fighter.palette) {
        avatar.style.setProperty('--fighter-accent', fighter.palette.accent);
        avatar.style.setProperty('--fighter-shadow', fighter.palette.shadow);
      }
      avatar.setAttribute('aria-hidden', 'true');
      const name = document.createElement('strong');
      name.textContent = fighter.name;
      const archetype = document.createElement('small');
      archetype.textContent = fighter.archetype || 'Peleador';
      button.append(badge, avatar, name, archetype);
      button.addEventListener('click', () => {
        showFeaturedFighter(fighter.id);
        toggleFighter(fighter.id);
      });
      button.addEventListener('focus', () => showFeaturedFighter(fighter.id));
      button.addEventListener('pointerenter', () => showFeaturedFighter(fighter.id));
      rosterRoot.append(button);
    });
    showFeaturedFighter(featuredFighterId && roster.some((fighter) => fighter.id === featuredFighterId)
      ? featuredFighterId
      : roster[0]?.id);
    updateSelection();
  }

  function renderStages() {
    stageGrid.replaceChildren();
    stages.forEach((stage, index) => {
      const button = document.createElement('button');
      button.className = 'fighter-stage-card';
      button.type = 'button';
      button.dataset.stageId = stage.id;
      button.setAttribute('aria-pressed', String(stage.id === selectedStageId));
      const preview = document.createElement('span');
      preview.className = 'fighter-stage-card-art';
      preview.style.backgroundImage = `url("assets/fighters/stages/${stage.file}")`;
      preview.setAttribute('aria-hidden', 'true');
      const number = document.createElement('span');
      number.className = 'fighter-stage-index';
      number.textContent = String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');
      const name = document.createElement('strong');
      name.textContent = stage.name;
      button.append(preview, number, name);
      button.addEventListener('click', () => chooseStage(stage.id));
      stageGrid.append(button);
    });
    updateStageSelection();
  }

  function updateStageSelection() {
    const stage = stages.find((item) => item.id === selectedStageId) || stages[0];
    selectedStageId = stage.id;
    stageGrid.querySelectorAll('.fighter-stage-card').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.stageId === stage.id));
    });
    const art = document.getElementById('fighterFeaturedStageArt');
    art.style.backgroundImage = `url("assets/fighters/stages/${stage.file}")`;
    art.setAttribute('aria-label', `Vista previa: ${stage.name}`);
    document.getElementById('fighterFeaturedStageName').textContent = stage.name;
    document.getElementById('fighterFeaturedStageDescription').textContent = stage.description;
  }

  function chooseStage(id) {
    if (!stages.some((stage) => stage.id === id)) return;
    selectedStageId = id;
    updateStageSelection();
  }

  function setSetupStep(step, focus = true) {
    const titleIds = { fighters: 'fighterSetupTitle', stage: 'fighterStageTitle', difficulty: 'fighterDifficultyTitle' };
    setupScreen.setAttribute('aria-labelledby', titleIds[step]);
    document.querySelectorAll('[data-setup-step]').forEach((panel) => {
      panel.hidden = panel.dataset.setupStep !== step;
    });
    document.querySelectorAll('[data-setup-step-indicator]').forEach((indicator) => {
      const current = indicator.dataset.setupStepIndicator === step;
      const steps = ['fighters', 'stage', 'difficulty'];
      indicator.classList.toggle('is-current', current);
      indicator.classList.toggle('is-complete', steps.indexOf(indicator.dataset.setupStepIndicator) < steps.indexOf(step));
      if (current) indicator.setAttribute('aria-current', 'step');
      else indicator.removeAttribute('aria-current');
    });
    if (focus) {
      const heading = document.querySelector(`[data-setup-step="${step}"] h1`);
      heading?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function updateDifficultyFeature() {
    const descriptions = {
      'muy-facil': 'La CPU deja más espacio para practicar y aprender los controles.',
      normal: 'Un reto equilibrado para aprender y pelear.',
      dificil: 'La CPU presiona más y aprovecha mejor tus errores.'
    };
    const input = document.querySelector('input[name="fighterDifficulty"]:checked');
    const label = input?.closest('label');
    document.getElementById('fighterFeaturedDifficultyName').textContent = label?.querySelector('strong')?.textContent || 'Normal';
    document.getElementById('fighterFeaturedDifficultyDescription').textContent = descriptions[input?.value] || descriptions.normal;
    document.getElementById('fighterDifficultyFeature').dataset.level = input?.value || 'normal';
  }

  function toggleFighter(id) {
    if (chosen.includes(id)) chosen = chosen.filter((item) => item !== id);
    else if (chosen.length < globalThis.CenFighterTeams.TEAM_SIZE) chosen.push(id);
    updateSelection();
  }

  function updateSelection() {
    const descriptions = chosen.map((id, index) => `${index + 1}. ${fighterById(id).name}`);
    rosterRoot.querySelectorAll('.fighter-select-card').forEach((button) => {
      const id = button.dataset.fighterId;
      const order = chosen.indexOf(id);
      button.setAttribute('aria-pressed', String(order >= 0));
      button.querySelector('.fighter-select-index').textContent = order >= 0 ? String(order + 1) : String(roster.findIndex((fighter) => fighter.id === id) + 1).padStart(2, '0');
    });
    selectionSummary.textContent = chosen.length === 3
      ? `Equipo listo · ${descriptions.join(' · ')}`
      : `${chosen.length} de 3 seleccionados${descriptions.length ? ` · ${descriptions.join(' · ')}` : ''}`;
    continueToStageButton.disabled = chosen.length !== 3;
    startButton.disabled = chosen.length !== 3;
    if (featuredFighterId) showFeaturedFighter(featuredFighterId);
    drawDifficultyPreview();
    document.getElementById('fighterSetupBalance').textContent = String(window.CenEconomy.getProfile()?.cents || 0);
  }

  function getDifficulty() {
    return document.querySelector('input[name="fighterDifficulty"]:checked')?.value || 'normal';
  }

  function makeMatchId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const value = Math.random() * 16 | 0;
      return (character === 'x' ? value : (value & 3 | 8)).toString(16);
    });
  }

  function startMatch() {
    if (chosen.length !== 3 || !stages.some((stage) => stage.id === selectedStageId)) return;
    playerName = window.CenGamesUI.getPlayerName();
    matchId = makeMatchId();
    const seed = globalThis.CenFighterRandom.normalizeSeed(matchId);
    match = globalThis.CenFighterTeams.createMatch({
      playerTeam: chosen,
      roster,
      seed
    });
    controller = globalThis.CenFighterLearning.createController({
      side: 'right',
      difficulty: getDifficulty(),
      profileId: window.CenGamesUI.getProfileId() || playerName,
      seed: match.cpuSeed
    });
    sessionActive = true;
    paused = false;
    accumulator = 0;
    lastFrameTime = 0;
    renderFrame = 0;
    pendingAttack = null;
    impactEffects = [];
    lastHudSignature = '';
    pauseOverlay.hidden = true;
    resultOverlay.hidden = true;
    document.getElementById('fighterPlayerName').textContent = playerName;
    window.CenGamesUI.showScreen('fighterGame');
    resizeCanvas();
    renderHud();
    draw();
    announce(`Comienza el combate. ${playerName}, tu equipo tiene tres peleadores.`);
    canvas.focus({ preventScroll: true });
    if (sound) sound.unlock();
    frameHandle = window.requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvasPixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(rect.width * canvasPixelRatio);
    const height = Math.round(rect.height * canvasPixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const nextPortrait = rect.height > rect.width * 1.25;
    if (nextPortrait !== canvasPortrait) portraitCameraX = 480;
    canvasPortrait = nextPortrait;
    applyCanvasTransform();
  }

  function applyCanvasTransform() {
    if (!canvasPortrait || !match?.duel) {
      context.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0);
      return;
    }
    const { left, right } = match.duel;
    const scale = canvas.height / globalThis.CenFighterConfig.arena.height;
    const artHeight = Math.min(left.height * 1.15, 140);
    const worldWidth = Math.min(960, Math.max(canvas.width / scale,
      Math.abs(right.x - left.x) + artHeight * 1.35 * 1.4 + 36));
    const scaleX = canvas.width / worldWidth;
    const targetX = Math.max(worldWidth / 2, Math.min(960 - worldWidth / 2, (left.x + right.x) / 2));
    portraitCameraX += (targetX - portraitCameraX) * 0.18;
    context.setTransform(scaleX, 0, 0, scale,
      canvas.width / 2 - portraitCameraX * scaleX,
      0);
  }

  function draw() {
    impactEffects = impactEffects.filter((effect) => renderFrame - effect.frame <= 10);
    applyCanvasTransform();
    globalThis.CenFighterRenderer.draw(context, match, renderFrame, impactEffects, { portrait: canvasPortrait, stageId: selectedStageId });
  }

  function processEvents(events) {
    let knockedOut = null;
    let entrant = null;
    events.forEach((event) => {
      if (event.type === 'hit' || event.type === 'blocked') {
        const defender = [match.duel.left, match.duel.right].find((fighter) => fighter.id === event.defenderId);
        if (defender) impactEffects.push({
          type: event.type,
          frame: renderFrame,
          x: defender.x,
          y: defender.y - (defender.crouching ? defender.crouchHeight : defender.height) * 0.62
        });
        if (event.type === 'hit') sound?.fighterHit();
        else sound?.fighterBlock();
      } else if (event.type === 'ko') {
        sound?.fighterKo();
        knockedOut = match.combatants[event.fighterId] || knockedOut;
      } else if (event.type === 'team-fighter-entered') {
        sound?.fighterEnter();
        entrant = match.combatants[event.combatantId] || entrant;
      } else if (event.type === 'team-match-finished') {
        sound?.fighterResult(event.winnerSide === 'player' ? 'win' : event.winnerSide === 'cpu' ? 'loss' : 'draw');
      }
    });
    if (impactEffects.length > 8) impactEffects = impactEffects.slice(-8);
    if (entrant) announce(`${entrant.name} entra al combate.`);
    else if (knockedOut && !events.some((event) => event.type === 'team-match-finished')) announce(`${knockedOut.name} queda fuera del combate.`);
  }

  function inputForPlayer() {
    const left = pressed.has('left');
    const right = pressed.has('right');
    const digitalX = left === right ? 0 : left ? -1 : 1;
    const analogX = Math.abs(touchAnalog.x) < 0.14
      ? 0
      : Math.sign(touchAnalog.x) * (Math.abs(touchAnalog.x) - 0.14) / 0.86;
    return {
      moveX: digitalX || analogX,
      jump: pressed.has('jump') || touchAnalog.y < -0.6,
      crouch: pressed.has('crouch') || touchAnalog.y > 0.6,
      block: pressed.has('block'),
      attack: pendingAttack
    };
  }

  function loop(now) {
    if (!sessionActive) return;
    if (lastFrameTime) accumulator += Math.min(100, now - lastFrameTime);
    lastFrameTime = now;
    if (!paused) {
      let steps = 0;
      while (accumulator >= tickDuration && steps < 6 && match.phase !== 'finished') {
        const playerInput = inputForPlayer();
        let cpuInput = {};
        if (match.phase === 'fight') {
          const decision = globalThis.CenFighterLearning.stepController(controller, match.duel);
          controller = decision.state;
          cpuInput = decision.input;
        }
        const update = globalThis.CenFighterTeams.stepMatch(match, { player: playerInput, cpu: cpuInput });
        match = update.state;
        processEvents(update.events);
        pendingAttack = null;
        accumulator -= tickDuration;
        steps += 1;
        renderHud();
        if (match.phase === 'finished') {
          showResult();
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderFrame += 1;
    draw();
    if (sessionActive) frameHandle = window.requestAnimationFrame(loop);
  }

  function renderReserves(root, side) {
    const team = match.teams[side];
    root.replaceChildren();
    team.combatantIds.forEach((id, index) => {
      const combatant = match.combatants[id];
      const badge = document.createElement('span');
      badge.className = 'fighter-reserve';
      if (id === match.active[side]) badge.classList.add('is-active');
      if (team.eliminated.includes(id)) badge.classList.add('is-eliminated');
      badge.setAttribute('aria-label', `${combatant.name}${id === match.active[side] ? ', activo' : team.eliminated.includes(id) ? ', eliminado' : ', reserva'}`);
      badge.title = `${index + 1}. ${combatant.name}`;
      badge.textContent = String(index + 1);
      root.append(badge);
    });
  }

  function renderHud() {
    if (!match) return;
    const phase = match.phase;
    const duel = match.duel;
    const seconds = phase === 'fight'
      ? Math.ceil((duel.phase === 'sudden_death' ? duel.suddenDeathRemainingFrames : duel.remainingFrames) / duel.tickRate)
      : Math.ceil(match.transitionRemainingFrames / duel.tickRate);
    const playerId = match.active.player;
    const cpuId = match.active.cpu;
    const player = match.combatants[playerId];
    const cpuFighter = match.combatants[cpuId];
    const playerHealth = player ? (phase === 'fight' ? duel.left.health : player.health) : 0;
    const cpuHealth = cpuFighter ? (phase === 'fight' ? duel.right.health : cpuFighter.health) : 0;
    const playerMax = player ? player.maxHealth : 1;
    const cpuMax = cpuFighter ? cpuFighter.maxHealth : 1;
    const signature = [phase, duel.phase, match.boutNumber, seconds, playerId, cpuId, playerHealth, playerMax, cpuHealth, cpuMax,
      match.teams.player.eliminated.join(','), match.teams.cpu.eliminated.join(',')].join('|');
    if (signature === lastHudSignature) return;
    lastHudSignature = signature;
    document.getElementById('fighterClock').textContent = phase === 'transition' ? '↻' : String(seconds).padStart(2, '0');
    document.getElementById('fighterClock').setAttribute('aria-label', phase === 'transition' ? 'Cambio de peleadores' : `Tiempo restante: ${seconds} segundos`);
    document.getElementById('fighterBoutLabel').textContent = phase === 'transition'
      ? 'Siguiente duelo'
      : `Combate ${match.boutNumber} de 5${duel.phase === 'sudden_death' ? ' · muerte súbita' : ''}`;
    document.getElementById('fighterPlayerActive').textContent = player ? player.name : 'Sin peleador';
    document.getElementById('fighterCpuActive').textContent = cpuFighter ? cpuFighter.name : 'Sin peleador';
    document.getElementById('fighterPlayerHealth').style.width = `${Math.max(0, playerHealth / playerMax * 100)}%`;
    document.getElementById('fighterCpuHealth').style.width = `${Math.max(0, cpuHealth / cpuMax * 100)}%`;
    document.getElementById('fighterPlayerHealth').setAttribute('aria-label', `Vida: ${playerHealth} de ${playerMax}`);
    document.getElementById('fighterCpuHealth').setAttribute('aria-label', `Vida CPU: ${cpuHealth} de ${cpuMax}`);
    renderReserves(document.getElementById('fighterPlayerReserves'), 'player');
    renderReserves(document.getElementById('fighterCpuReserves'), 'cpu');
  }

  function showResult() {
    sessionActive = false;
    paused = false;
    window.cancelAnimationFrame(frameHandle);
    pauseOverlay.hidden = true;
    resultOverlay.hidden = true;
    const won = match.result.winnerSide === 'player';
    const lost = match.result.winnerSide === 'cpu';
    document.getElementById('fighterResultTitle').textContent = won ? '¡Victoria!' : lost ? 'La CPU gana' : 'Empate';
    document.getElementById('fighterResultCopy').textContent = `Tu equipo terminó con ${match.result.remaining.player} de 3 peleadores. La CPU conservó ${match.result.remaining.cpu} de 3.`;
    document.getElementById('fighterResultReward').textContent = 'Guardando Cent…';
    announce('Combate terminado. Guardando resultado y recompensa.');
    globalThis.CenFighterLearning.completeMatch(controller, match.result.winnerSide);
    window.CenEconomy.completeFighterMatch(matchId, match.result.winnerSide)
      .then((profile) => {
        const reward = Number(profile?.earnedCents) || 0;
        const receipt = profile?.duplicateFighterMatch ? 'Recompensa ya registrada' : `+${reward} Cent`;
        document.getElementById('fighterResultReward').textContent = `${receipt}${won && !profile?.duplicateFighterMatch ? ' · incluye 2 por victoria' : ''}`;
        document.getElementById('fighterSetupBalance').textContent = String(profile?.cents || 0);
        resultOverlay.hidden = false;
        document.getElementById('fighterResultContinueButton').focus({ preventScroll: true });
        announce(`${won ? 'Victoria' : lost ? 'Fin del combate' : 'Empate'}. ${receipt}.`);
      })
      .catch((error) => {
        document.getElementById('fighterResultReward').textContent = `No se pudo guardar la recompensa: ${error.message}`;
        resultOverlay.hidden = false;
        document.getElementById('fighterResultContinueButton').focus({ preventScroll: true });
        announce('El combate terminó, pero no se guardó la recompensa.');
      });
  }

  function setPaused(value) {
    if (!match || match.phase === 'finished') return;
    paused = Boolean(value);
    pauseOverlay.hidden = !paused;
    if (paused) {
      clearInputs();
      announce('Combate en pausa.');
      if (!document.hidden) document.getElementById('resumeFighterButton').focus({ preventScroll: true });
    } else {
      lastFrameTime = 0;
      announce('Continúa el combate.');
      canvas.focus({ preventScroll: true });
    }
  }

  function leaveMatch() {
    sessionActive = false;
    paused = false;
    window.cancelAnimationFrame(frameHandle);
    clearInputs();
    impactEffects = [];
    lastHudSignature = '';
    match = null;
    controller = null;
    pauseOverlay.hidden = true;
    resultOverlay.hidden = true;
    window.CenGamesUI.showScreen('games');
    document.getElementById('fighterCard').focus({ preventScroll: true });
  }

  function trapDialogFocus(event) {
    if (event.key !== 'Tab') return;
    const overlay = !pauseOverlay.hidden ? pauseOverlay : !resultOverlay.hidden ? resultOverlay : null;
    if (!overlay) return;
    const focusable = Array.from(overlay.querySelectorAll('button:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Tab') trapDialogFocus(event);
    if (event.code === 'Escape' && sessionActive) {
      event.preventDefault();
      setPaused(!paused);
      return;
    }
    if (!sessionActive || paused || event.repeat) return;
    const controls = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
      ArrowDown: 'crouch', KeyS: 'crouch',
      KeyJ: 'block', ShiftLeft: 'block', ShiftRight: 'block'
    };
    const attack = globalThis.CenFighterConfig.controls.attacks[event.code];
    if (controls[event.code]) {
      event.preventDefault();
      pressed.add(controls[event.code]);
    } else if (attack) {
      event.preventDefault();
      pendingAttack = attack;
    }
  }

  function onKeyUp(event) {
    const controls = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'crouch', KeyS: 'crouch',
      KeyJ: 'block', ShiftLeft: 'block', ShiftRight: 'block'
    };
    if (controls[event.code]) pressed.delete(controls[event.code]);
  }

  function bindTouchControls() {
    document.querySelectorAll('[data-fighter-hold]').forEach((button) => {
      const key = button.dataset.fighterHold;
      button.addEventListener('pointerdown', (event) => {
        if (!sessionActive || paused) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        pressed.add(key);
        button.classList.add('is-pressed');
      });
      const release = (event) => {
        event.preventDefault();
        pressed.delete(key);
        button.classList.remove('is-pressed');
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
    document.querySelectorAll('[data-fighter-attack]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        if (!sessionActive || paused) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        pendingAttack = button.dataset.fighterAttack;
        button.classList.add('is-pressed');
      });
      button.addEventListener('pointerup', () => button.classList.remove('is-pressed'));
      button.addEventListener('pointercancel', () => button.classList.remove('is-pressed'));
    });
    document.querySelectorAll('[data-fighter-analog]').forEach((stick) => {
      const thumb = stick.querySelector('.fighter-analog-thumb');
      let pointerId = null;
      const updateStick = (event) => {
        const rect = stick.getBoundingClientRect();
        const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
        let dx = event.clientX - (rect.left + rect.width / 2);
        let dy = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance > radius) {
          dx *= radius / distance;
          dy *= radius / distance;
        }
        touchAnalog.x = dx / radius;
        touchAnalog.y = dy / radius;
        thumb.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
      };
      const releaseStick = (event) => {
        if (pointerId !== event.pointerId) return;
        pointerId = null;
        touchAnalog.x = 0;
        touchAnalog.y = 0;
        thumb.style.transform = '';
        stick.classList.remove('is-active');
      };
      stick.addEventListener('pointerdown', (event) => {
        if (!sessionActive || paused) return;
        event.preventDefault();
        pointerId = event.pointerId;
        stick.setPointerCapture(pointerId);
        stick.classList.add('is-active');
        updateStick(event);
      });
      stick.addEventListener('pointermove', (event) => {
        if (pointerId === event.pointerId) updateStick(event);
      });
      stick.addEventListener('pointerup', releaseStick);
      stick.addEventListener('pointercancel', releaseStick);
      stick.addEventListener('lostpointercapture', releaseStick);
    });
  }

  function openFighterSetup() {
    chosen = [];
    roster = globalThis.CenFighterRoster?.entries || globalThis.CenFighterTeams.DEFAULT_ROSTER;
    renderRoster();
    renderStages();
    updateDifficultyFeature();
    setSetupStep('fighters', false);
    window.CenGamesUI.showScreen('fighterSetup');
    document.getElementById('fighterSetupTitle').focus({ preventScroll: true });
  }
  window.addEventListener('cengames:fighter-open', openFighterSetup);
  document.getElementById('fighterSetupBackButton').addEventListener('click', () => {
    window.CenGamesUI.showScreen('games');
    document.getElementById('fighterCard').focus({ preventScroll: true });
  });
  soundButton.addEventListener('click', () => {
    if (sound) syncSoundButton(sound.toggleMute());
  });
  window.addEventListener('flappy:mute', (event) => syncSoundButton(event.detail.muted));
  document.getElementById('resetFighterLearningButton').addEventListener('click', () => {
    const reset = globalThis.CenFighterLearning.resetPolicy(window.CenGamesUI.getProfileId() || playerName);
    announce(reset ? 'Aprendizaje de la CPU reiniciado para este perfil.' : 'El almacenamiento no está disponible ahora.');
  });
  continueToStageButton.addEventListener('click', () => {
    if (chosen.length === 3) setSetupStep('stage');
  });
  document.getElementById('backToFightersButton').addEventListener('click', () => setSetupStep('fighters'));
  document.getElementById('continueToDifficultyButton').addEventListener('click', () => setSetupStep('difficulty'));
  document.getElementById('backToStageButton').addEventListener('click', () => setSetupStep('stage'));
  document.querySelectorAll('input[name="fighterDifficulty"]').forEach((input) => {
    input.addEventListener('change', updateDifficultyFeature);
  });
  startButton.addEventListener('click', startMatch);
  document.getElementById('fighterPauseButton').addEventListener('click', () => setPaused(true));
  document.getElementById('resumeFighterButton').addEventListener('click', () => setPaused(false));
  document.getElementById('abandonFighterButton').addEventListener('click', leaveMatch);
  document.getElementById('fighterResultContinueButton').addEventListener('click', leaveMatch);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('blur', () => {
    if (sessionActive && !paused) setPaused(true);
  });
  window.addEventListener('cengames:profile', (event) => {
    document.getElementById('fighterSetupBalance').textContent = String(event.detail.profile.cents || 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && sessionActive && !paused) setPaused(true);
    else if (!document.hidden && paused) document.getElementById('resumeFighterButton').focus({ preventScroll: true });
  });
  syncSoundButton();
  bindTouchControls();
  renderStages();
  updateDifficultyFeature();
  renderRoster();
})();
