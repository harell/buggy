import { describe, expect, it } from 'vitest';
import { bump, groundHeight, roughBump, TILE } from '../src/core/terrain';

const samples = Array.from({ length: 40 }, (_, i) => [i * 3.7 - 60, i * -2.3 + 25] as const);

describe('terrain', () => {
  // The ground mesh is shifted by whole tiles as the car drives, so every height field must repeat every TILE.
  it.each([['bump', bump], ['roughBump', roughBump]] as const)('%s repeats every tile in x and z', (_, f) => {
    for (const [x, z] of samples) {
      expect(f(x + TILE, z)).toBeCloseTo(f(x, z), 9);
      expect(f(x, z + TILE)).toBeCloseTo(f(x, z), 9);
      expect(f(x - 3 * TILE, z + 2 * TILE)).toBeCloseTo(f(x, z), 9);
    }
  });

  it('keeps the gentle track low (under 6 mm)', () => {
    for (const [x, z] of samples) expect(Math.abs(bump(x, z))).toBeLessThanOrEqual(0.6);
  });

  it('keeps the gravel under 1 cm so tyres stay on top of it', () => {
    for (const [x, z] of samples) expect(Math.abs(roughBump(x, z))).toBeLessThanOrEqual(0.95);
  });

  it('adds gravel only when the bumpy road is on', () => {
    for (const [x, z] of samples) {
      expect(groundHeight(x, z, false)).toBe(bump(x, z));
      expect(groundHeight(x, z, true)).toBeCloseTo(bump(x, z) + roughBump(x, z), 12);
    }
  });

  it('makes the gravel bumpier than the plain track', () => {
    const rms = (f: (x: number, z: number) => number) => {
      let s = 0, n = 0;
      for (let x = 0; x < TILE; x += 1) for (let z = 0; z < TILE; z += 1) { s += f(x, z) ** 2; n++; }
      return Math.sqrt(s / n);
    };
    expect(rms((x, z) => groundHeight(x, z, true))).toBeGreaterThan(rms(bump) * 1.5);
  });
});
