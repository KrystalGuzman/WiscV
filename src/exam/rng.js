/**
 * rng.js — seeded pseudorandom numbers.
 *
 * Generated items must be reproducible: a session seed lets a test be re-taken
 * identically, lets a reported result be audited, and lets the test suite
 * assert properties of generated items rather than hoping.
 */

/** mulberry32: small, fast, and good enough for item generation. */
export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** Float in [0, 1). */
    next,
    /** Integer in [min, max]. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** A random element. */
    pick: (array) => array[Math.floor(next() * array.length)],
    /** A new shuffled copy (Fisher-Yates). */
    shuffle(array) {
      const copy = [...array];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    /** `count` distinct elements. */
    sample(array, count) {
      return this.shuffle(array).slice(0, count);
    },
  };
}

/** A seed derived from the clock, for a fresh session. */
export function randomSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
}
