(() => {
  'use strict';

  const PLAYER_IDS_KEY = 'cengames_player_ids_v2';
  const PROFILE_PREFIX = 'cengames_economy_v2:';
  const FREE_AVATARS = ['sol', 'luna', 'pixel', 'rayo', 'ola'];
  const AVATARS = [
    { id: 'sol', name: 'Sol', price: 0, image: 'assets/avatars/sol.svg', mood: 'gold' },
    { id: 'luna', name: 'Luna', price: 0, image: 'assets/avatars/luna.svg', mood: 'lavender' },
    { id: 'pixel', name: 'Pixel', price: 0, image: 'assets/avatars/pixel.svg', mood: 'mint' },
    { id: 'rayo', name: 'Rayo', price: 0, image: 'assets/avatars/rayo.svg', mood: 'coral' },
    { id: 'ola', name: 'Ola', price: 0, image: 'assets/avatars/ola.svg', mood: 'blue' },
    { id: 'cometa', name: 'Cometa', price: 40, image: 'assets/avatars/cometa.svg', mood: 'mint' },
    { id: 'prisma', name: 'Prisma', price: 55, image: 'assets/avatars/prisma.svg', mood: 'lavender' },
    { id: 'orbita', name: 'Órbita', price: 70, image: 'assets/avatars/orbita.svg', mood: 'coral' },
    { id: 'flora', name: 'Flora', price: 85, image: 'assets/avatars/flora.svg', mood: 'gold' },
    { id: 'neon', name: 'Neón', price: 100, image: 'assets/avatars/neon.svg', mood: 'lavender' }
  ];
  const FREE_BIRDS = [
    { id: 'friend', name: 'Cen', icon: 'assets/images/personaje/cuerpo.png' },
    { id: 'classic', name: 'Canario', tone: 'canary' },
    { id: 'laguna', name: 'Laguna', tone: 'laguna' },
    { id: 'mango', name: 'Mango', tone: 'mango' },
    { id: 'nube', name: 'Nube', tone: 'nube' }
  ];
  const BETA_BIRDS = [
    { id: 'bird-cometa', name: 'Cometa' },
    { id: 'bird-coral', name: 'Coral' },
    { id: 'bird-noche', name: 'Noche' },
    { id: 'bird-lima', name: 'Lima' },
    { id: 'bird-ceniza', name: 'Ceniza' }
  ];

  const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const apiBase = isLocalHost ? 'http://127.0.0.1:8001/api' : '';
  let apiAvailable = false;
  let active = null;
  let profile = null;

  function normalizedName(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function readPlayerIds() {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYER_IDS_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      return {};
    }
  }

  function playerIdFor(name) {
    const key = normalizedName(name) || 'jugador';
    const ids = readPlayerIds();
    if (typeof ids[key] === 'string') return ids[key];
    ids[key] = uuid();
    try { localStorage.setItem(PLAYER_IDS_KEY, JSON.stringify(ids)); } catch (error) {}
    return ids[key];
  }

  function profileKey(id) { return PROFILE_PREFIX + id; }

  function readLocalProfile(id, name, legacyBest = 0) {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey(id)) || 'null');
      if (saved && saved.id === id && typeof saved === 'object') {
        saved.name = name;
        return saved;
      }
    } catch (error) {}
    return {
      id,
      name,
      avatarId: 'sol',
      characterId: 'friend',
      cents: 0,
      ownedAvatars: FREE_AVATARS.slice(),
      ownedBirds: ['friend', 'classic', 'laguna', 'mango', 'nube'],
      flappy: { plays: 0, points: 0, best: Math.max(0, Number(legacyBest) || 0) },
      processedRuns: []
    };
  }

  function saveLocalProfile(next) {
    profile = next;
    try { localStorage.setItem(profileKey(next.id), JSON.stringify(next)); } catch (error) {}
    emitProfile();
    return next;
  }

  function emitProfile(extra = {}) {
    if (!profile) return;
    window.dispatchEvent(new CustomEvent('cengames:profile', {
      detail: { profile: structuredCloneSafe(profile), remote: apiAvailable, ...extra }
    }));
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function remote(path, method = 'GET', data = {}) {
    const response = await fetch(apiBase + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Id': active.id,
        'X-Player-Name': active.name
      },
      body: method === 'GET' ? undefined : JSON.stringify(data),
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'No se pudo completar la acción.');
      error.remoteResponse = true;
      throw error;
    }
    apiAvailable = true;
    return payload;
  }

  function saveRemoteProfile(payload, extra = {}) {
    profile = payload.profile;
    try { localStorage.setItem(profileKey(profile.id), JSON.stringify(profile)); } catch (error) {}
    emitProfile(extra);
    return profile;
  }

  async function connect(name, legacyBest = 0) {
    const safeName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18) || 'Jugador';
    const id = playerIdFor(safeName);
    active = { id, name: safeName };
    apiAvailable = false;
    profile = readLocalProfile(id, safeName, legacyBest);
    emitProfile();

    if (apiBase) {
      try {
        const payload = await remote('/profile', 'POST', { name: safeName, legacyBest: Math.min(500, Number(legacyBest) || 0) });
        saveRemoteProfile(payload);
      } catch (error) {
        if (error.remoteResponse) console.warn('CenGames API:', error.message);
      }
    }
    return getProfile();
  }

  async function actionOrLocal(path, body, updateLocal) {
    if (apiAvailable) {
      try {
        return saveRemoteProfile(await remote(path, 'POST', body));
      } catch (error) {
        if (error.remoteResponse) throw error;
        apiAvailable = false;
      }
    }
    return saveLocalProfile(updateLocal(structuredCloneSafe(profile)));
  }

  function getProfile() { return profile ? structuredCloneSafe(profile) : null; }
  function getAvatarCatalog() { return AVATARS.map((item) => ({ ...item })); }
  function getFreeBirds() { return FREE_BIRDS.map((item) => ({ ...item })); }
  function getBetaBirds() { return BETA_BIRDS.map((item) => ({ ...item })); }
  function avatarById(id) { return AVATARS.find((item) => item.id === id) || AVATARS[0]; }

  async function completeRun(score, best, runId = uuid()) {
    if (!profile || !active) return null;
    const points = Math.max(0, Math.min(500, Math.floor(Number(score) || 0)));
    const runKey = runId;
    return actionOrLocal('/runs', { name: active.name, gameId: 'flappy', runId: runKey, score: points }, (next) => {
      const runs = Array.isArray(next.processedRuns) ? next.processedRuns : [];
      if (runs.includes(runKey)) return next;
      runs.push(runKey);
      next.processedRuns = runs.slice(-2000);
      next.cents = Math.max(0, Number(next.cents) || 0) + points;
      next.flappy = next.flappy || { plays: 0, points: 0, best: 0 };
      next.flappy.plays = (Number(next.flappy.plays) || 0) + 1;
      next.flappy.points = (Number(next.flappy.points) || 0) + points;
      next.flappy.best = Math.max(Number(next.flappy.best) || 0, Number(best) || 0, points);
      next.earnedCents = points;
      return next;
    });
  }

  async function buyAvatar(avatarId) {
    const avatar = avatarById(avatarId);
    if (!profile || !active || !avatar.price) throw new Error('Ese artículo no se puede comprar.');
    return actionOrLocal('/store/purchase', { name: active.name, avatarId }, (next) => {
      next.ownedAvatars = Array.isArray(next.ownedAvatars) ? next.ownedAvatars : FREE_AVATARS.slice();
      if (next.ownedAvatars.includes(avatarId)) {
        next.purchaseStatus = 'already-owned';
        return next;
      }
      if ((Number(next.cents) || 0) < avatar.price) throw new Error('Aún no tienes suficientes Cent.');
      next.cents -= avatar.price;
      next.ownedAvatars.push(avatarId);
      next.purchaseStatus = 'purchased';
      next.spentCents = avatar.price;
      return next;
    });
  }

  async function chooseAvatar(avatarId) {
    if (!profile || !active) return null;
    return actionOrLocal('/profile/avatar', { name: active.name, avatarId }, (next) => {
      if (!(next.ownedAvatars || FREE_AVATARS).includes(avatarId)) throw new Error('Primero consigue ese avatar en la tienda.');
      next.avatarId = avatarId;
      return next;
    });
  }

  async function chooseBird(characterId) {
    if (!profile || !active) return null;
    return actionOrLocal('/profile/character', { name: active.name, characterId }, (next) => {
      if (!['friend', 'classic', 'laguna', 'mango', 'nube'].includes(characterId)) throw new Error('Ese pájaro todavía no está disponible.');
      next.characterId = characterId;
      return next;
    });
  }

  async function leaderboard() {
    if (apiBase && apiAvailable) {
      try {
        const response = await fetch(apiBase + '/leaderboard', { cache: 'no-store' });
        if (response.ok) return { entries: (await response.json()).entries || [], remote: true };
      } catch (error) { apiAvailable = false; }
    }
    const profiles = Object.values(readPlayerIds()).map((id) => {
      try { return JSON.parse(localStorage.getItem(profileKey(id)) || 'null'); } catch (error) { return null; }
    }).filter((item) => item && Number(item.flappy && item.flappy.best) > 0);
    profiles.sort((a, b) => Number(b.flappy.best) - Number(a.flappy.best));
    return {
      remote: false,
      entries: profiles.slice(0, 20).map((item) => ({
        id: item.id, name: item.name, avatarId: item.avatarId, characterId: item.characterId,
        score: item.flappy.best, updatedAt: item.updatedAt || 0
      }))
    };
  }

  window.CenEconomy = Object.freeze({
    connect,
    getProfile,
    getAvatarCatalog,
    getFreeBirds,
    getBetaBirds,
    avatarById,
    completeRun,
    buyAvatar,
    chooseAvatar,
    chooseBird,
    leaderboard,
    isRemote() { return apiAvailable; }
  });
})();
