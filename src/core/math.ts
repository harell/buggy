export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Cubic ease-in-out on [0, 1]. */
export const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/**
 * Seconds between two animation-frame timestamps (ms), kept in [0, max]. A slow first load can stamp the
 * first frame before the clock was read, and a background tab can pause for minutes.
 */
export const frameStep = (now: number, last: number, max = 0.05): number => clamp((now - last) / 1000, 0, max);
/** Modulo that is always positive, for wrapping coordinates. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Small seeded PRNG (mulberry32) so procedural textures look the same every load. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
