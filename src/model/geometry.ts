import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lerp, TAU } from '../core/math';

export type P2 = [number, number];
export const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
export const UP: Readonly<THREE.Vector3> = V(0, 1, 0);
export const DOWN: Readonly<THREE.Vector3> = V(0, -1, 0);

export function put<T extends THREE.Object3D>(obj: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): T {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  return obj;
}
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cylX = (r: number, len: number, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
export const cylZ = (r: number, len: number, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
export function tube(points: THREE.Vector3[], r: number, seg = 48, radial = 10, closed = false): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), seg, r, radial, closed);
}

function shapeOf(pts: readonly P2[]): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)));
  s.closePath();
  return s;
}
/** Side-profile outline (x, y) extruded across z, centred on z = 0. */
export function extrudeXY(pts: readonly P2[], depth: number, bevel = 0.06): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return g;
}
/** Top-view outline (x, z) extruded upward from y = 0, optionally with openings through it. */
export function extrudeTop(pts: readonly P2[], thick: number, bevel = 0.05, holes: readonly (readonly P2[])[] = []): THREE.ExtrudeGeometry {
  const sh = shapeOf(pts);
  for (const h of holes) sh.holes.push(shapeOf(h));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
  g.rotateX(Math.PI / 2);
  g.translate(0, thick, 0);
  return g;
}
export function roundRectPts(x0: number, z0: number, x1: number, z1: number, r: number, n = 6): P2[] {
  const pts: P2[] = [];
  const corners: [number, number, number][] = [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, Math.PI / 2], [x0 + r, z0 + r, Math.PI], [x1 - r, z0 + r, 1.5 * Math.PI]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI / 2);
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

/** Whether a circle lies wholly inside a simple polygon (either winding): its centre inside and every edge at least r away. */
export function circleInPolygon([cx, cy]: P2, r: number, poly: readonly P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
    if (ay > cy !== by > cy && cx < ax + ((cy - ay) / dy) * dx) inside = !inside;
    const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(ax + t * dx - cx, ay + t * dy - cy) < r) return false;
  }
  return inside;
}

export interface Station { x: number; pts: P2[] }
/** Linear interpolation of station rows [x, ...params] at x (rows sorted by descending x). */
export function interpStations(defs: readonly (readonly number[])[], x: number): number[] {
  for (let i = 0; i < defs.length - 1; i++) {
    const a = defs[i], b = defs[i + 1];
    if (x <= a[0] && x >= b[0]) {
      const t = (a[0] - x) / (a[0] - b[0]);
      return a.map((v, k) => lerp(v, b[k], t));
    }
  }
  return [...defs[0]];
}

/** Spur gear with real tooth outlines (so meshing is visible), axis along z, centred. */
export function gearGeo(teeth: number, m: number, thick: number, { hole = 0.07, windows = 0 } = {}): THREE.ExtrudeGeometry {
  const rp = (teeth * m) / 2, ro = rp + m * 0.95, rr = rp - m * 1.15, step = TAU / teeth, s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: P2[] = [[rr, a - step * 0.5], [rr, a - step * 0.3], [ro, a - step * 0.13], [ro, a + step * 0.13], [rr, a + step * 0.3]];
    pts.forEach(([r, t], k) => { const x = r * Math.cos(t), y = r * Math.sin(t); if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  }
  s.closePath();
  if (hole) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); s.holes.push(h); }
  if (windows) {
    const r0 = Math.max(hole + 0.12, rr * 0.32), r1 = rr * 0.78;
    for (let w = 0; w < windows; w++) {
      const a0 = (w / windows) * TAU + 0.22, a1 = ((w + 1) / windows) * TAU - 0.22, h = new THREE.Path();
      h.absarc(0, 0, r1, a0, a1, false); h.absarc(0, 0, r0, a1, a0, true); h.closePath(); s.holes.push(h);
    }
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** Front lower arm outline, one unit long along +y: a wide plate with two rectangular windows. */
export function lowerArmShape(w0: number, w1: number): THREE.Shape {
  const s = shapeOf([[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, 1], [-w1 / 2, 1]]);
  for (const [y0, y1] of [[0.14, 0.44], [0.54, 0.84]]) {
    const hw = (y: number) => lerp(w0, w1, y) * 0.3;
    s.holes.push(shapeOf([[-hw(y0), y0], [hw(y0), y0], [hw(y1), y1], [-hw(y1), y1]]));
  }
  return s;
}
/** The arm plate, to be stretched between its pivot and the knuckle with `link`. */
export function armGeo(w0: number, w1: number, thick = 0.24): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(lowerArmShape(w0, w1), { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  return g;
}

/*
 * Wheels. Every builder's axis is z, centred on the wheel; +z is the wheel's outer face.
 */
export const TYRE_LUGS = 30; // per shoulder row
export const RIM_SPOKES = 5;
export const RING_BOLTS = 5;

/** A block placed on the wheel: radial span r0..r1, tangential size t, axial span z0..z1, at angle a. */
function lug(a: number, r0: number, r1: number, t: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(r1 - r0, t, z1 - z0).translate((r0 + r1) / 2, 0, (z0 + z1) / 2).rotateZ(a);
  g.deleteAttribute('uv');
  return g;
}
/**
 * Mud-terrain tyre: a rounded carcass, two staggered shoulder rows of hooked lugs that wrap onto the sidewall,
 * small interlocking centre blocks and a plain sidewall down to the bead. Non-directional, so one geometry
 * serves both sides of the car.
 */
export function tyreGeo(r: number, w: number, { lugs = TYRE_LUGS, bead = r * 0.55, depth = 0.27 } = {}): THREE.BufferGeometry {
  const rc = r - depth, hw = w / 2, st = TAU / lugs;
  const prof: P2[] = [[bead, -hw + 0.18], [bead + 0.35, -hw + 0.08], [rc - 0.45, -hw + 0.1], [rc - 0.1, -hw + 0.2], [rc, -hw + 0.45], [rc + 0.02, 0],
    [rc, hw - 0.45], [rc - 0.1, hw - 0.2], [rc - 0.45, hw - 0.1], [bead + 0.35, hw - 0.08], [bead, hw - 0.18]];
  const carcass = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 60).rotateX(Math.PI / 2);
  carcass.deleteAttribute('uv');
  const parts: THREE.BufferGeometry[] = [carcass];
  for (let k = 0; k < lugs; k++) for (const s of [1, -1]) {
    const a = (k + (s > 0 ? 0 : 0.5)) * st, z = (z0: number, z1: number): [number, number] => (s > 0 ? [z0, z1] : [-z1, -z0]);
    parts.push(lug(a, rc - 0.04, r, st * r * 0.62, ...z(0.36, hw - 0.12))); // shoulder lug
    parts.push(lug(a + s * st * 0.42, rc - 0.04, r - 0.03, st * r * 0.3, ...z(0.36, 0.62))); // its hook, making the C-notch
    parts.push(lug(a, rc - 0.5, rc - 0.02, st * r * 0.55, ...z(hw - 0.16, hw))); // wraps onto the sidewall
    const zc = (k % 2 ? 1 : -1) * 0.12 * s;
    if (s > 0) parts.push(lug(a + st * 0.25, rc - 0.04, r - 0.04, st * r * 0.42, zc - 0.17, zc + 0.17)); // centre blocks
  }
  return mergeGeometries(parts)!;
}

/** Rim face: 5 spokes that each fork into a Y near the lip (5 big openings and a small gap in each Y). */
export function rimShape(rLip: number, spokes = RIM_SPOKES): THREE.Shape {
  const s = new THREE.Shape(); s.absarc(0, 0, rLip, 0, TAU, false);
  const at = (r: number, a: number): P2 => [r * Math.cos(a), r * Math.sin(a)], d = Math.PI / 180, step = TAU / spokes;
  const r0 = 0.4 * rLip, r1 = 0.72 * rLip, r2 = 0.9 * rLip;
  for (let k = 0; k < spokes; k++) {
    const a = k * step, open: P2[] = [];
    for (let i = 0; i <= 6; i++) open.push(at(r2, a + 24 * d + (i / 6) * (step - 48 * d)));
    open.push(at(r1, a + step - 10 * d));
    for (let i = 0; i <= 4; i++) open.push(at(r0, a + step - 13 * d - (i / 4) * (step - 26 * d)));
    open.push(at(r1, a + 10 * d));
    s.holes.push(shapeOf(open));
    s.holes.push(shapeOf([at(r1 - 0.05 * rLip, a), at(r2, a - 11 * d), at(r2, a + 11 * d)])); // the gap inside the Y
  }
  const axle = new THREE.Path(); axle.absarc(0, 0, 0.1 * rLip, 0, TAU, true); s.holes.push(axle);
  return s;
}

/** Flat ring on the wheel face with small hollow bolt circles; its outer radius is exactly rOut. */
export function ringGeo(rOut: number, rIn = rOut * 0.79, thick = 0.12, bolts = RING_BOLTS): THREE.BufferGeometry {
  const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, TAU, false);
  const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(h);
  const parts: THREE.BufferGeometry[] = [new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 64 })];
  const rb = (rOut + rIn) / 2, bw = (rOut - rIn) * 0.16;
  for (let k = 0; k < bolts; k++) {
    const a = Math.PI / 2 + (k / bolts) * TAU;
    parts.push(new THREE.TorusGeometry(bw * 1.4, bw * 0.45, 5, 12).translate(rb * Math.cos(a), rb * Math.sin(a), thick).toNonIndexed());
  }
  parts.forEach((p) => p.deleteAttribute('uv'));
  return mergeGeometries(parts)!;
}

/*
 * Sheet-metal panels. A station is an open polyline (z, y) of the panel's outer face at one x. The skin is
 * thickened toward the right-hand side of the polyline (draw it left to right over the top, so that is inward).
 */
export function panelGeo(stations: Station[], t: number): THREE.BufferGeometry {
  const n = stations[0].pts.length, m = stations.length, pos: number[] = [], idx: number[] = [];
  const inner = stations.map((st) => st.pts.map(([z, y], j): P2 => {
    let nz = 0, ny = 0;
    for (const [a, b] of [[j - 1, j], [j, j + 1]]) {
      if (a < 0 || b >= n) continue;
      const dz = st.pts[b][0] - st.pts[a][0], dy = st.pts[b][1] - st.pts[a][1], l = Math.hypot(dz, dy) || 1;
      nz += dy / l; ny -= dz / l;
    }
    const l = Math.hypot(nz, ny) || 1;
    return [z + (nz / l) * t, y + (ny / l) * t];
  }));
  const vert = (x: number, [z, y]: P2) => { pos.push(x, y, z); return pos.length / 3 - 1; };
  const quad = (a: number, b: number, c: number, d: number) => idx.push(a, b, c, b, d, c);
  const flip = stations[0].x < stations[m - 1].x;
  const grid = (pts: (i: number) => P2[], out: boolean) => {
    const base = pos.length / 3;
    stations.forEach((st, i) => pts(i).forEach((p) => vert(st.x, p)));
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < n - 1; j++) {
      const a = base + i * n + j, b = a + 1, c = a + n, d = c + 1;
      if (out !== flip) quad(a, c, b, d); else quad(a, b, c, d);
    }
  };
  grid((i) => stations[i].pts, true);
  grid((i) => inner[i], false);
  // edges: the two long folds and the two ends, each its own strip so the creases stay sharp
  const strip = (a: P2[], b: P2[], xa: number[], xb: number[], rev: boolean) => {
    for (let k = 0; k < a.length - 1; k++) {
      const p = [vert(xa[k], a[k]), vert(xa[k + 1], a[k + 1]), vert(xb[k], b[k]), vert(xb[k + 1], b[k + 1])];
      if (rev) quad(p[0], p[2], p[1], p[3]); else quad(p[0], p[1], p[2], p[3]);
    }
  };
  const xs = stations.map((st) => st.x);
  for (const [j, rev] of [[0, false], [n - 1, true]] as const) strip(stations.map((st) => st.pts[j]), inner.map((p) => p[j]), xs, xs, rev !== flip);
  for (const [i, rev] of [[0, false], [m - 1, true]] as const) {
    const x = Array(n).fill(stations[i].x);
    strip(stations[i].pts, inner[i], x, x, rev === flip);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Centre line of a coil spring one unit long running down -y (16 points a turn, unit radius). The `closed` turns at
 * each end are wound nearly flat, as on a real spring's ground ends.
 */
export function springPoints(turns: number, closed = 0): THREE.Vector3[] {
  const flat = 0.12, open = turns - 2 * closed, len = open + 2 * closed * flat, pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 16; i++) {
    const u = i / 16, a = u * TAU;
    const h = u < closed ? u * flat : u > turns - closed ? closed * flat + open + (u - turns + closed) * flat : closed * flat + (u - closed);
    pts.push(V(Math.cos(a), -h / len, Math.sin(a)));
  }
  return pts;
}
/**
 * Coil spring `len` long running down -y; `outer` includes the wire. Build it near its working length and stretch it
 * only a little, so the wire keeps its round section.
 */
export function springGeo(outer = 0.4, turns = 7, wire = 0.06, closed = 0, len = 1): THREE.TubeGeometry {
  const r = outer - wire, pts = springPoints(turns, closed).map((p) => V(p.x * r, p.y * len, p.z * r));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, wire, 6);
}

/** Point an object built along +y (unit length) from a to b, stretching it to fit. */
export function link(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a), L = d.length();
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(UP, d.divideScalar(L));
  obj.scale.set(1, L, 1);
}
