// A tiny seeded random number generator (mulberry32), so the valley, the
// clouds and the screenshot presets are the same on every run. The game
// never calls Math.random for anything the player can see.

export function makeRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a seeded stream.
export function range(random, min, max) {
  return min + random() * (max - min);
}

// Pick an integer in [min, max] from a seeded stream.
export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
