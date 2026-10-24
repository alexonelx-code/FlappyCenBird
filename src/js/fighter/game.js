(() => {
  'use strict';

  const setupScreen = document.getElementById('fighterSetupScreen');
  const gameScreen = document.getElementById('fighterGameScreen');
  const canvas = document.getElementById('fighterCanvas');
  const context = canvas.getContext('2d');
  const rosterRoot = document.getElementById('fighterRoster');
  const selectionSummary = document.getElementById('fighterSelectionSummary');
  const startButton = document.getElementById('startFighterMatchButton');
  const status = document.getElementById('fighterStatus');
  const pauseOverlay = document.getElementById('fighterPauseOverlay');
  const resultOverlay = document.getElementById('fighterResultOverlay');
  const pressed = new Set();
  let chosen = [];
  let roster = globalThis.CenFighterRoster?.entries || globalThis.CenFighterTeams.DEFAULT_ROSTER;
  let match = null;
  let controller = null;
  let matchId = '';
  let sessionActive = false;
  let paused = false;
  let frameHandle = 0;
  let lastFrameTime = 0;
  let accumulator = 0;
  let renderFrame = 0;
  let pendingAttack = null;
  let playerName = 'Jugador';
  const tickDuration = 1000 / globalThis.CenFighterConfig.tickRate;

  function announce(message) {
    status.textContent = '';
    window.setTimeout(() => { status.textContent = message; }, 20);
  }

  function fighterById(id) {
    return roster.find((fighter) => fighter.id === id) || { id, name: id };
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
      const avatar = document.createElement('span');
      avatar.className = 'fighter-select-avatar';
      avatar.dataset.palette = String(index % 10);
      if (fighter.palette) {
        avatar.style.setProperty('--fighter-accent', fighter.palette.accent);
        avatar.style.setProperty('--fighter-shadow', fighter.palette.shadow);
      }
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = '✦';
      const name = document.createElement('strong');
      name.textContent = fighter.name;
      const archetype = document.createElement('small');
      archetype.textContent = fighter.archetype || 'Peleador';
      button.append(badge, avatar, name, archetype);
      button.addEventListener('click', () => toggleFighter(fighter.id));
      rosterRoot.append(button);
    });
    updateSelection();
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
    startButton.disabled = chosen.length !== 3;
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
    if (chosen.length !== 3) return;
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
    pauseOverlay.hidden = true;
    resultOverlay.hidden = true;
    document.getElementById('fighterPlayerName').textContent = playerName;
    window.CenGamesUI.showScreen('fighterGame');
    resizeCanvas();
    renderHud();
    draw();
    announce(`Comienza el combate. ${playerName}, tu equipo tiene tres peleadores.`);
    canvas.focus({ preventScroll: true });
    frameHandle = window.requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0);
  }

  function draw() {
    globalThis.CenFighterRenderer.draw(context, match, renderFrame);
  }

  function inputForPlayer() {
    const left = pressed.has('left');
    const right = pressed.has('right');
    return {
      moveX: left === right ? 0 : left ? -1 : 1,
      jump: pressed.has('jump'),
      crouch: pressed.has('crouch'),
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
    document.getElementById('fighterClock').textContent = phase === 'transition' ? '↻' : String(seconds).padStart(2, '0');
    document.getElementById('fighterClock').setAttribute('aria-label', phase === 'transition' ? 'Cambio de peleadores' : `Tiempo restante: ${seconds} segundos`);
    document.getElementById('fighterBoutLabel').textContent = phase === 'transition'
      ? 'Siguiente duelo'
      : `Combate ${match.boutNumber} de 5${duel.phase === 'sudden_death' ? ' · muerte súbita' : ''}`;
    const playerId = match.active.player;
    const cpuId = match.active.cpu;
    const player = match.combatants[playerId];
    const cpuFighter = match.combatants[cpuId];
    document.getElementById('fighterPlayerActive').textContent = player ? player.name : 'Sin peleador';
    document.getElementById('fighterCpuActive').textContent = cpuFighter ? cpuFighter.name : 'Sin peleador';
    const playerHealth = player ? (phase === 'fight' ? duel.left.health : player.health) : 0;
    const cpuHealth = cpuFighter ? (phase === 'fight' ? duel.right.health : cpuFighter.health) : 0;
    const playerMax = player ? player.maxHealth : 1;
    const cpuMax = cpuFighter ? cpuFighter.maxHealth : 1;
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
      pressed.clear();
      pendingAttack = null;
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
    pressed.clear();
    pendingAttack = null;
    match = null;
    controller = null;
    pauseOverlay.hidden = true;
    resultOverlay.hidden = true;
    window.CenGamesUI.showScreen('games');
  }

  function onKeyDown(event) {
    if (!sessionActive || paused || event.repeat) {
      if (event.code === 'Escape' && sessionActive && !paused) setPaused(true);
      return;
    }
    const controls = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
      ArrowDown: 'crouch', KeyS: 'crouch',
      KeyJ: 'block', ShiftLeft: 'block', ShiftRight: 'block'
    };
    if (controls[event.code]) {
      event.preventDefault();
      pressed.add(controls[event.code]);
    } else if (event.code === 'KeyU') {
      event.preventDefault();
      pendingAttack = 'light';
    } else if (event.code === 'KeyI') {
      event.preventDefault();
      pendingAttack = 'heavy';
    } else if (event.code === 'Escape') {
      event.preventDefault();
      setPaused(true);
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
        pendingAttack = button.dataset.fighterAttack;
        button.classList.add('is-pressed');
      });
      button.addEventListener('pointerup', () => button.classList.remove('is-pressed'));
      button.addEventListener('pointercancel', () => button.classList.remove('is-pressed'));
    });
  }

  function openFighterSetup() {
    chosen = [];
    roster = globalThis.CenFighterRoster?.entries || globalThis.CenFighterTeams.DEFAULT_ROSTER;
    renderRoster();
    window.CenGamesUI.showScreen('fighterSetup');
  }
  window.addEventListener('cengames:fighter-open', openFighterSetup);
  document.getElementById('fighterSetupBackButton').addEventListener('click', () => window.CenGamesUI.showScreen('games'));
  document.getElementById('resetFighterLearningButton').addEventListener('click', () => {
    const reset = globalThis.CenFighterLearning.resetPolicy(window.CenGamesUI.getProfileId() || playerName);
    announce(reset ? 'Aprendizaje de la CPU reiniciado para este perfil.' : 'El almacenamiento no está disponible ahora.');
  });
  startButton.addEventListener('click', startMatch);
  document.getElementById('fighterPauseButton').addEventListener('click', () => setPaused(true));
  document.getElementById('resumeFighterButton').addEventListener('click', () => setPaused(false));
  document.getElementById('abandonFighterButton').addEventListener('click', leaveMatch);
  document.getElementById('fighterResultContinueButton').addEventListener('click', leaveMatch);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('cengames:profile', (event) => {
    document.getElementById('fighterSetupBalance').textContent = String(event.detail.profile.cents || 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && sessionActive && !paused) setPaused(true);
  });
  bindTouchControls();
  renderRoster();
})();
