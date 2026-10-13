import { describe, expect, it } from 'vitest';
import { clamp, ease, lerp, mod, rng, TAU } from '../src/core/math';

describe('math helpers', () => {
  it('clamps into a range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.3, 0, 1)).toBe(0.3);
  });

  it('interpolates linearly', () => {
    expect(lerp(2, 4, 0)).toBe(2);
    expect(lerp(2, 4, 1)).toBe(4);
    expect(lerp(2, 4, 0.25)).toBe(2.5);
  });

  it('eases from 0 to 1 symmetrically and monotonically', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = ease(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('wraps negative numbers with a positive modulo', () => {
    expect(mod(-1, 40)).toBe(39);
    expect(mod(85, 40)).toBe(5);
  });

  it('makes a repeatable random stream in [0, 1)', () => {
    const a = rng(7), b = rng(7), c = rng(8);
    const sa = Array.from({ length: 20 }, a);
    const sb = Array.from({ length: 20 }, b);
    expect(sa).toEqual(sb);
    expect(Array.from({ length: 20 }, c)).not.toEqual(sa);
    for (const v of sa) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it('exposes a full turn', () => {
    expect(TAU).toBeCloseTo(Math.PI * 2);
  });
});
