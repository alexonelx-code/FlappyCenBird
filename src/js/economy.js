(() => {
  'use strict';

  const PLAYER_IDS_KEY = 'cengames_player_ids_v2';
  const PROFILE_PREFIX = 'cengames_economy_v2:';
  const MAX_RUN_SCORE = 10_000;
  const FREE_AVATARS = ['sol', 'luna', 'pixel', 'rayo', 'ola'];
  const BACKGROUNDS = [
    { id: 'costa', name: 'Costa dorada', price: 0, free: true, scene: 'coast', sky: ['#1b394b', '#4f7880', '#efa47e'], hills: ['#426a68', '#244b50'], floor: ['#3e5751', '#213a3a'], groundEdge: '#e27b5e', stripes: 'rgba(237, 190, 132, .10)', pipes: ['#8f454c', '#f28c68', '#d9655c', '#b44f52', '#783b49'], pipeEdge: '#523641', pipeHighlight: 'rgba(255, 216, 164, .72)' },
    { id: 'aurora', name: 'Aurora polar', price: 0, free: true, scene: 'aurora', sky: ['#101d46', '#285a76', '#70c5c9'], hills: ['#315d75', '#182c50'], floor: ['#233b58', '#12233d'], groundEdge: '#77d4cc', stripes: 'rgba(180, 245, 237, .13)', pipes: ['#224d70', '#8de4dc', '#48b8c2', '#32849f', '#18385c'], pipeEdge: '#12344e', pipeHighlight: 'rgba(220, 255, 245, .82)' },
    { id: 'cosmos', name: 'Órbita', price: 60, free: false, scene: 'cosmos', sky: ['#151434', '#393264', '#b05b87'], hills: ['#4a3e70', '#28244e'], floor: ['#302a4b', '#1b1936'], groundEdge: '#d584ba', stripes: 'rgba(239, 190, 229, .12)', pipes: ['#543764', '#e1a6d4', '#a56cc1', '#7551a7', '#3b2d5c'], pipeEdge: '#312648', pipeHighlight: 'rgba(255, 232, 255, .78)' },
    { id: 'atardecer', name: 'Último sol', price: 80, free: false, scene: 'sunset', sky: ['#4b3154', '#b85c72', '#f4b27b'], hills: ['#77506b', '#48314f'], floor: ['#49394c', '#28273d'], groundEdge: '#f28b70', stripes: 'rgba(255, 215, 178, .12)', pipes: ['#734351', '#ffb080', '#e77b70', '#bd5967', '#60394e'], pipeEdge: '#4a3045', pipeHighlight: 'rgba(255, 226, 190, .8)' },
    { id: 'neon', name: 'Neón urbano', price: 100, free: false, scene: 'neon', sky: ['#0a233a', '#123d59', '#267985'], hills: ['#1d5363', '#102e49'], floor: ['#193c4d', '#0c2639'], groundEdge: '#8be263', stripes: 'rgba(134, 246, 169, .14)', pipes: ['#1d5860', '#c0ff8f', '#72dc91', '#34aa8d', '#124956'], pipeEdge: '#0c3945', pipeHighlight: 'rgba(224, 255, 196, .9)' }
  ];
  const FREE_BACKGROUNDS = ['costa', 'aurora'];
  const AVATARS = [
    { id: 'sol', name: 'Avatar 01', price: 0, image: 'assets/avatars/community/avatar-01.webp', mood: 'gold' },
    { id: 'luna', name: 'Avatar 02', price: 0, image: 'assets/avatars/community/avatar-02.webp', mood: 'lavender' },
    { id: 'pixel', name: 'Avatar 03', price: 0, image: 'assets/avatars/community/avatar-03.webp', mood: 'mint' },
    { id: 'rayo', name: 'Avatar 04', price: 0, image: 'assets/avatars/community/avatar-04.webp', mood: 'coral' },
    { id: 'ola', name: 'Avatar 05', price: 0, image: 'assets/avatars/community/avatar-05.webp', mood: 'blue' },
    { id: 'cometa', name: 'Avatar 06', price: 40, image: 'assets/avatars/community/avatar-06.webp', mood: 'mint' },
    { id: 'prisma', name: 'Avatar 07', price: 40, image: 'assets/avatars/community/avatar-07.webp', mood: 'lavender' },
    { id: 'orbita', name: 'Avatar 08', price: 40, image: 'assets/avatars/community/avatar-08.webp', mood: 'coral' },
    { id: 'flora', name: 'Avatar 09', price: 40, image: 'assets/avatars/community/avatar-09.webp', mood: 'gold' },
    { id: 'neon', name: 'Avatar 10', price: 40, image: 'assets/avatars/community/avatar-10.webp', mood: 'lavender' },
    { id: 'avatar-11', name: 'Avatar 11', price: 60, image: 'assets/avatars/community/avatar-11.webp', mood: 'gold' },
    { id: 'avatar-12', name: 'Avatar 12', price: 60, image: 'assets/avatars/community/avatar-12.webp', mood: 'lavender' },
    { id: 'avatar-13', name: 'Avatar 13', price: 60, image: 'assets/avatars/community/avatar-13.webp', mood: 'mint' },
    { id: 'avatar-14', name: 'Avatar 14', price: 60, image: 'assets/avatars/community/avatar-14.webp', mood: 'coral' },
    { id: 'avatar-15', name: 'Avatar 15', price: 60, image: 'assets/avatars/community/avatar-15.webp', mood: 'blue' }
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
        if (!BACKGROUNDS.some((item) => item.id === saved.backgroundId)) saved.backgroundId = 'costa';
        if (!Array.isArray(saved.ownedBackgrounds)) saved.ownedBackgrounds = FREE_BACKGROUNDS.slice();
        return saved;
      }
    } catch (error) {}
    return {
      id,
      name,
      avatarId: 'sol',
      characterId: 'friend',
      cents: 0,
      backgroundId: 'costa',
      ownedAvatars: FREE_AVATARS.slice(),
      ownedBackgrounds: FREE_BACKGROUNDS.slice(),
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
        const payload = await remote('/profile', 'POST', { name: safeName, legacyBest: Math.min(MAX_RUN_SCORE, Number(legacyBest) || 0) });
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
  function getBackgroundCatalog() { return BACKGROUNDS.map((item) => ({ ...item, sky: [...item.sky], hills: [...item.hills], floor: [...item.floor], pipes: [...item.pipes] })); }
  function backgroundById(id) { return BACKGROUNDS.find((item) => item.id === id) || BACKGROUNDS[0]; }
  function avatarById(id) { return AVATARS.find((item) => item.id === id) || AVATARS[0]; }

  async function completeRun(score, best, runId = uuid()) {
    if (!profile || !active) return null;
    const points = Math.max(0, Math.min(MAX_RUN_SCORE, Math.floor(Number(score) || 0)));
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

  async function chooseBackground(backgroundId) {
    if (!profile || !active) return null;
    return actionOrLocal('/profile/background', { name: active.name, backgroundId }, (next) => {
      if (!(next.ownedBackgrounds || FREE_BACKGROUNDS).includes(backgroundId)) throw new Error('Primero desbloquea este fondo en la tienda.');
      next.backgroundId = backgroundId;
      return next;
    });
  }

  async function buyBackground(backgroundId) {
    const item = backgroundById(backgroundId);
    if (!profile || !active || !item.price) throw new Error('Ese fondo no se puede comprar.');
    return actionOrLocal('/store/background/purchase', { name: active.name, backgroundId }, (next) => {
      next.ownedBackgrounds = Array.isArray(next.ownedBackgrounds) ? next.ownedBackgrounds : FREE_BACKGROUNDS.slice();
      if (next.ownedBackgrounds.includes(backgroundId)) {
        next.purchaseStatus = 'already-owned';
        return next;
      }
      if ((Number(next.cents) || 0) < item.price) throw new Error('Aún no tienes suficientes Cent.');
      next.cents -= item.price;
      next.ownedBackgrounds.push(backgroundId);
      next.purchaseStatus = 'purchased';
      next.spentCents = item.price;
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
    getBackgroundCatalog,
    backgroundById,
    avatarById,
    completeRun,
    buyAvatar,
    chooseAvatar,
    chooseBird,
    chooseBackground,
    buyBackground,
    leaderboard,
    isRemote() { return apiAvailable; }
  });
})();
