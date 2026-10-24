(() => {
  'use strict';

  const PLAYER_KEY = 'flappy_player_v1';
  const CHARACTER_KEY = 'flappy_character_v1';
  const CHARACTER_SELECTED_KEY = 'flappy_character_selected_v1';
  const LEADERBOARD_KEY = 'flappy_leaderboard_v1';
  const CHARACTER_LABELS = {
    friend: 'el personaje de la casa',
    classic: 'el Canario',
    laguna: 'Laguna',
    mango: 'Mango'
  };

  const screens = {
    welcome: document.getElementById('welcomeScreen'),
    registration: document.getElementById('registrationScreen'),
    character: document.getElementById('characterScreen'),
    games: document.getElementById('gamesScreen'),
    game: document.getElementById('gameScreen')
  };
  const startButton = document.getElementById('startButton');
  const registrationBackButton = document.getElementById('registrationBackButton');
  const registrationTitle = document.getElementById('registrationTitle');
  const registrationDescription = document.getElementById('registrationDescription');
  const registrationForm = document.getElementById('registrationForm');
  const registrationSubmit = document.getElementById('registrationSubmit');
  const nicknameInput = document.getElementById('nicknameInput');
  const characterBackButton = document.getElementById('characterBackButton');
  const characterTitle = document.getElementById('characterTitle');
  const characterDescription = document.getElementById('characterDescription');
  const characterOptions = [...document.querySelectorAll('[data-character]')];
  const characterConfirmButton = document.getElementById('characterConfirmButton');
  const lobbyName = document.getElementById('lobbyName');
  const editNameButton = document.getElementById('editNameButton');
  const exitGamesButton = document.getElementById('exitGamesButton');
  const flappyCard = document.getElementById('flappyCard');
  const gameMenuButton = document.getElementById('gameMenuButton');
  const gameMenuDialog = document.getElementById('gameMenuDialog');
  const backToGamesButton = document.getElementById('backToGamesButton');
  const changeCharacterButton = document.getElementById('changeCharacterButton');
  const continueGameButton = document.getElementById('continueGameButton');
  const leaderboardButton = document.getElementById('leaderboardButton');
  const leaderboardDialog = document.getElementById('leaderboardDialog');
  const leaderboardList = document.getElementById('leaderboardList');
  const muteButton = document.getElementById('muteButton');
  const muteWaves = document.getElementById('muteWaves');
  const muteSlash = document.getElementById('muteSlash');
  const retryButton = document.getElementById('retryButton');
  const shareButton = document.getElementById('shareButton');
  const gameStatus = document.getElementById('gameStatus');

  function readPlayerName() {
    try {
      return (localStorage.getItem(PLAYER_KEY) || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    } catch (error) {
      return '';
    }
  }

  function readCharacter() {
    try {
      const saved = localStorage.getItem(CHARACTER_KEY);
      if (['friend', 'classic', 'laguna', 'mango'].includes(saved)) return saved;
    } catch (error) {
      // Se conserva el personaje inicial si el navegador bloquea el almacenamiento.
    }
    return 'friend';
  }

  function readCharacterSelection() {
    try {
      return localStorage.getItem(CHARACTER_SELECTED_KEY) === 'true';
    } catch (error) {
      return false;
    }
  }

  let playerName = readPlayerName();
  let character = readCharacter();
  let hasChosenCharacter = readCharacterSelection();
  let pendingCharacter = hasChosenCharacter ? character : '';
  let registrationReturnScreen = 'welcome';
  let characterReturnScreen = 'games';

  function announce(message) {
    gameStatus.textContent = '';
    window.setTimeout(() => { gameStatus.textContent = message; }, 30);
  }

  function updatePlayerName(name) {
    playerName = name.replace(/\s+/g, ' ').trim().slice(0, 18);
    lobbyName.textContent = playerName || 'Jugador';
    try {
      if (playerName) localStorage.setItem(PLAYER_KEY, playerName);
      else localStorage.removeItem(PLAYER_KEY);
    } catch (error) {
      // El nombre sigue activo durante esta sesión aunque no se pueda guardar.
    }
  }

  function setScreen(name) {
    Object.entries(screens).forEach(([screenName, element]) => {
      element.hidden = screenName !== name;
    });
    document.title = name === 'game' ? 'Flappy BirdCen | CenGames' : 'CenGames';
    window.scrollTo(0, 0);
    const focusTarget = name === 'welcome'
      ? document.getElementById('welcomeTitle')
      : name === 'games'
        ? document.getElementById('gamesTitle')
        : name === 'character'
          ? characterTitle
          : name === 'game'
            ? document.getElementById('game')
            : null;
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function openRegistration(returnTo, editing = false) {
    registrationReturnScreen = returnTo;
    registrationTitle.textContent = editing ? 'Cambia tu nombre' : 'Tu nombre';
    registrationDescription.textContent = editing
      ? 'Actualiza tu nombre.'
      : 'Después eliges un juego.';
    registrationSubmit.innerHTML = editing
      ? 'Guardar <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" /></svg>'
      : 'Elegir juego <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" /></svg>';
    registrationBackButton.textContent = '';
    registrationBackButton.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6m5 5-5-5 5-5" /></svg> Volver');
    nicknameInput.value = playerName;
    setScreen('registration');
    window.setTimeout(() => nicknameInput.focus(), 0);
  }

  function updateCharacterOptions() {
    characterOptions.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.character === pendingCharacter));
    });
    characterConfirmButton.disabled = !pendingCharacter;
  }

  function openCharacterPicker(returnTo) {
    characterReturnScreen = returnTo;
    pendingCharacter = hasChosenCharacter ? character : '';
    characterTitle.textContent = 'Elige tu personaje';
    characterDescription.textContent = hasChosenCharacter
      ? 'Puedes cambiarlo cuando quieras.'
      : 'Escoge con quién vas a jugar.';
    updateCharacterOptions();
    setScreen('character');
  }

  function saveCharacterSelection(nextCharacter) {
    character = nextCharacter;
    hasChosenCharacter = true;
    try {
      localStorage.setItem(CHARACTER_KEY, character);
      localStorage.setItem(CHARACTER_SELECTED_KEY, 'true');
    } catch (error) {
      // La selección permanece activa durante esta sesión aunque el navegador no la guarde.
    }
  }

  function launchFlappy() {
    setScreen('game');
    if (window.FlappyGame) window.FlappyGame.reset();
    document.getElementById('game').focus({ preventScroll: true });
  }

  function closeDialog(dialog) {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function stopGamePointer(event) {
    event.stopPropagation();
  }

  [leaderboardButton, muteButton, gameMenuButton, retryButton, shareButton].forEach((button) => {
    button.addEventListener('pointerdown', stopGamePointer);
  });

  startButton.addEventListener('click', () => {
    if (playerName) {
      lobbyName.textContent = playerName;
      setScreen('games');
    } else {
      openRegistration('welcome');
    }
  });

  registrationBackButton.addEventListener('click', () => setScreen(registrationReturnScreen));
  editNameButton.addEventListener('click', () => openRegistration('games', true));
  exitGamesButton.addEventListener('click', () => setScreen('welcome'));

  registrationForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nicknameInput.value.replace(/\s+/g, ' ').trim().slice(0, 18);
    if (!name) {
      nicknameInput.focus();
      return;
    }
    updatePlayerName(name);
    setScreen('games');
    announce(`¡Qué onda, ${playerName}! Elige tu juego.`);
  });

  flappyCard.addEventListener('click', () => {
    if (!hasChosenCharacter) openCharacterPicker('games');
    else launchFlappy();
  });

  gameMenuButton.addEventListener('click', () => {
    if (typeof gameMenuDialog.showModal === 'function') gameMenuDialog.showModal();
    else gameMenuDialog.setAttribute('open', '');
  });

  characterOptions.forEach((button) => {
    button.addEventListener('click', () => {
      pendingCharacter = button.dataset.character;
      updateCharacterOptions();
    });
  });

  characterConfirmButton.addEventListener('click', () => {
    if (!pendingCharacter) return;
    saveCharacterSelection(pendingCharacter);
    launchFlappy();
  });

  characterBackButton.addEventListener('click', () => {
    if (characterReturnScreen === 'game' && hasChosenCharacter) launchFlappy();
    else setScreen('games');
  });

  backToGamesButton.addEventListener('click', () => {
    closeDialog(gameMenuDialog);
    if (window.FlappyGame) window.FlappyGame.reset();
    setScreen('games');
  });

  changeCharacterButton.addEventListener('click', () => {
    closeDialog(gameMenuDialog);
    openCharacterPicker('game');
  });

  continueGameButton.addEventListener('click', () => closeDialog(gameMenuDialog));

  function normalizedPlayerName(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  }

  function readLeaderboard() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry) => entry && typeof entry.name === 'string' && Number.isFinite(Number(entry.score)));
    } catch (error) {
      return [];
    }
  }

  function saveLeaderboardScore(name, score) {
    if (!name || score <= 0) return;
    const entries = readLeaderboard();
    const nameKey = normalizedPlayerName(name);
    const existing = entries.find((entry) => normalizedPlayerName(entry.name) === nameKey);
    const bestScore = Math.max(score, existing ? Number(existing.score) : 0);
    const nextEntries = entries.filter((entry) => normalizedPlayerName(entry.name) !== nameKey);
    nextEntries.push({ name, score: bestScore, updatedAt: Date.now() });
    nextEntries.sort((a, b) => Number(b.score) - Number(a.score) || Number(a.updatedAt || 0) - Number(b.updatedAt || 0));
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(nextEntries.slice(0, 20)));
    } catch (error) {
      // El marcador del juego sigue disponible aunque no se pueda guardar el ranking.
    }
  }

  function renderLeaderboard() {
    const entries = readLeaderboard().sort((a, b) => Number(b.score) - Number(a.score) || Number(a.updatedAt || 0) - Number(b.updatedAt || 0)).slice(0, 10);
    leaderboardList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Todavía no hay puntuaciones. Juega una partida y estrena la tabla.';
      leaderboardList.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const row = document.createElement('li');
      row.className = 'leaderboard-row';
      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'leaderboard-name';
      name.textContent = entry.name;
      if (normalizedPlayerName(entry.name) === normalizedPlayerName(playerName)) {
        const you = document.createElement('small');
        you.textContent = ' · tú';
        name.appendChild(you);
      }
      const score = document.createElement('span');
      score.className = 'leaderboard-score';
      score.append(document.createTextNode(String(Number(entry.score))));
      const unit = document.createElement('small');
      unit.textContent = 'PTS';
      score.appendChild(unit);
      row.append(rank, name, score);
      leaderboardList.appendChild(row);
    });
  }

  leaderboardButton.addEventListener('click', () => {
    renderLeaderboard();
    if (typeof leaderboardDialog.showModal === 'function') leaderboardDialog.showModal();
    else leaderboardDialog.setAttribute('open', '');
  });

  function syncMuteButton(muted) {
    muteWaves.hidden = muted;
    muteSlash.hidden = !muted;
    muteButton.setAttribute('aria-pressed', String(!muted));
    muteButton.setAttribute('aria-label', muted ? 'Sonido silenciado' : 'Silenciar sonido');
  }

  syncMuteButton(window.FlappyAudio.isMuted());
  muteButton.addEventListener('click', () => window.FlappyAudio.toggleMute());
  window.addEventListener('flappy:mute', (event) => {
    syncMuteButton(event.detail.muted);
    announce(event.detail.muted ? 'Sonido desactivado.' : 'Sonido activado.');
  });

  window.addEventListener('flappy:state', (event) => {
    const { state, score, best } = event.detail;
    retryButton.hidden = state !== 'gameover';
    shareButton.hidden = state !== 'gameover';
    shareButton.dataset.score = String(score);
    shareButton.dataset.best = String(best);

    if (state === 'ready') {
      announce(`Récord personal: ${best}. Toca el juego para volar.`);
    } else if (state === 'playing') {
      announce('Partida en curso. Toca para aletear.');
    } else if (state === 'gameover') {
      saveLeaderboardScore(playerName, score);
      if (leaderboardDialog.open) renderLeaderboard();
      announce(`Fin de la partida. ${playerName} hizo ${score} puntos. Récord personal: ${best}.`);
    }
  });

  window.addEventListener('flappy:score', (event) => {
    announce(`¡Punto! Puntuación: ${event.detail.score}.`);
  });

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) window.prompt('Copia tu reto para compartirlo:', text);
  }

  shareButton.addEventListener('click', async () => {
    const score = Number(shareButton.dataset.score) || 0;
    const best = Number(shareButton.dataset.best) || score;
    const characterLabel = CHARACTER_LABELS[character] || 'su personaje';
    const message = `${playerName} hizo ${score} puntos en Flappy BirdCen con ${characterLabel}. Su récord personal es ${best}. ¿Puedes superarlo?`;
    const payload = {
      title: 'Flappy BirdCen',
      text: message,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        announce('Reto compartido. ¡A ver quién lo supera!');
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }

    try {
      await copyText(`${message}\n${window.location.href}`);
      announce('Reto y enlace copiados. Ya puedes pegarlos en el chat.');
    } catch (error) {
      window.prompt('Copia tu reto para compartirlo:', `${message}\n${window.location.href}`);
    }
  });

  window.FlappyUI = Object.freeze({
    getPlayerName() { return playerName || 'Jugador'; },
    hasPlayerName() { return Boolean(playerName); },
    getCharacter() { return character; }
  });

  lobbyName.textContent = playerName || 'Jugador';
  updateCharacterOptions();
  setScreen('welcome');

  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }, { once: true });
})();
