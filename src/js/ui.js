(() => {
  'use strict';

  const PLAYER_KEY = 'flappy_player_v1';
  const CHARACTER_KEY = 'flappy_character_v1';
  const CHARACTER_LABELS = {
    friend: 'el personaje de la casa',
    classic: 'el Canario',
    laguna: 'Laguna',
    mango: 'Mango'
  };
  const playerButton = document.getElementById('playerButton');
  const playerNameLabel = document.getElementById('playerNameLabel');
  const playerDialog = document.getElementById('playerDialog');
  const playerForm = document.getElementById('playerForm');
  const playerNameInput = document.getElementById('playerNameInput');
  const characterInput = document.getElementById('characterInput');
  const cancelPlayerButton = document.getElementById('cancelPlayerButton');
  const muteButton = document.getElementById('muteButton');
  const muteIcon = document.getElementById('muteIcon');
  const retryButton = document.getElementById('retryButton');
  const shareButton = document.getElementById('shareButton');
  const gameStatus = document.getElementById('gameStatus');

  function readPlayerName() {
    try {
      const saved = localStorage.getItem(PLAYER_KEY);
      if (saved) return saved.slice(0, 18);
    } catch (e) {
      // El nombre es opcional si el navegador bloquea el almacenamiento.
    }
    return 'Jugador';
  }

  function readCharacter() {
    try {
      const saved = localStorage.getItem(CHARACTER_KEY);
      if (['friend', 'classic', 'laguna', 'mango'].includes(saved)) return saved;
    } catch (e) {
      // Se usa el personaje inicial si el navegador bloquea el almacenamiento.
    }
    return 'friend';
  }

  let playerName = readPlayerName();
  let character = readCharacter();
  playerNameLabel.textContent = playerName;

  function announce(message) {
    gameStatus.textContent = '';
    window.setTimeout(() => { gameStatus.textContent = message; }, 30);
  }

  function updatePlayerName(name) {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 18);
    playerName = clean || 'Jugador';
    playerNameLabel.textContent = playerName;
    try {
      localStorage.setItem(PLAYER_KEY, playerName);
    } catch (e) {
      // El nombre permanece disponible hasta cerrar o recargar esta pestaña.
    }
  }

  function stopGamePointer(event) {
    event.stopPropagation();
  }

  [playerButton, muteButton, retryButton, shareButton].forEach((button) => {
    button.addEventListener('pointerdown', stopGamePointer);
  });

  playerButton.addEventListener('click', () => {
    playerNameInput.value = playerName === 'Jugador' ? '' : playerName;
    characterInput.value = character;
    if (typeof playerDialog.showModal === 'function') playerDialog.showModal();
    else playerDialog.setAttribute('open', '');
    window.setTimeout(() => playerNameInput.focus(), 0);
  });

  cancelPlayerButton.addEventListener('click', () => playerDialog.close());

  playerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    updatePlayerName(playerNameInput.value);
    character = ['friend', 'classic', 'laguna', 'mango'].includes(characterInput.value) ? characterInput.value : 'friend';
    try {
      localStorage.setItem(CHARACTER_KEY, character);
    } catch (e) {
      // La selección sigue activa hasta cerrar o recargar esta pestaña.
    }
    playerDialog.close();
    playerButton.focus();
    announce(`Listo, ${playerName}. ¡A volar!`);
  });

  function syncMuteButton(muted) {
    muteIcon.textContent = muted ? '🔇' : '🔊';
    muteButton.setAttribute('aria-pressed', String(!muted));
    muteButton.setAttribute('aria-label', muted ? 'Sonido silenciado' : 'Sonido activado');
  }

  syncMuteButton(window.FlappyAudio.isMuted());

  muteButton.addEventListener('click', () => {
    window.FlappyAudio.toggleMute();
  });

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
    const message = `${playerName} hizo ${score} puntos en Flappy Cen Pro con ${characterLabel}. Su récord personal es ${best}. ¿Puedes superarlo?`;
    const payload = {
      title: 'Flappy Cen Pro — Amigos al vuelo',
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
    getPlayerName() { return playerName; },
    getCharacter() { return character; }
  });

  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }, { once: true });
})();
