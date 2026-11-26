// Screenshot presets: staged scenes for ?shot=start|play|win|loss.
//
// Each preset builds a fixed flight state so a screenshot of the game is
// the same every time it is taken. The play preset puts the plane
// mid-course, climbing through ring four with the HUD lit; the win and
// loss presets stage the end screens over the far strip. Nothing here is
// reachable from normal play: the query only stages a scene for a shot.

import { buildRings } from './world.js';
import { freshFlight } from './physics.js';
import { SCORING } from './config.js';

function midFlightFlight() {
  const flight = freshFlight();
  flight.x = 2680;
  flight.altitude = 238;
  flight.speedKt = 148;
  flight.pitchDeg = 12;
  flight.throttle = 0.72;
  flight.fuel = 68;
  flight.ringsPassed = 3;
  flight.score = 3000;
  flight.timeSeconds = 96;
  flight.airborne = true;
  return flight;
}

function flownRings(count) {
  const rings = buildRings();
  for (let i = 0; i < count && i < rings.length; i++) {
    rings[i].passed = true;
  }
  return rings;
}

export function shotPreset(shot) {
  if (shot === 'start') {
    // Title screen, plane parked on Pinecrest with the valley behind.
    return {
      phase: 'title',
      flight: freshFlight(),
      rings: buildRings(),
      timeSeconds: 2,
    };
  }
  if (shot === 'play') {
    // Mid-flight: through ring four's neighbourhood, HUD and instruments lit.
    return {
      phase: 'flying',
      flight: midFlightFlight(),
      rings: flownRings(3),
      timeSeconds: 96,
    };
  }
  if (shot === 'win') {
    // Landed at Alderfield after all eight rings, mission complete.
    const flight = freshFlight();
    flight.x = 5750;
    flight.altitude = 0;
    flight.speedKt = 62;
    flight.pitchDeg = 0;
    flight.throttle = 0;
    flight.fuel = 41;
    flight.ringsPassed = 8;
    flight.timeSeconds = 198;
    flight.score = 8000 + SCORING.landingPoints + Math.round((SCORING.parTimeSeconds - 198) * SCORING.timeBonusPerSecond);
    flight.landed = true;
    return {
      phase: 'won',
      flight,
      rings: flownRings(8),
      timeSeconds: 198,
    };
  }
  if (shot === 'loss') {
    // Crashed into the ridge after missing a ring, fuel low.
    const flight = freshFlight();
    flight.x = 3920;
    flight.altitude = 295;
    flight.speedKt = 48;
    flight.pitchDeg = -18;
    flight.throttle = 0.4;
    flight.fuel = 9;
    flight.ringsPassed = 5;
    flight.score = 5000;
    flight.timeSeconds = 154;
    flight.airborne = true;
    flight.stalled = true;
    flight.crashed = true;
    flight.crashCause = 'Stalled and dropped out of the sky.';
    return {
      phase: 'lost',
      flight,
      rings: flownRings(5),
      timeSeconds: 154,
    };
  }
  return null;
}
