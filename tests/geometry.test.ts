import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { R, RING_R, TYRE_W } from '../src/core/dims';
import {
  circleInPolygon, facingGlow, gearGeo, interpStations, lowerArmShape, panelGeo, RIM_SPOKES, rimShape, RING_BOLTS, ringGeo, roundRectPts, springGeo, springPoints, TYRE_LUGS, tyreGeo,
  type P2,
} from '../src/model/geometry';

describe('stations', () => {
  it('interpolates section parameters between stations', () => {
    const defs = [[10, 2, 1, 3, 5], [0, 4, 3, 3, 7]];
    expect(interpStations(defs, 5)).toEqual([5, 3, 2, 3, 6]);
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

describe('circles in polygons', () => {
  const sq: P2[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
  it('accepts a circle clear of every edge and rejects one that crosses or lies outside', () => {
    expect(circleInPolygon([1, 1], 0.9, sq)).toBe(true);
    expect(circleInPolygon([1, 1], 1.1, sq)).toBe(false);
    expect(circleInPolygon([1.85, 1], 0.2, sq)).toBe(false);
    expect(circleInPolygon([3, 1], 0.1, sq)).toBe(false);
    expect(circleInPolygon([1, 1], 0.9, [...sq].reverse())).toBe(true); // either winding
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

describe('wheels', () => {
  const radial = (g: THREE.BufferGeometry) => {
    const p = g.getAttribute('position'); let rMax = 0, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < p.count; i++) { rMax = Math.max(rMax, Math.hypot(p.getX(i), p.getY(i))); zMin = Math.min(zMin, p.getZ(i)); zMax = Math.max(zMax, p.getZ(i)); }
    return { rMax, width: zMax - zMin, zMin, zMax };
  };

  it('builds a tyre whose lugs reach the measured diameter and tread width', () => {
    const t = radial(tyreGeo(R, TYRE_W));
    expect(Math.abs(2 * t.rMax - 2 * R)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(t.width - TYRE_W)).toBeLessThanOrEqual(0.1);
    expect(t.zMax).toBeCloseTo(-t.zMin, 6); // the same on the left and right cars
  });

  it('puts about 30 lugs in each of two staggered shoulder rows', () => {
    expect(TYRE_LUGS).toBeGreaterThanOrEqual(28);
    expect(TYRE_LUGS).toBeLessThanOrEqual(32);
    // feel round each shoulder row from outside: a ray that stops at the full radius has hit a lug
    const mesh = new THREE.Mesh(tyreGeo(R, TYRE_W), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), ray = new THREE.Raycaster(), N = 720;
    const onLug = (a: number, z: number) => {
      ray.set(new THREE.Vector3(5 * Math.cos(a), 5 * Math.sin(a), z), new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0));
      const hit = ray.intersectObject(mesh)[0];
      return !!hit && 5 - hit.distance > R - 0.02;
    };
    const step = (2 * Math.PI) / TYRE_LUGS;
    for (const z of [0.7, -0.7]) {
      const row = Array.from({ length: N }, (_, i) => onLug((i / N) * 2 * Math.PI, z));
      const lugs = row.filter((v, i) => v && !row[(i + N - 1) % N]).length; // count the rising edges round the circle
      expect(lugs, `row at z = ${z}`).toBe(TYRE_LUGS);
    }
    // staggered: the +z row has a lug where the -z row has a gap, half a pitch round
    expect(onLug(0, 0.7)).toBe(true); expect(onLug(0, -0.7)).toBe(false); expect(onLug(step / 2, -0.7)).toBe(true);
  });

  it('rounds the shoulders and ends the lugs on the sidewall, above plain rubber', () => {
    const mesh = new THREE.Mesh(tyreGeo(R, TYRE_W), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), ray = new THREE.Raycaster(), hw = TYRE_W / 2;
    const radial = (a: number, z: number) => { ray.set(new THREE.Vector3(5 * Math.cos(a), 5 * Math.sin(a), z), new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0)); return 5 - ray.intersectObject(mesh)[0].distance; };
    const side = (a: number, rr: number) => { ray.set(new THREE.Vector3(rr * Math.cos(a), rr * Math.sin(a), 3), new THREE.Vector3(0, 0, -1)); return 3 - (ray.intersectObject(mesh)[0]?.distance ?? Infinity); };
    expect(radial(0, hw - 0.03)).toBeLessThan(R - 0.12); // the shoulder is rounded, not square
    expect(radial(0, 0.4)).toBeLessThan(R - 0.003); // and the tread is crowned
    expect(radial(0, hw - 0.2)).toBeLessThan(R - 0.06); // a broad, round shoulder,
    expect(radial(0, hw - 0.35)).toBeLessThan(R - 0.02); // which starts falling away well inside the edge
    expect(side(0, R - 0.5)).toBeCloseTo(hw, 2); // a lug wraps down onto the sidewall here
    for (let i = 0; i < 24; i++) { // none reaches this low: the ray meets the plain sidewall
      const z = side(((i + 0.37) / 24) * 2 * Math.PI, R - 1.1); // off the lathe seams
      expect(z).toBeLessThan(hw - 0.05); expect(z).toBeGreaterThan(hw - 0.2);
    }
  });

  it('has a flat grey ring exactly RING_R across with 5 bolt circles 72° apart', () => {
    const thick = 0.12, g = ringGeo(RING_R, RING_R * 0.79, thick), p = g.getAttribute('position');
    expect(radial(g).rMax).toBeCloseTo(RING_R, 3);
    const angles: number[] = [];
    for (let i = 0; i < p.count; i++) if (p.getZ(i) > thick + 1e-4) angles.push(Math.atan2(p.getY(i), p.getX(i)));
    angles.sort((a, b) => a - b);
    const starts = angles.filter((a, i) => i === 0 || a - angles[i - 1] > 0.3); // a bolt circle starts after each big gap
    const wraps = angles[0] + 2 * Math.PI - angles[angles.length - 1] < 0.3; // one of them straddles ±180°
    expect(starts.length - (wraps ? 1 : 0)).toBe(RING_BOLTS);
    const firstAt = (lo: number) => angles.find((a) => a > lo)!;
    expect(firstAt(-Math.PI / 2 + 0.2) - firstAt(-Math.PI / 2 - 1.2)).toBeCloseTo((2 * Math.PI) / RING_BOLTS, 1);
  });

  it('has 5 spokes, each split into a Y near the lip', () => {
    const s = rimShape(RING_R - 0.3);
    expect(RIM_SPOKES).toBe(5);
    expect(s.holes).toHaveLength(2 * RIM_SPOKES + 1); // 5 openings, 5 gaps in the Ys, and the axle hole
    const big = s.holes.filter((h) => Math.abs(THREE.ShapeUtils.area(h.getPoints())) > 0.1);
    expect(big).toHaveLength(RIM_SPOKES);
  });

  it('keeps the spokes broad: the openings take about half the face between the hub and the lip (photo 28)', () => {
    const rLip = RING_R - 0.3, s = rimShape(rLip);
    const open = s.holes.map((h) => Math.abs(THREE.ShapeUtils.area(h.getPoints()))).filter((a) => a > 0.1).reduce((a, b) => a + b, 0);
    const band = Math.PI * ((0.9 * rLip) ** 2 - (0.4 * rLip) ** 2);
    expect(open / band).toBeGreaterThan(0.35);
    expect(open / band).toBeLessThan(0.55);
  });
});

describe('folded panels', () => {
  it('skins an open section along x with the given thickness', () => {
    const sec: P2[] = [[-2, 4], [-2, 5], [2, 5], [2, 4]];
    const g = panelGeo([{ x: 3, pts: sec }, { x: 0, pts: sec }], 0.08);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.x).toBeCloseTo(3, 6); expect(b.min.x).toBeCloseTo(0, 6);
    expect(b.max.y).toBeCloseTo(5, 6);
    expect(b.max.z).toBeCloseTo(2, 6); expect(b.min.z).toBeCloseTo(-2, 6);
    expect(b.min.y).toBeCloseTo(4, 6);
    // the free edges are exactly t thick: each end point and its inner twin, the outer grid coming first
    const p = g.getAttribute('position'), inner = 2 * sec.length, at = (i: number) => new THREE.Vector3().fromBufferAttribute(p, i);
    for (const j of [0, sec.length - 1]) {
      expect(at(j).distanceTo(at(inner + j))).toBeCloseTo(0.08, 6);
      expect(Math.abs(at(inner + j).z)).toBeLessThan(2); // and it thickens inward
    }
  });
});

describe('closed panel ends', () => {
  const sec: P2[] = [[-2, 4], [-2, 5], [2, 5], [2, 4]];
  const hitsAt = (g: THREE.BufferGeometry, x0: number, dir: number) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x0, 4.4, 0.3), new THREE.Vector3(dir, 0, 0));
    return ray.intersectObject(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))).map((h) => {
      expect(h.face!.normal.x * dir).toBeLessThan(0); // it faces out, toward the viewer
      return h.point.x;
    });
  };
  it('leaves the ends open by default, and caps the asked-for end with a flat face closed by its chord', () => {
    const st = [{ x: 3, pts: sec }, { x: 0, pts: sec }];
    expect(hitsAt(panelGeo(st, 0.08), 10, -1)).toHaveLength(0); // through the open section
    const front = hitsAt(panelGeo(st, 0.08, { capStart: true }), 10, -1);
    expect(front[0]).toBeCloseTo(3, 6);
    expect(front).toHaveLength(1);
    expect(hitsAt(panelGeo(st, 0.08, { capEnd: true }), -10, 1)[0]).toBeCloseTo(0, 6);
  });
});

describe('front arm', () => {
  it('is one plate with two rectangular windows', () => {
    const g = lowerArmShape(1.8, 1.0);
    expect(g.holes).toHaveLength(2);
  });
});

describe('coil springs', () => {
  it('runs one unit down from its top, at the given outer radius, with closed end turns', () => {
    const g = springGeo(0.5, 9, 0.05, 1);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.y).toBeCloseTo(0.05, 2); expect(b.min.y).toBeCloseTo(-1.05, 2);
    expect(b.max.x).toBeCloseTo(0.5, 2);
    // closed ends: the first turn climbs much less than an open one
    const p = springPoints(9, 1);
    const turn = (k: number) => p[k * 16].y - p[(k + 1) * 16].y;
    expect(turn(0)).toBeLessThan(turn(4) / 3);
    expect(turn(8)).toBeLessThan(turn(4) / 3);
  });
});

describe('LED glow', () => {
  const fwd = new THREE.Vector3(1, 0, 0);
  const from = (deg: number) => facingGlow(fwd, new THREE.Vector3(Math.cos((deg * Math.PI) / 180), 0, Math.sin((deg * Math.PI) / 180)));
  it('is full seen head-on and gone from the side and the back', () => {
    expect(from(0)).toBeCloseTo(1, 6);
    expect(from(90)).toBe(0);
    expect(from(-90)).toBe(0);
    expect(from(180)).toBe(0);
  });
  it('fades smoothly as the viewer moves off the lenses\' axis, whatever the length of the vectors', () => {
    const a = [0, 20, 40, 60, 75].map(from);
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeLessThanOrEqual(a[i - 1]);
    expect(a[2]).toBeGreaterThan(0); expect(a[2]).toBeLessThan(1);
    expect(facingGlow(fwd.clone().multiplyScalar(3), new THREE.Vector3(10, 0, 0))).toBeCloseTo(1, 6);
  });
});
