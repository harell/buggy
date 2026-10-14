import { describe, expect, it } from 'vitest';
import { bump, GROUND, gridLines, groundHeight, roughBump, TILE } from '../src/core/terrain';

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

describe('ground grid', () => {
  const lines = gridLines(GROUND);
  const gaps = lines.slice(1).map((x, i) => x - lines[i]);

  it('spans the whole ground, in order', () => {
    expect(lines[0]).toBeCloseTo(-GROUND.half, 9);
    expect(lines[lines.length - 1]).toBeCloseTo(GROUND.half, 9);
    for (const g of gaps) expect(g).toBeGreaterThan(0);
  });

  // The car sits somewhere in [0, TILE) of the mesh (it slides by whole tiles), and the camera looks at it from any side.
  it('is as fine as before wherever the car can be, with a margin all round', () => {
    const [f0, f1] = GROUND.fine;
    expect(f0).toBeLessThanOrEqual(-30);
    expect(f1).toBeGreaterThanOrEqual(TILE + 30);
    lines.slice(1).forEach((x, i) => { if (lines[i] >= f0 - 1e-9 && x <= f1 + 1e-9) expect(gaps[i]).toBeLessThanOrEqual(GROUND.step + 1e-9); });
    expect(GROUND.step).toBeLessThanOrEqual(1.6); // 4 points across the gravel's shortest wave (about 6.3 cm)
  });

  it('coarsens gently further out, so no seam shows', () => {
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i] / gaps[i - 1]).toBeLessThanOrEqual(GROUND.grow + 1e-9);
      expect(gaps[i - 1] / gaps[i]).toBeLessThanOrEqual(GROUND.grow + 1e-9);
    }
  });

  it('keeps the mesh at 20,000 to 30,000 triangles (a 240 × 240 grid was 115,200)', () => {
    const tris = 2 * gaps.length ** 2;
    expect(tris).toBeGreaterThanOrEqual(20000);
    expect(tris).toBeLessThanOrEqual(30000);
  });
});
