// The valley: terrain, river, trees, town, rings and runways.
//
// The valley floor is a smooth profile built from a few seeded sine hills
// plus two mountain shoulders, so the same seed always grows the same
// valley. The river runs along the floor; the far strip sits in a flat
// meadow by the town of Alderfield. Everything is a pure function of x,
// so collision is one call: groundHeightAt(x).

import { COURSE } from './config.js';
import { makeRandom, range, rangeInt } from './random.js';

// Smoothstep between 0 and 1, for blending hills without corners.
function smooth(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// Height of the ground in metres above the valley floor, at course x.
export function groundHeightAt(x) {
  // Flat on both strips so take-off and landing are fair.
  if (x >= COURSE.homeStrip.start - 80 && x <= COURSE.homeStrip.end + 80) return 0;
  if (x >= COURSE.farStrip.start - 80 && x <= COURSE.farStrip.end + 80) return 0;
  // Rolling hills along the valley.
  const hills =
    26 * Math.sin(x * 0.0016 + 1.2) +
    18 * Math.sin(x * 0.0031 + 4.0) +
    9 * Math.sin(x * 0.0073 + 2.2);
  // A mountain shoulder rises on the far side of the river bend. It stays
  // well below the rings (the lowest nearby ring is at 200 m), so a pilot
  // watching the terrain ahead always has room to climb over it.
  const shoulder = 130 * smooth((x - 3600) / 900) * (1 - smooth((x - 4700) / 700));
  // A lower ridge early in the course keeps the first rings honest.
  const ridge = 95 * smooth((x - 1200) / 500) * (1 - smooth((x - 2300) / 600));
  return Math.max(0, hills + shoulder + ridge);
}

// The river is at the valley floor wherever the ground is low; its
// surface is drawn where the ground dips under 6 metres, mid-course.
export function riverAt(x) {
  const g = groundHeightAt(x);
  return g < 6 && x > 700 && x < 5400;
}

export function onStrip(x, strip) {
  return x >= strip.start && x <= strip.end;
}

export function onAnyStrip(x) {
  return onStrip(x, COURSE.homeStrip) || onStrip(x, COURSE.farStrip);
}

// Build the decorations once, from the seed: pine trees, clouds, birds,
// town houses and the windsock positions. The renderer draws them.
export function buildScenery() {
  const random = makeRandom(COURSE.terrainSeed);
  const trees = [];
  for (let x = 500; x < COURSE.lengthMetres; x += 55) {
    if (onAnyStrip(x)) continue;
    if (random() < 0.62) {
      trees.push({
        x: x + range(random, -18, 18),
        h: range(random, 14, 30),
        w: range(random, 9, 15),
      });
    }
  }
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: range(random, 0, COURSE.lengthMetres),
      y: range(random, 330, 560),
      s: range(random, 40, 110),
      layer: i % 2,
    });
  }
  const birds = [];
  for (let i = 0; i < 12; i++) {
    birds.push({
      x: range(random, 600, 5400),
      y: range(random, 120, 300),
      phase: range(random, 0, Math.PI * 2),
      speed: range(random, 6, 14),
    });
  }
  // Alderfield: a row of little houses with lit windows by the far strip.
  const houses = [];
  for (let i = 0; i < 9; i++) {
    houses.push({
      x: COURSE.farStrip.start + 90 + i * 52,
      w: rangeInt(random, 30, 44),
      h: rangeInt(random, 22, 38),
      roof: random() < 0.5 ? 'peak' : 'flat',
      lit: random() < 0.7,
    });
  }
  return { trees, clouds, birds, houses };
}

// Rings in course order with their passed state kept beside them.
export function buildRings() {
  return COURSE.rings.map((ring, index) => ({
    index,
    x: ring.x,
    y: ring.y,
    r: ring.r,
    passed: false,
  }));
}

// The next ring the pilot has to fly through, or null when all are done.
export function nextRing(rings) {
  return rings.find((ring) => !ring.passed) ?? null;
}
