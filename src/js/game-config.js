(() => {
  'use strict';

  window.FlappyGameConfig = Object.freeze({
    width: 360,
    height: 640,
    floorY: 544,
    pipeWidth: 62,
    birdX: 96,
    gravity: 1500,
    flapVelocity: -430,
    spawnDistance: 210,
    pace: Object.freeze({
      initialSpeed: 126,
      maxSpeed: 202,
      rampPoints: 50,
      phaseMinPoints: 4,
      phaseMaxPoints: 8,
      variation: 11,
      variationFadePoints: 8,
      transitionRate: 2.2
    }),
    birdProfiles: Object.freeze({
      friend: Object.freeze({ top: 60, bottom: 52, hits: Object.freeze([[-34, 18], [-6, 20], [29, 19]]) }),
      bird: Object.freeze({ top: 22, bottom: 22, hits: Object.freeze([[-8, 12], [3, 13], [14, 12]]) })
    })
  });
})();
