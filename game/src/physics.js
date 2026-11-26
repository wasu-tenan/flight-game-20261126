// The flight model: speed, pitch, altitude, fuel, stall and landing.
//
// The plane flies east along the valley. Throttle pushes the speed toward
// its target, climbing bleeds speed, diving gains it, and the nose follows
// the stick (or the mouse) at a fixed rate. All speeds are knots, all
// heights metres, all angles degrees. The model is deliberately forgiving:
// a gentle hand flies the course, a wild one stalls or meets the ground.

import { PLANE, COURSE } from './config.js';
import { groundHeightAt, onAnyStrip } from './world.js';

export const KNOTS_TO_MS = 0.514444;

// Fresh flight state: parked on the home strip, engine idling.
export function freshFlight() {
  return {
    x: 180, // metres along the course
    altitude: 0, // metres above the valley floor
    speedKt: 0,
    pitchDeg: 0, // positive = nose up
    throttle: 0,
    fuel: 100, // percent
    ringsPassed: 0,
    score: 0,
    timeSeconds: 0,
    airborne: false,
    stalled: false,
    landed: false,
    crashed: false,
    crashCause: '',
    // Vertical speed in m/s, kept for the landing check and the HUD.
    verticalSpeedMs: 0,
  };
}

// Heading on the compass: level flight east is 090. Climbing turns the
// nose toward the north-east, diving toward the south-east.
export function headingDeg(flight) {
  return 90 - flight.pitchDeg;
}

// One simulation step. `stick` is { pitchUp, pitchDown, throttleUp,
// throttleDown, brake, mouseY, mouseThrottle } and `screenY` maps an
// altitude to the pointer's height; `events` collects what happened so
// the game can chime, thud and score: { ring, landed, crashed, stalled }.
export function stepFlight(flight, stick, dt, events) {
  if (flight.crashed || flight.landed) return;

  // --- Throttle -------------------------------------------------------
  if (stick.throttleUp || stick.mouseThrottle) {
    flight.throttle = Math.min(1, flight.throttle + PLANE.throttleRate * dt);
  }
  if (stick.throttleDown) {
    flight.throttle = Math.max(0, flight.throttle - PLANE.throttleRate * dt);
  }
  if (stick.brake) {
    flight.throttle = Math.max(0, flight.throttle - PLANE.throttleRate * 1.6 * dt);
  }

  // --- Pitch ----------------------------------------------------------
  if (stick.pitchUp) flight.pitchDeg += PLANE.pitchRateDeg * dt;
  if (stick.pitchDown) flight.pitchDeg -= PLANE.pitchRateDeg * dt;
  if (stick.mouseY !== null && stick.mouseY !== undefined) {
    // Mouse steering: the nose chases the pointer's height. The pointer
    // maps to an altitude band around the plane, so the pilot points
    // where they want to go.
    const targetPitch = Math.max(
      -PLANE.maxPitchDeg,
      Math.min(PLANE.maxPitchDeg, (stick.mouseY - 400) * -0.09),
    );
    const diff = targetPitch - flight.pitchDeg;
    flight.pitchDeg += Math.max(-PLANE.pitchRateDeg * dt, Math.min(PLANE.pitchRateDeg * dt, diff));
  }
  flight.pitchDeg = Math.max(-PLANE.maxPitchDeg, Math.min(PLANE.maxPitchDeg, flight.pitchDeg));

  // --- Speed ----------------------------------------------------------
  const targetSpeed = PLANE.maxSpeedKt * (0.25 + 0.75 * flight.throttle);
  const climbBleed = Math.sin((flight.pitchDeg * Math.PI) / 180) * 55;
  const brakeDrag = stick.brake ? 60 : 0;
  const speedTarget = Math.max(0, targetSpeed - climbBleed - brakeDrag);
  const rate = flight.speedKt < speedTarget ? 26 : 14;
  flight.speedKt += Math.max(-rate * dt, Math.min(rate * dt, speedTarget - flight.speedKt));

  // --- Stall ----------------------------------------------------------
  flight.stalled = flight.airborne && flight.speedKt < PLANE.stallSpeedKt;
  if (flight.stalled) {
    // A stalled wing drops the nose and the plane sinks fast.
    flight.pitchDeg = Math.max(-PLANE.maxPitchDeg, flight.pitchDeg - 30 * dt);
    events.stalled = true;
  }

  // --- Motion ---------------------------------------------------------
  const speedMs = flight.speedKt * KNOTS_TO_MS;
  const pitchRad = (flight.pitchDeg * Math.PI) / 180;
  flight.x += speedMs * Math.cos(pitchRad) * dt;
  const climbMs = speedMs * Math.sin(pitchRad) - (flight.stalled ? 6 : 0);
  flight.verticalSpeedMs = climbMs;
  flight.altitude += climbMs * dt;
  flight.timeSeconds += dt;

  // --- Fuel -----------------------------------------------------------
  const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurnFull - PLANE.fuelBurnIdle) * flight.throttle;
  flight.fuel = Math.max(0, flight.fuel - burn * dt);
  if (flight.fuel <= 0) {
    // Out of fuel the engine quits: the throttle dies and the plane glides.
    flight.throttle = 0;
  }

  // --- Take-off -------------------------------------------------------
  // The wing only lifts the plane when the pilot has rotated the nose up:
  // lifting off while pointing down would plant it in the ground at once.
  if (!flight.airborne && flight.speedKt >= PLANE.takeoffSpeedKt && flight.pitchDeg > 2) {
    flight.airborne = true;
    flight.altitude = Math.max(flight.altitude, 2);
  }

  // --- Ground ---------------------------------------------------------
  const ground = groundHeightAt(flight.x);
  if (flight.altitude <= ground) {
    flight.altitude = ground;
    if (!flight.airborne) {
      // Still rolling: fine on a strip, but running off the end of the
      // runway into the rough at speed ends the flight.
      if (onAnyStrip(flight.x) || flight.speedKt <= 30) {
        flight.verticalSpeedMs = 0;
        return;
      }
      flight.crashed = true;
      flight.crashCause = 'Ran off the end of the runway into the rough ground.';
      events.crashed = true;
      return;
    }
    const gentle = Math.abs(flight.verticalSpeedMs) <= PLANE.landingSinkMs;
    const slow = flight.speedKt <= PLANE.landingSpeedKt;
    const level = Math.abs(flight.pitchDeg) <= 12;
    if (onAnyStrip(flight.x) && gentle && slow && level) {
      flight.landed = true;
      flight.airborne = false;
      events.landed = true;
    } else {
      flight.crashed = true;
      flight.airborne = false;
      const hitWater = ground < 6 && flight.x > 700 && flight.x < 5400;
      flight.crashCause = flight.fuel <= 0
        ? 'Out of fuel — the engine quit over the valley.'
        : hitWater
          ? 'Ditched in the river. The floats were only a rumour.'
          : flight.stalled
            ? 'Stalled and dropped out of the sky.'
            : 'Flew into the mountainside.';
      events.crashed = true;
    }
  }

  // --- Past the end of the valley -------------------------------------
  if (flight.x >= COURSE.lengthMetres + 200 && !flight.crashed) {
    flight.crashed = true;
    flight.crashCause = 'Flew past Alderfield and out of the valley.';
    events.crashed = true;
  }
}

// The plane has passed a ring when it crosses the ring's x within the hoop.
// The hoop has a little grace beyond its drawn edge (12 m), so a line that
// looks clean through the ring counts as clean.
export function checkRing(flight, ring) {
  if (ring.passed) return false;
  const dx = flight.x - ring.x;
  if (Math.abs(dx) > 30) return false;
  const dy = flight.altitude - ring.y;
  if (Math.abs(dy) > ring.r + 12) return false;
  ring.passed = true;
  flight.ringsPassed += 1;
  flight.score += 1000;
  flight.fuel = Math.min(100, flight.fuel + PLANE.ringFuelBonus);
  return true;
}
