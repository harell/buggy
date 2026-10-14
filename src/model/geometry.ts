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
 * One shoulder lug as a slab `t` thick (tangentially): its cross-section (axial z, radius) runs along the crowned tread
 * from z0, round the rounded shoulder and down the sidewall face to rStop, where it ends. `s` picks the side. It tapers
 * to `taper` of its width toward its sidewall end and is skewed by `yaw` across the tread about its middle, so the rows
 * look moulded rather than stacked.
 */
function shoulderLug(a: number, t: number, s: 1 | -1, z0: number, rStop: number, top: (z: number) => number, hw: number, sh: number, rIn: number, yaw = 0, taper = 1): THREE.BufferGeometry {
  const zc = hw - sh, rc = top(zc) - sh, pts: P2[] = [[z0, rIn], [z0, top(z0)]];
  for (let i = 0; i <= 4; i++) { const u = (i / 4) * (Math.PI / 2); pts.push([zc + sh * Math.sin(u), rc + sh * Math.cos(u)]); }
  pts.push([hw, rStop], [hw - 0.24, rStop], [hw - 0.24, rIn - 0.2]);
  const g = new THREE.ExtrudeGeometry(shapeOf(pts.map(([z, r]): P2 => [s * z, r])), { depth: t, bevelEnabled: false });
  g.deleteAttribute('uv');
  // shape (z, r) extruded along e  →  wheel (radial, tangential, axial)
  g.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, -t / 2, 1, 0, 0, 0, 0, 0, 0, 1));
  const p = g.getAttribute('position'), zm = (s * (z0 + hw)) / 2, k = Math.tan(yaw);
  for (let i = 0; i < p.count; i++) { // taper, then skew across the tread (a shear, so the sidewall face stays at hw)
    p.setY(i, p.getY(i) * lerp(1, taper, Math.max(0, Math.min(1, (rc - p.getX(i)) / (rc - rStop)))) + (p.getZ(i) - zm) * k);
  }
  return g.rotateZ(a);
}
/**
 * Mud-terrain tyre: a rounded carcass, two staggered shoulder rows of chunky hooked lugs that run over the slightly
 * crowned tread, wrap round the rounded shoulders onto the sidewall and stop there (alternately short and long, in
 * three widths, tapering and turned a little either way), small interlocking centre blocks, and plain rubber below.
 * Non-directional, so one geometry serves both sides. `crown` is how far the tread face drops from the centre line to
 * the shoulder; `shoulder` is the rounding radius.
 */
export function tyreGeo(r: number, w: number, { lugs = TYRE_LUGS, bead = r * 0.55, depth = 0.27, crown = 0.04, shoulder = 0.44 } = {}): THREE.BufferGeometry {
  const rc = r - depth, hw = w / 2, st = TAU / lugs, top = (z: number) => r - crown * (z / hw) ** 2, widths = [0.5, 0.62, 0.7];
  const prof: P2[] = [[bead, -hw + 0.18], [bead + 0.35, -hw + 0.08], [rc - 0.45, -hw + 0.1], [rc - 0.1, -hw + 0.2], [rc, -hw + 0.45], [rc + 0.02, 0],
    [rc, hw - 0.45], [rc - 0.1, hw - 0.2], [rc - 0.45, hw - 0.1], [bead + 0.35, hw - 0.08], [bead, hw - 0.18]];
  const carcass = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 48).rotateX(Math.PI / 2);
  carcass.deleteAttribute('uv');
  const parts: THREE.BufferGeometry[] = [carcass];
  for (let k = 0; k < lugs; k++) for (const s of [1, -1] as const) {
    const a = (k + (s > 0 ? 0 : 0.5)) * st, odd = k % 2 === 1, dz = (k % 3 === 1 ? 0.06 : -0.06) * s;
    const z = (z0: number, z1: number): [number, number] => (s > 0 ? [z0 + dz, z1 + dz] : [-z1 + dz, -z0 + dz]);
    parts.push(shoulderLug(a, st * r * widths[k % 3], s, odd ? 0.44 : 0.34, r - (odd ? 0.62 : 0.82), top, hw, shoulder, rc - 0.04, odd ? 0.21 : -0.21, 0.7)); // wraps onto the sidewall
    parts.push(lug(a + s * st * (odd ? 0.4 : 0.44), rc - 0.04, r - 0.03, st * r * 0.3, ...z(odd ? 0.44 : 0.34, odd ? 0.68 : 0.6))); // its hook, making the C-notch
    const zc = (k % 2 ? 1 : -1) * 0.12 * s;
    if (s > 0) parts.push(lug(a + st * 0.25, rc - 0.04, r - 0.04, st * r * 0.42, zc - 0.17, zc + 0.17)); // centre blocks
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/**
 * Rim face (photos 12, 28): 5 broad straight-sided arms from a small solid hub, each flaring into a short Y at the
 * lip, so the 5 big openings between them dominate (about half the face); a small notch splits each Y.
 */
export function rimShape(rLip: number, spokes = RIM_SPOKES): THREE.Shape {
  const s = new THREE.Shape(); s.absarc(0, 0, rLip, 0, TAU, false);
  const at = (r: number, a: number): P2 => [r * Math.cos(a), r * Math.sin(a)], d = Math.PI / 180, step = TAU / spokes;
  const r0 = 0.4 * rLip, rY = 0.7 * rLip, r2 = 0.9 * rLip, half = 0.16 * rLip; // hub, where the Y starts, lip, arm half-width
  const edge = (r: number) => Math.asin(half / r); // a straight arm edge's angle off its centre line at radius r
  for (let k = 0; k < spokes; k++) {
    const a = k * step, b = a + step, open: P2[] = [];
    for (let i = 0; i <= 3; i++) { const r = lerp(r0, rY, i / 3); open.push(at(r, a + edge(r))); } // up one arm's edge
    for (let i = 0; i <= 6; i++) open.push(at(r2, a + 19 * d + (i / 6) * (step - 38 * d))); // along the lip, between the Y tips
    for (let i = 3; i >= 0; i--) { const r = lerp(r0, rY, i / 3); open.push(at(r, b - edge(r))); } // down the next arm
    for (let i = 1; i < 4; i++) open.push(at(r0, b - edge(r0) - (i / 4) * (step - 2 * edge(r0)))); // round the hub
    s.holes.push(shapeOf(open));
    s.holes.push(shapeOf([at(rY + 0.08 * rLip, a), at(r2, a - 5 * d), at(r2, a + 5 * d)])); // the small notch inside the Y
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
 * `capStart` / `capEnd` close the first / last station with a flat face, its outline closed by the chord between
 * the polyline's ends (a pod's front, the hood's nose).
 */
export function panelGeo(stations: Station[], t: number, { capStart = false, capEnd = false } = {}): THREE.BufferGeometry {
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
  for (const [i, on] of [[0, capStart], [m - 1, capEnd]] as const) {
    if (!on) continue;
    const ring = stations[i].pts.filter((p, j, a) => j === 0 || Math.hypot(p[0] - a[j - 1][0], p[1] - a[j - 1][1]) > 1e-6);
    const base = pos.length / 3, faces = THREE.ShapeUtils.triangulateShape(ring.map(([z, y]) => new THREE.Vector2(z, y)), []);
    ring.forEach((p) => vert(stations[i].x, p));
    // face away from the panel: +x at its front end, -x at its rear (the (z, y) → (x, y, z) swap mirrors the winding)
    const out = (stations[i].x >= stations[m - 1 - i].x) !== THREE.ShapeUtils.isClockWise(ring.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const [a, b, c] of faces) if (out) idx.push(base + a, base + b, base + c); else idx.push(base + a, base + c, base + b);
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

/**
 * How strongly a lamp's glow shows to a viewer: full head-on, fading out by about 70° off its forward axis, and none
 * from the side or behind. Neither vector needs to be unit length.
 */
export function facingGlow(forward: THREE.Vector3, toViewer: THREE.Vector3): number {
  const c = forward.dot(toViewer) / (forward.length() * toViewer.length() || 1), t = Math.max(0, Math.min(1, (c - 0.3) / (0.97 - 0.3)));
  return t * t * (3 - 2 * t);
}

/** Point an object built along +y (unit length) from a to b, stretching it to fit. */
export function link(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a), L = d.length();
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(UP, d.divideScalar(L));
  obj.scale.set(1, L, 1);
}
