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
/** Top-view outline (x, z) extruded upward from y = 0. */
export function extrudeTop(pts: readonly P2[], thick: number, bevel = 0.05): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: thick, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
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

/** A rounded trapezoid cross-section (z, y), as a superellipse: bottom half-width hwb, top half-width hwt. */
export function section(zc: number, hwb: number, hwt: number, yb: number, yt: number, p = 5, n = 48): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU, c = Math.cos(t), s = Math.sin(t);
    const u = Math.sign(c) * Math.pow(Math.abs(c), 2 / p), v = Math.sign(s) * Math.pow(Math.abs(s), 2 / p);
    const k = (v + 1) / 2;
    pts.push([zc + u * lerp(hwb, hwt, k), lerp(yb, yt, k)]);
  }
  return pts;
}

export interface Station { x: number; pts: P2[] }
/** Skin a closed, capped shell through cross-sections placed along x (front to back). */
export function loft(stations: Station[]): THREE.BufferGeometry {
  const n = stations[0].pts.length, m = stations.length, pos: number[] = [], idx: number[] = [];
  stations.forEach((st) => st.pts.forEach(([z, y]) => pos.push(st.x, y, z)));
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + ((j + 1) % n), c = (i + 1) * n + j, d = (i + 1) * n + ((j + 1) % n);
    idx.push(a, b, c, b, d, c);
  }
  let side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  side.setIndex(idx);
  side.computeVertexNormals();
  side = side.toNonIndexed();
  const cap = (st: Station, front: boolean) => {
    const cz = st.pts.reduce((s, p) => s + p[0], 0) / n, cy = st.pts.reduce((s, p) => s + p[1], 0) / n;
    const P: number[] = [], N: number[] = [];
    for (let j = 0; j < n; j++) {
      const p0 = st.pts[j], p1 = st.pts[(j + 1) % n];
      const tri: P2[] = front ? [[cz, cy], p1, p0] : [[cz, cy], p0, p1];
      for (const [z, y] of tri) { P.push(st.x, y, z); N.push(front ? 1 : -1, 0, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    return g;
  };
  const first = stations[0].x > stations[m - 1].x;
  const merged = mergeGeometries([side, cap(stations[0], first), cap(stations[m - 1], !first)]);
  if (!merged) throw new Error('loft: could not merge shell geometry');
  return merged;
}

/** Linear interpolation of station rows [x, ...params] at x (rows sorted by descending x). */
export function interpStations(defs: readonly number[][], x: number): number[] {
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

/** Suspension arm plate one unit long along +y, to be stretched between two pivots. */
export function armGeo(w0: number, w1: number): THREE.ExtrudeGeometry {
  const s = shapeOf([[-w0 / 2, 0], [w0 / 2, 0], [w1 / 2, 1], [-w1 / 2, 1]]);
  s.holes.push(shapeOf([[-w0 * 0.25, 0.18], [w0 * 0.25, 0.18], [w1 * 0.18, 0.75], [-w1 * 0.18, 0.75]]));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.26, bevelEnabled: false });
  g.translate(0, 0, -0.13);
  return g;
}

/** Coil spring one unit long running down -y, stretched to the shock's length. */
export function springGeo(radius = 0.4, turns = 7, wire = 0.06): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 16; i++) {
    const t = i / (turns * 16);
    pts.push(V(radius * Math.cos(t * turns * TAU), -t, radius * Math.sin(t * turns * TAU)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 28, wire, 6);
}

/** Point an object built along +y (unit length) from a to b, stretching it to fit. */
export function link(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a), L = d.length();
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(UP, d.divideScalar(L));
  obj.scale.set(1, L, 1);
}
