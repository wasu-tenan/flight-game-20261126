// Ridge Runner: Alpine Ring Run — the game loop and state machine.
//
// Phases: title -> flying -> paused -> won / lost. The loop runs on
// requestAnimationFrame with a fixed simulation step so the flight model
// behaves the same at any frame rate. The URL query ?shot=start|play|win
// |loss jumps straight to a staged scene so screenshots are repeatable.

import { VIEW, COURSE, SCORING } from './config.js';
import { createInput } from './input.js';
import { buildScenery, buildRings, nextRing } from './world.js';
import { freshFlight, stepFlight, checkRing } from './physics.js';
import { drawFrame, buttonAt } from './render.js';
import { createAudio } from './audio.js';
import { shotPreset } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');

const input = createInput(canvas);
const audio = createAudio();
const scenery = buildScenery();

const game = {
  phase: 'title', // title | flying | paused | won | lost
  flight: freshFlight(),
  rings: buildRings(),
  scenery,
  timeSeconds: 0,
  muted: false,
  bestScore: 0,
};

// Exposed for play-testing only: the live game object, so an automated
// test can read the phase, the flight state and the rings.
window.__ridge = game;

function resetGame() {
  game.flight = freshFlight();
  game.rings = buildRings();
  game.phase = 'flying';
  game.timeSeconds = 0;
  setStatus('Flying. Thread the rings and land at Alderfield.');
}

function setStatus(text) {
  statusLine.textContent = text;
}

function startFlying() {
  audio.startEngine();
  // The click that started the game leaves the pointer where it was; clear
  // mouse steering so that spot does not dive the plane on take-off.
  input.mouseY = null;
  resetGame();
}

function finishFlight(won) {
  const flight = game.flight;
  if (won) {
    const timeBonus = Math.max(0, Math.round((SCORING.parTimeSeconds - flight.timeSeconds) * SCORING.timeBonusPerSecond));
    flight.score += SCORING.landingPoints + timeBonus;
    game.bestScore = Math.max(game.bestScore, flight.score);
    game.phase = 'won';
    audio.landFanfare();
    setStatus(`Mission complete. Score ${flight.score}.`);
  } else {
    game.phase = 'lost';
    audio.crashThud();
    setStatus(`Crashed. ${flight.crashCause}`);
  }
}

function applyShotPreset() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  const preset = shotPreset(shot);
  if (!preset) return false;
  game.flight = preset.flight;
  game.rings = preset.rings;
  game.phase = preset.phase;
  game.timeSeconds = preset.timeSeconds;
  return true;
}

function handleButtons() {
  for (const click of input.clicks) {
    const id = buttonAt(click.x, click.y);
    if (id === 'start') startFlying();
    if (id === 'restart') startFlying();
    if (id === 'resume') {
      game.phase = 'flying';
      setStatus('Flying.');
    }
    if (id === 'thr-up') game.flight.throttle = Math.min(1, game.flight.throttle + 0.2);
    if (id === 'thr-down') game.flight.throttle = Math.max(0, game.flight.throttle - 0.2);
    if (id === 'mute') {
      game.muted = audio.toggleMute();
      setStatus(game.muted ? 'Sound off.' : 'Sound on.');
    }
  }
}

function handleKeys() {
  if (input.pressedStart) {
    if (game.phase === 'title' || game.phase === 'won' || game.phase === 'lost') startFlying();
  }
  if (input.pressedRestart) {
    if (game.phase !== 'title') startFlying();
  }
  if (input.pressedPause) {
    if (game.phase === 'flying') {
      game.phase = 'paused';
      setStatus('Paused.');
    } else if (game.phase === 'paused') {
      game.phase = 'flying';
      setStatus('Flying.');
    }
  }
  if (input.pressedMute) {
    game.muted = audio.toggleMute();
    setStatus(game.muted ? 'Sound off.' : 'Sound on.');
  }
}

let lastTimestamp = 0;
let accumulator = 0;
const STEP = 1 / 60;

function frame(timestamp) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016);
  lastTimestamp = timestamp;
  game.timeSeconds += dt;

  handleKeys();
  handleButtons();
  input.consumeEdges();

  if (game.phase === 'flying') {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const events = {};
      const stick = {
        pitchUp: input.pitchUp,
        pitchDown: input.pitchDown,
        throttleUp: input.throttleUp,
        throttleDown: input.throttleDown,
        brake: input.brake,
        mouseY: input.mouseY,
        mouseThrottle: input.mouseThrottle,
      };
      stepFlight(game.flight, stick, STEP, events);
      const ring = nextRing(game.rings);
      if (ring && checkRing(game.flight, ring)) {
        audio.ringChime();
        setStatus(`Ring ${ring.index + 1} of ${game.rings.length} — nice flying. Fuel +14%.`);
      }
      if (events.stalled && !game.stallWarnedAt) {
        audio.stallWarning();
        game.stallWarnedAt = game.timeSeconds;
      }
      if (game.stallWarnedAt && game.timeSeconds - game.stallWarnedAt > 1.5) {
        game.stallWarnedAt = 0;
      }
      if (events.landed) {
        const onFarStrip = game.flight.x >= COURSE.farStrip.start;
        finishFlight(onFarStrip && game.flight.ringsPassed === game.rings.length);
        if (!onFarStrip || game.flight.ringsPassed !== game.rings.length) {
          game.flight.crashCause = 'Landed, but the mission was not finished — all eight rings first.';
        }
      }
      if (events.crashed) finishFlight(false);
    }
    audio.setEngine(game.flight.throttle, game.flight.speedKt, game.flight.airborne);
  }

  // Fit the canvas to the window while keeping the 1280x800 game space.
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  drawFrame(ctx, game);
}

// The title screen shows the plane parked on Pinecrest strip, engine off,
// with the valley and the first rings behind the panel.
applyShotPreset();
setStatus('Ridge Runner: Alpine Ring Run. Press Enter or click Start Flying.');
requestAnimationFrame(frame);
