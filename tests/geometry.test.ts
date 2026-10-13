import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { gearGeo, interpStations, loft, roundRectPts, section } from '../src/model/geometry';

describe('shell cross-sections', () => {
  it('stays inside the trapezoid it describes', () => {
    const pts = section(0, 4, 3, 3, 6, 5, 48);
    expect(pts).toHaveLength(48);
    for (const [z, y] of pts) {
      expect(Math.abs(z)).toBeLessThanOrEqual(4 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(y).toBeLessThanOrEqual(6 + 1e-9);
    }
  });

  it('interpolates section parameters between stations', () => {
    const defs = [[10, 2, 1, 3, 5], [0, 4, 3, 3, 7]];
    expect(interpStations(defs, 5)).toEqual([5, 3, 2, 3, 6]);
  });
});

describe('loft', () => {
  it('builds a closed shell with outward-facing normals', () => {
    const geo = loft([10, 5, 0].map((x) => ({ x, pts: section(0, 3, 2, 1, 4, 5, 32) })));
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
    let maxZ = -Infinity, iz = 0, maxY = -Infinity, iy = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) > maxZ && Math.abs(nor.getX(i)) < 0.5) { maxZ = pos.getZ(i); iz = i; }
      if (pos.getY(i) > maxY && Math.abs(nor.getX(i)) < 0.5) { maxY = pos.getY(i); iy = i; }
    }
    expect(nor.getZ(iz)).toBeGreaterThan(0.5);
    expect(nor.getY(iy)).toBeGreaterThan(0.5);
  });
});

describe('gears', () => {
  it('reaches out to the tooth tips and no further', () => {
    const g = gearGeo(28, 0.1, 0.3);
    g.computeBoundingBox();
    const r = Math.max(g.boundingBox!.max.x, g.boundingBox!.max.y);
    expect(r).toBeGreaterThan(1.4);
    expect(r).toBeLessThanOrEqual(1.4 + 0.1 * 0.95 + 1e-6);
  });

  it('is centred on its shaft with the given thickness', () => {
    const g = gearGeo(10, 0.1, 0.4);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.z).toBeCloseTo(-0.2, 6);
    expect(g.boundingBox!.max.z).toBeCloseTo(0.2, 6);
  });
});

describe('rounded rectangles', () => {
  it('stays inside its bounds', () => {
    for (const [x, z] of roundRectPts(-2, -1, 2, 1, 0.3)) {
      expect(x).toBeGreaterThanOrEqual(-2 - 1e-9); expect(x).toBeLessThanOrEqual(2 + 1e-9);
      expect(z).toBeGreaterThanOrEqual(-1 - 1e-9); expect(z).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

it('three is available in the test environment', () => {
  expect(new THREE.Vector3(1, 2, 3).length()).toBeCloseTo(Math.sqrt(14));
});
