(() => {
  'use strict';

  const ANIMATIONS = Object.freeze(['idle', 'walk', 'jump', 'landing', 'crouch', 'block', 'blockCrouch', 'blockAir', 'light', 'medium', 'heavy', 'special', 'ultimate', 'hurt', 'down', 'getup', 'ko', 'enter', 'victory']);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freezeDeep(value) {
    Object.values(value).forEach((item) => {
      if (item && typeof item === 'object') freezeDeep(item);
    });
    return Object.freeze(value);
  }

  function assertRect(rect, label) {
    if (!rect || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]))
        || rect.width <= 0 || rect.height <= 0) {
      throw new RangeError(`${label} debe ser un rectángulo válido.`);
    }
  }

  function validate(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new TypeError('La definición del atlas debe ser un objeto.');
    }
    const { src, frameWidth, frameHeight, anchor, animations, hitboxes } = definition;
    if (typeof src !== 'string' || !src.trim() || /^(?:https?:)?\/\//i.test(src)) {
      throw new TypeError('El atlas debe usar una ruta local del proyecto.');
    }
    if (!Number.isInteger(frameWidth) || frameWidth <= 0 || !Number.isInteger(frameHeight) || frameHeight <= 0) {
      throw new RangeError('Cada frame del atlas necesita ancho y alto en píxeles enteros.');
    }
    if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)
        || anchor.x < 0 || anchor.x > frameWidth || anchor.y <= 0 || anchor.y > frameHeight) {
      throw new RangeError('El ancla de pies debe estar dentro del frame.');
    }
    if (definition.visualScale !== undefined
        && (!Number.isFinite(definition.visualScale) || definition.visualScale <= 0 || definition.visualScale > 1.5)) {
      throw new RangeError('La escala visual del atlas debe ser positiva y menor o igual a 1.5.');
    }
    if (definition.frameOffsets !== undefined && (!definition.frameOffsets || typeof definition.frameOffsets !== 'object'
        || Object.entries(definition.frameOffsets).some(([index, value]) => !/^\d+$/.test(index) || !Number.isFinite(value)))) {
      throw new RangeError('Los ajustes horizontales del atlas deben ser números finitos por frame.');
    }
    if (!animations || typeof animations !== 'object') throw new TypeError('El atlas necesita clips de animación.');
    ANIMATIONS.forEach((name) => {
      const clip = animations[name];
      if (!clip || !Array.isArray(clip.frames) || !clip.frames.length
          || clip.frames.some((frame) => !Number.isInteger(frame) || frame < 0)
          || !Number.isFinite(clip.fps) || clip.fps <= 0 || typeof clip.loop !== 'boolean') {
        throw new RangeError(`El clip ${name} no tiene frames, velocidad y ciclo válidos.`);
      }
    });
    if (!hitboxes || typeof hitboxes !== 'object') throw new TypeError('El atlas necesita hitboxes separados del dibujo.');
    assertRect(hitboxes.body, 'La caja corporal');
    ['light', 'medium', 'heavy', 'special'].forEach((name) => assertRect(hitboxes[name], `La caja de ${name}`));
    return true;
  }

  function create(definition) {
    validate(definition);
    return freezeDeep(clone(definition));
  }

  function animationFor(fighter) {
    if (fighter.knockedOut) return 'ko';
    if (fighter.knockdownFrames > 0 && fighter.grounded) {
      return fighter.knockdownFrames > 24 ? 'hurt' : fighter.knockdownFrames > 10 ? 'down' : 'getup';
    }
    if (fighter.hitstunFrames > 0) return 'hurt';
    if (fighter.victorious) return 'victory';
    if (fighter.attackId) return fighter.attackId;
    if (fighter.guarding) return !fighter.grounded ? 'blockAir' : fighter.crouching ? 'blockCrouch' : 'block';
    if (!fighter.grounded) return 'jump';
    if (fighter.crouching) return 'crouch';
    if (fighter.landingFrames > 0) return 'landing';
    if (Math.abs(fighter.vx) > 12) return 'walk';
    return 'idle';
  }

  globalThis.CenFighterArtContract = Object.freeze({ ANIMATIONS, validate, create, animationFor });
})();
