(() => {
  'use strict';

  const ANIMATIONS = Object.freeze(['idle', 'walk', 'jump', 'crouch', 'block', 'light', 'medium', 'heavy', 'special', 'hurt', 'ko', 'enter', 'victory']);

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
    if (!animations || typeof animations !== 'object') throw new TypeError('El atlas necesita clips de animación.');
    ANIMATIONS.forEach((name) => {
      const clip = animations[name];
      if (!clip || !Array.isArray(clip.frames) || !clip.frames.length
          || clip.frames.some((frame) => !Number.isInteger(frame) || frame < 0)
          || !Number.isFinite(clip.fps) || clip.fps <= 0 || typeof clip.loop !== 'boolean') {
        throw new RangeError(`El clip ${name} no tiene frames, velocidad y ciclo válidos.`);
      }
    });
    if (definition.frameFootAnchors !== undefined) {
      const anchors = definition.frameFootAnchors;
      const referencedFrames = new Set(Object.values(animations).flatMap((clip) => clip.frames));
      if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)
          || Object.entries(anchors).some(([frame, y]) => !/^\d+$/.test(frame)
            || !referencedFrames.has(Number(frame)) || !Number.isFinite(y) || y <= 0 || y > frameHeight)) {
        throw new RangeError('Las anclas de pies por frame deben apuntar a frames usados y quedar dentro del atlas.');
      }
    }
    if (definition.frameDrawBounds !== undefined) {
      const bounds = definition.frameDrawBounds;
      const referencedFrames = new Set(Object.values(animations).flatMap((clip) => clip.frames));
      if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)
          || Object.entries(bounds).some(([frame, rect]) => !/^\d+$/.test(frame)
            || !referencedFrames.has(Number(frame))
            || !rect || !['x', 'y', 'width', 'height'].every((key) => Number.isInteger(rect[key]))
            || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0
            || rect.x + rect.width > frameWidth || rect.y + rect.height > frameHeight)) {
        throw new RangeError('Los recortes por frame deben apuntar a frames usados y quedar dentro del atlas.');
      }
    }
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
    if (fighter.hitstunFrames > 0) return 'hurt';
    if (fighter.victorious) return 'victory';
    if (fighter.attackId) return fighter.attackId;
    if (!fighter.grounded) return 'jump';
    if (fighter.guarding) return 'block';
    if (fighter.crouching) return 'crouch';
    if (Math.abs(fighter.vx) > 12) return 'walk';
    return 'idle';
  }

  globalThis.CenFighterArtContract = Object.freeze({ ANIMATIONS, validate, create, animationFor });
})();
