// Ridge Runner: Alpine Ring Run — course and tuning constants.
//
// The course is one valley run eastward: take off from Pinecrest strip,
// thread eight golden rings over the river valley, then put the plane down
// gently on the far strip at Alderfield. Everything here is a plain number
// so the flight model, the world and the renderer all agree on the course.

export const COURSE = {
  // Length of the valley in metres. The far runway sits at the end of it.
  lengthMetres: 6000,
  // The two airstrips: [start, end] along the course, in metres.
  homeStrip: { start: 60, end: 460 },
  farStrip: { start: 5560, end: 6000 },
  // Rings to fly through, in course order. Each ring is a hoop in the sky:
  // its centre altitude (metres above the valley floor) and its radius.
  rings: [
    { x: 900, y: 150, r: 42 },
    { x: 1500, y: 230, r: 42 },
    { x: 2100, y: 130, r: 38 },
    { x: 2750, y: 260, r: 42 },
    { x: 3350, y: 180, r: 38 },
    { x: 3950, y: 300, r: 42 },
    { x: 4550, y: 200, r: 38 },
    { x: 5100, y: 150, r: 42 },
  ],
  // Terrain seed: the same seed always grows the same valley.
  terrainSeed: 20261126,
};

export const PLANE = {
  // Knots. Below stallSpeed the wing stops flying.
  stallSpeedKt: 55,
  cruiseSpeedKt: 145,
  maxSpeedKt: 210,
  // Take-off roll: the strip is long enough at full throttle.
  takeoffSpeedKt: 70,
  // Degrees per second the nose answers the stick.
  pitchRateDeg: 38,
  maxPitchDeg: 32,
  // Throttle 0..1, how fast it moves when the pilot holds the key.
  throttleRate: 0.55,
  // Fuel: percent per second at full throttle, less at idle.
  fuelBurnFull: 0.55,
  fuelBurnIdle: 0.12,
  // A ring hands back this much fuel, so a clean line never runs dry.
  ringFuelBonus: 14,
  // Landing: touch down slower than this, and sinking slower than the
  // sink limit, on a strip, and the landing counts.
  landingSpeedKt: 150,
  landingSinkMs: 6,
};

export const SCORING = {
  ringPoints: 1000,
  landingPoints: 2500,
  // Bonus for finishing quickly: points per second under the par time.
  parTimeSeconds: 240,
  timeBonusPerSecond: 15,
};

export const VIEW = {
  // Logical canvas size. The canvas scales to the window; the game draws
  // in this space so screenshots are always 1280x800.
  width: 1280,
  height: 800,
  // Metres shown per pixel, horizontally. The valley is long, so the
  // camera follows the plane.
  metresPerPixel: 2.2,
  // The plane sits this far from the left edge of the screen.
  planeScreenX: 380,
};

export const COLOURS = {
  skyTop: '#2e5f9e',
  skyMid: '#7fb2dd',
  skyLow: '#f7c489',
  sun: '#ffd98a',
  mountainFar: '#7d94b5',
  mountainNear: '#4d6b52',
  valleyGreen: '#5d8a4a',
  valleyDark: '#3f6b34',
  rock: '#8a7f72',
  snow: '#f2f5f7',
  river: '#4d9ec4',
  pine: '#2c5230',
  ring: '#ffc233',
  ringGlow: '#ffdf7a',
  runway: '#3c4148',
  runwayMark: '#f5f2e8',
  hudPanel: 'rgba(8, 18, 30, 0.72)',
  hudText: '#eaf6ff',
  hudAmber: '#ffc233',
  hudRed: '#ff5a4e',
  hudGreen: '#7ee787',
};
