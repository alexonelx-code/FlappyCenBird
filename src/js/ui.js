(() => {
  'use strict';

  const PLAYER_KEY = 'flappy_player_v1';
  const CHARACTER_KEY = 'flappy_character_v1';
  const CHARACTER_SELECTED_KEY = 'flappy_character_selected_v1';
  const LEADERBOARD_KEY = 'flappy_leaderboard_v1';
  const PROFILE_STATS_KEY = 'cengames_profile_stats_v1';

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
  const registrationSubmitLabel = document.getElementById('registrationSubmitLabel');
  const nicknameInput = document.getElementById('nicknameInput');
  const characterBackButton = document.getElementById('characterBackButton');
  const characterTitle = document.getElementById('characterTitle');
  const characterOptions = [...document.querySelectorAll('[data-character]')];
  const characterConfirmButton = document.getElementById('characterConfirmButton');
  const lobbyName = document.getElementById('lobbyName');
  const profileButton = document.getElementById('profileButton');
  const profileDialog = document.getElementById('profileDialog');
  const profileName = document.getElementById('profileName');
  const profileFlappyPlays = document.getElementById('profileFlappyPlays');
  const profileFlappyBest = document.getElementById('profileFlappyBest');
  const profileFlappyPoints = document.getElementById('profileFlappyPoints');
  const lobbyCentBalance = document.getElementById('lobbyCentBalance');
  const profileCentBalance = document.getElementById('profileCentBalance');
  const storeDialog = document.getElementById('storeDialog');
  const lobbyAvatar = document.getElementById('lobbyAvatar');
  const profileAvatar = document.getElementById('profileAvatar');
  const logoutButton = document.getElementById('logoutButton');
  const editNameButton = document.getElementById('editNameButton');
  const exitGamesButton = document.getElementById('exitGamesButton');
  const flappyCard = document.getElementById('flappyCard');
  const gameMenuButton = document.getElementById('gameMenuButton');
  const gameMenuDialog = document.getElementById('gameMenuDialog');
  const shopButton = document.getElementById('shopButton');
  const gameShopButton = document.getElementById('gameShopButton');
  const themeToggleButton = document.getElementById('themeToggleButton');
  const screenThemeToggleButton = document.getElementById('screenThemeToggleButton');
  const menuThemeButton = document.getElementById('menuThemeButton');
  const menuThemeLabel = document.getElementById('menuThemeLabel');
  const storeCatalog = document.getElementById('storeCatalog');
  const storeFeedback = document.getElementById('storeFeedback');
  const storeTabs = [...document.querySelectorAll('[data-store-tab]')];
  const flappyStoreTabs = document.getElementById('flappyStoreTabs');
  const flappyStoreSubtabs = [...document.querySelectorAll('[data-store-subtab]')];
  const backToGamesButton = document.getElementById('backToGamesButton');
  const changeCharacterButton = document.getElementById('changeCharacterButton');
  const continueGameButton = document.getElementById('continueGameButton');
  const leaderboardButton = document.getElementById('leaderboardButton');
  const leaderboardDialog = document.getElementById('leaderboardDialog');
  const leaderboardList = document.getElementById('leaderboardList');
  const muteButton = document.getElementById('menuMuteButton');
  const muteWaves = document.getElementById('muteWaves');
  const muteSlash = document.getElementById('muteSlash');
  const muteLabel = document.getElementById('muteLabel');
  const retryButton = document.getElementById('retryButton');
  const gameStatus = document.getElementById('gameStatus');
  const appDialogs = [leaderboardDialog, profileDialog, storeDialog, gameMenuDialog];
  const dialogCloseTimers = new WeakMap();

  function syncThemeControls() {
    if (!window.CenTheme) return;
    const isLight = window.CenTheme.getTheme() === 'light';
    const label = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    const title = isLight ? 'Modo oscuro' : 'Modo claro';
    [themeToggleButton, screenThemeToggleButton, menuThemeButton].forEach((button) => {
      if (!button) return;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', title);
    });
    if (menuThemeLabel) menuThemeLabel.textContent = title;
  }

  function toggleTheme() {
    if (window.CenTheme) window.CenTheme.toggle();
  }
  themeToggleButton.addEventListener('click', toggleTheme);
  screenThemeToggleButton.addEventListener('click', toggleTheme);
  menuThemeButton.addEventListener('click', toggleTheme);
  window.addEventListener('cengames:theme', syncThemeControls);
  syncThemeControls();

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
      if (['friend', 'classic', 'laguna', 'mango', 'nube'].includes(saved)) return saved;
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
    profileName.textContent = playerName || 'Jugador';
    try {
      if (playerName) localStorage.setItem(PLAYER_KEY, playerName);
      else localStorage.removeItem(PLAYER_KEY);
    } catch (error) {
      // El nombre sigue activo durante esta sesión aunque no se pueda guardar.
    }
    if (playerName && window.CenEconomy) {
      window.CenEconomy.connect(playerName, readLegacyBest()).then(updateEconomyUI).catch(() => {});
    }
  }

  function readLegacyBest() {
    if (!playerName) return 0;
    const safeName = normalizedPlayerName(playerName).replace(/[^a-z0-9]+/g, '-');
    try {
      return Math.max(0, Number(localStorage.getItem(`flappy_best_v1:player:${encodeURIComponent(safeName || 'jugador')}`)) || 0);
    } catch (error) {
      return 0;
    }
  }

  function updateEconomyUI(nextProfile = window.CenEconomy && window.CenEconomy.getProfile()) {
    if (!nextProfile) return;
    const cents = Math.max(0, Number(nextProfile.cents) || 0);
    const avatar = window.CenEconomy.avatarById(nextProfile.avatarId);
    lobbyCentBalance.textContent = String(cents);
    profileCentBalance.textContent = String(cents);
    lobbyAvatar.src = avatar.image;
    profileAvatar.src = avatar.image;
    profileAvatar.alt = '';
    lobbyAvatar.alt = '';
    profileButton.setAttribute('aria-label', `Mi perfil: ${playerName || 'Jugador'}`);
    shopButton.setAttribute('aria-label', `Abrir tienda. Saldo: ${cents} Cent`);
    if (document.getElementById('storeDialog').open) storeUI.render();
    if (profileDialog.open) renderProfile();
    if (leaderboardDialog.open) renderLeaderboard();
  }

  function setScreen(name) {
    Object.entries(screens).forEach(([screenName, element]) => {
      element.hidden = screenName !== name;
    });
    screenThemeToggleButton.hidden = name === 'games' || name === 'game';
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
    registrationTitle.textContent = editing ? 'Cambiar jugador' : 'Tu nombre';
    registrationDescription.textContent = editing
      ? 'Escribe un nombre o apodo para cambiar de perfil.'
      : 'Después eliges un juego.';
    registrationSubmitLabel.textContent = editing ? 'Cambiar jugador' : 'Elegir juego';
    nicknameInput.value = editing ? '' : playerName;
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
    if (window.CenEconomy) window.CenEconomy.chooseBird(character).then(updateEconomyUI).catch((error) => announce(error.message));
  }

  function selectCharacterFromStore(id) {
    character = id;
    hasChosenCharacter = true;
    try {
      localStorage.setItem(CHARACTER_KEY, id);
      localStorage.setItem(CHARACTER_SELECTED_KEY, 'true');
    } catch (error) {}
    updateCharacterOptions();
  }

  function launchFlappy() {
    setScreen('game');
    if (window.FlappyGame) window.FlappyGame.reset();
    document.getElementById('game').focus({ preventScroll: true });
  }

  function closeDialog(dialog, animate = true) {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    if (!animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finishDialogClose(dialog);
      return;
    }
    dialog.classList.add('is-closing');
    dialogCloseTimers.set(dialog, window.setTimeout(() => finishDialogClose(dialog), 200));
  }

  function finishDialogClose(dialog) {
    const timer = dialogCloseTimers.get(dialog);
    if (timer) window.clearTimeout(timer);
    dialogCloseTimers.delete(dialog);
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    dialog.classList.remove('is-closing');
  }

  function openDialog(dialog) {
    const timer = dialogCloseTimers.get(dialog);
    if (timer) window.clearTimeout(timer);
    dialogCloseTimers.delete(dialog);
    dialog.classList.remove('is-closing');
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  appDialogs.forEach((dialog) => {
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener('submit', (event) => {
      if (event.target instanceof HTMLFormElement && event.target.method === 'dialog') {
        event.preventDefault();
        closeDialog(dialog);
      }
    }, true);
  });

  function signOut() {
    [profileDialog, gameMenuDialog, leaderboardDialog, storeDialog].forEach((dialog) => closeDialog(dialog, false));
    updatePlayerName('');
    character = 'friend';
    hasChosenCharacter = false;
    pendingCharacter = '';
    try {
      localStorage.removeItem(CHARACTER_KEY);
      localStorage.removeItem(CHARACTER_SELECTED_KEY);
    } catch (error) {
      // La sesión se cierra también si el navegador bloquea el almacenamiento.
    }
    setScreen('welcome');
  }

  function stopGamePointer(event) {
    event.stopPropagation();
  }

  [leaderboardButton, muteButton, gameMenuButton, retryButton].forEach((button) => {
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
  editNameButton.addEventListener('click', () => {
    closeDialog(profileDialog, false);
    openRegistration('games', true);
  });
  exitGamesButton.addEventListener('click', signOut);

  registrationForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nicknameInput.value.replace(/\s+/g, ' ').trim().slice(0, 18);
    if (!name) {
      nicknameInput.focus();
      return;
    }
    if (playerName && normalizedPlayerName(name) !== normalizedPlayerName(playerName)) {
      character = 'friend';
      hasChosenCharacter = false;
      pendingCharacter = '';
      try {
        localStorage.removeItem(CHARACTER_KEY);
        localStorage.removeItem(CHARACTER_SELECTED_KEY);
      } catch (error) {
        // La selección nueva queda limpia durante esta sesión.
      }
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
    openDialog(gameMenuDialog);
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
    closeDialog(gameMenuDialog, false);
    if (window.FlappyGame) window.FlappyGame.reset();
    setScreen('games');
  });

  changeCharacterButton.addEventListener('click', () => {
    closeDialog(gameMenuDialog, false);
    openCharacterPicker('game');
  });

  continueGameButton.addEventListener('click', () => closeDialog(gameMenuDialog));

  const storeUI = window.CenStoreUI.init({
    storeDialog: document.getElementById('storeDialog'),
    gameMenuDialog,
    storeCatalog: document.getElementById('storeCatalog'),
    storeFeedback: document.getElementById('storeFeedback'),
    storeTabs: [...document.querySelectorAll('[data-store-tab]')],
    flappyStoreTabs: document.getElementById('flappyStoreTabs'),
    flappyStoreSubtabs: [...document.querySelectorAll('[data-store-subtab]')],
    storeCentBalance: document.getElementById('storeCentBalance'),
    characterOptions,
    shopButton,
    gameShopButton,
    openDialog,
    closeGameMenu: () => closeDialog(gameMenuDialog, false),
    getCharacter: () => character,
    selectCharacterFromStore,
    updateCharacterOptions,
    updateEconomyUI: () => updateEconomyUI(),
    announce
  });

  function normalizedPlayerName(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  }

  function profileStatsStorageKey(name = playerName) {
    return `${PROFILE_STATS_KEY}:${encodeURIComponent(normalizedPlayerName(name) || 'jugador')}`;
  }

  function readProfileStats(name = playerName) {
    try {
      const stored = JSON.parse(localStorage.getItem(profileStatsStorageKey(name)) || '{}');
      const flappy = stored.flappy && typeof stored.flappy === 'object' ? stored.flappy : {};
      return {
        plays: Math.max(0, Number(flappy.plays) || 0),
        points: Math.max(0, Number(flappy.points) || 0),
        best: Math.max(0, Number(flappy.best) || 0)
      };
    } catch (error) {
      return { plays: 0, points: 0, best: 0 };
    }
  }

  function recordFlappyResult(score, best) {
    if (!playerName) return;
    const stats = readProfileStats();
    stats.plays += 1;
    stats.points += Math.max(0, Number(score) || 0);
    stats.best = Math.max(stats.best, Math.max(0, Number(best) || 0));
    try {
      localStorage.setItem(profileStatsStorageKey(), JSON.stringify({ flappy: stats }));
    } catch (error) {
      // Las estadísticas viven en esta sesión aunque el almacenamiento no esté disponible.
    }
  }

  function renderProfile() {
    const economyProfile = window.CenEconomy && window.CenEconomy.getProfile();
    const storedStats = readProfileStats();
    const remoteStats = economyProfile && economyProfile.flappy ? economyProfile.flappy : {};
    const stats = {
      plays: Math.max(Number(storedStats.plays) || 0, Number(remoteStats.plays) || 0),
      points: Math.max(Number(storedStats.points) || 0, Number(remoteStats.points) || 0),
      best: Math.max(Number(storedStats.best) || 0, Number(remoteStats.best) || 0)
    };
    const liveBest = window.FlappyGame && typeof window.FlappyGame.getBestScore === 'function'
      ? window.FlappyGame.getBestScore()
      : 0;
    profileName.textContent = playerName || 'Jugador';
    profileFlappyPlays.textContent = String(stats.plays);
    profileFlappyBest.textContent = String(Math.max(stats.best, liveBest));
    profileFlappyPoints.textContent = String(stats.points);
    if (economyProfile) profileCentBalance.textContent = String(Math.max(0, Number(economyProfile.cents) || 0));
  }

  profileButton.addEventListener('click', () => {
    renderProfile();
    openDialog(profileDialog);
  });

  logoutButton.addEventListener('click', signOut);

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
    const currentProfile = window.CenEconomy.getProfile();
    nextEntries.push({
      name,
      score: bestScore,
      avatarId: currentProfile && currentProfile.avatarId || 'sol',
      characterId: character,
      updatedAt: Date.now()
    });
    nextEntries.sort((a, b) => Number(b.score) - Number(a.score) || Number(a.updatedAt || 0) - Number(b.updatedAt || 0));
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(nextEntries.slice(0, 20)));
    } catch (error) {
      // El marcador del juego sigue disponible aunque no se pueda guardar el ranking.
    }
  }

  async function renderLeaderboard() {
    const result = await window.CenEconomy.leaderboard();
    let entries = result.entries || [];
    if (!result.remote) {
      const legacy = readLeaderboard();
      legacy.forEach((oldEntry) => {
        const match = entries.find((entry) => normalizedPlayerName(entry.name) === normalizedPlayerName(oldEntry.name));
        if (match) match.score = Math.max(Number(match.score) || 0, Number(oldEntry.score) || 0);
        else entries.push(oldEntry);
      });
    }
    entries = entries.sort((a, b) => Number(b.score) - Number(a.score) || Number(a.updatedAt || 0) - Number(b.updatedAt || 0)).slice(0, 10);
    document.getElementById('leaderboardNote').textContent = result.remote
      ? 'Mejores récords guardados en esta instalación local.'
      : 'Mejores récords guardados en este dispositivo.';
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
      const avatar = document.createElement('img');
      avatar.className = 'leaderboard-avatar';
      avatar.src = window.CenEconomy.avatarById(entry.avatarId).image;
      avatar.alt = '';
      const name = document.createElement('span');
      name.className = 'leaderboard-name';
      name.textContent = entry.name;
      if (normalizedPlayerName(entry.name) === normalizedPlayerName(playerName)) {
        row.classList.add('is-current-player');
      }
      const score = document.createElement('span');
      score.className = 'leaderboard-score';
      score.append(document.createTextNode(String(Number(entry.score))));
      const unit = document.createElement('small');
      unit.textContent = 'PTS';
      score.appendChild(unit);
      row.append(rank, avatar, name, score);
      leaderboardList.appendChild(row);
    });
  }

  leaderboardButton.addEventListener('click', () => {
    renderLeaderboard();
    openDialog(leaderboardDialog);
  });

  function syncMuteButton(muted) {
    muteWaves.hidden = muted;
    muteSlash.hidden = !muted;
    muteButton.setAttribute('aria-pressed', String(!muted));
    muteButton.setAttribute('aria-label', muted ? 'Sonido silenciado' : 'Silenciar sonido');
    muteLabel.textContent = muted ? 'Sonido desactivado' : 'Sonido activado';
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

    if (state === 'ready') {
      announce(`Récord personal: ${best}. Toca para jugar.`);
    } else if (state === 'playing') {
      announce('Partida en curso. Toca para aletear.');
    } else if (state === 'gameover') {
      saveLeaderboardScore(playerName, score);
      recordFlappyResult(score, best);
      window.CenEconomy.completeRun(score, best).then((nextProfile) => {
        updateEconomyUI(nextProfile);
        if (leaderboardDialog.open) renderLeaderboard();
      }).catch((error) => {
        announce(`Partida guardada en el dispositivo. ${error.message}`);
      });
      if (leaderboardDialog.open) renderLeaderboard();
      announce(`Fin de la partida. ${playerName} hizo ${score} puntos y ganó ${score} Cent. Récord personal: ${best}.`);
    }
  });

  window.addEventListener('flappy:score', (event) => {
    announce(`¡Punto! Puntuación: ${event.detail.score}.`);
  });

  window.addEventListener('cengames:profile', (event) => updateEconomyUI(event.detail.profile));

  window.FlappyUI = Object.freeze({
    getPlayerName() { return playerName || 'Jugador'; },
    hasPlayerName() { return Boolean(playerName); },
    getCharacter() { return character; }
  });

  lobbyName.textContent = playerName || 'Jugador';
  updateCharacterOptions();
  setScreen('welcome');
  if (playerName) window.CenEconomy.connect(playerName, readLegacyBest()).then(updateEconomyUI).catch(() => {});

  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }, { once: true });
})();
