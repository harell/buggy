import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PartKey } from '../core/catalog';
import { BATTERY, BUMPER, CHASSIS, HOOD, LIGHT_BAR, R, RING_R, ROOF, SHOCK, SIDE_POD, TYRE_W, TZF, TZR, WING, XF, XR, type Corner } from '../core/dims';
import { AXLE, DRIVE_TEETH, G1, MODULE, MOTOR, STEER_ARM, STEER_MODULE, STEER_TEETH } from '../core/gears';
import { lerp, rng, TAU } from '../core/math';
import {
  armGeo, box, cylX, cylZ, DOWN, extrudeTop, extrudeXY, facingGlow, gearGeo, interpStations, panelGeo, put, RIM_SPOKES, rimShape, ringGeo, roundRectPts, springGeo, tube, tyreGeo, UP, V, type P2,
} from './geometry';
import { MAT, mk, piece, recordBases, type PartMesh, type Piece, type StdMat } from './parts';
import {
  B_PILLAR, FRONT_PANEL, GUARD, WING_CENTRE, WING_DECK, WING_ENDPLATE, WING_LATTICE, WING_TILT, hoodSection, surfHood, FRONT_PIVOT, POD, POD_ST, podBottom, WILD, wildBottom, FRONT_SHOCK_TOP, GEAR_Z, GEARBOX, GEARBOX_OUTLINE, HOOD_ST, KNUCKLE, LOBE_Z, MOTOR_Z, PIVOT, RACK, REAR_PANEL, REAR_SHOCK_LOW, REAR_SHOCK_TOP, TUB,
  type Perforated,
} from './mounts';
import { canvasTex, decal, fontsReady, textTex } from './textures';

export interface Wheel { outer: Piece; spin: THREE.Group; side: -1 | 1; front: boolean; center: THREE.Vector3 }
export interface Shock { group: Piece; update(top: THREE.Vector3, bottom: THREE.Vector3): void }
export interface TieRod { group: Piece; ends: PartMesh[] }
export interface Arm { side: -1 | 1; lower: Piece }
export type Circuit = 'batt' | 'drive' | 'steer' | 'light';
export interface Wire { mesh: PartMesh; tex: THREE.Texture; circuit: Circuit; dir: 1 | -1 }

export interface Car {
  root: THREE.Group;
  sprung: THREE.Group;
  rearUnit: THREE.Group;
  ru: THREE.Group;
  pieces: Record<'chassis' | 'bumper' | 'body' | 'lights' | 'wing' | 'battery' | 'board' | 'steerBox' | 'rack' | 'motor' | 'gear1' | 'gearCase' | 'wires', Piece>;
  wheels: Record<Corner, Wheel>;
  knuckles: Piece[];
  tieRods: TieRod[];
  arms: Arm[];
  shocks: Record<Corner, Shock>;
  rotor: THREE.Group;
  motorCan: PartMesh;
  driveGears: { g1a: PartMesh; g1b: PartMesh; fg: PartMesh; axle: PartMesh };
  steerGears: { motor: PartMesh; big: PartMesh; pinion: PartMesh };
  wires: Wire[];
  leds: PartMesh[];
  ledGlows: THREE.Sprite[];
  headlight: THREE.SpotLight;
  /** Main anchor mesh per part for labels. */
  anchors: { roof: PartMesh };
  decalsReady: Promise<void>;
}

/* Fixed points of the chassis not shared with the tests (see mounts.ts for those). */
const NOSE_X = 9.9; // front of the nose block
const DIAL_X = 5.75; // steering-trim dial, under the car
const LID_TOP = 5.85;
const BOARD = V(3.1, 4.45, -0.3);
const BATT_CELL = { x: BATTERY.bayX + BATTERY.bayL / 2 - 0.3 - BATTERY.r, y: CHASSIS.clearance + 0.17 + BATTERY.r } as const;
export const ANT_TIP = V(TUB.x0 + 1.0, 4.65, TUB.hw - 0.55); // far end of the antenna coil

/* Body panels. */
const FRAME_R = 0.11, PANEL_T = 0.07;
/** Right pod section drawn inner-top → outer-bottom; the left one is its mirror. A sharp, nearly flat ledge splits it. */
function podSection([x, hw, top, inset]: readonly number[], s: number): P2[] {
  const y0 = podBottom(x), ledge = Math.max(POD.ledge, y0 + 0.3);
  const crease = hw - Math.min(0.02, inset); // gone where the ledge has run out, so the WILD ROAD panel is flat
  const pts: P2[] = [[hw - 1.25, top - 0.3], [hw - 1.25, top], [hw - inset - 0.08, top - 0.03], [hw - inset, ledge + 0.05], [hw - inset, ledge + 0.05], [crease, ledge],
    [crease, ledge], [hw, Math.min(y0 + 0.2, ledge - 0.05)], [hw - 0.3, y0]];
  return s > 0 ? pts : pts.map(([z, y]): P2 => [-z, y]).reverse();
}
/** Where the front arch meets the flat lower edge. */
const ARCH_END = XF - Math.sqrt(POD.archF ** 2 - (POD.bottom - R) ** 2);
/** Pod stations: the key ones, close ones over the front arch so the cut edge stays round, and the rear cut's start. */
const POD_X = [...new Set([...POD_ST.map((r) => r[0]), ...Array.from({ length: 5 }, (_, i) => lerp(SIDE_POD.frontX, ARCH_END, (i + 1) / 5)), POD.cutX])].sort((a, b) => b - a);
/** The pod's front edge is raked in a straight line (photos 12, 13): its top leans forward, its foot tucks behind the tyre. */
const podRake = (x: number, y: number) => 0.9 * Math.max(0, 1 - (SIDE_POD.frontX - x) / 1.2) * Math.max(0, Math.min(1, (y - POD.bottom) / (POD_ST[0][2] - POD.bottom)));
/** |z| of a pod's outer face at (x, y). */
function podZ(x: number, y: number): number {
  const [, hw, top, inset] = interpStations(POD_ST, x);
  return y <= POD.ledge ? hw : lerp(hw - inset, hw - inset - 0.08, Math.min(1, (y - POD.ledge) / (top - POD.ledge)));
}
/** A flat outline (x, y) laid onto a pod's outer face. */
function onPod(pts: P2[], s: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setZ(i, s * (podZ(p.getX(i), p.getY(i)) + 0.01));
  return g;
}
/**
 * Roof plate (photos 15, 17): waisted, with chamfered corners; a deep U-notch at the front, about half its width, between
 * broad downturned legs (the light bar tucks under the plate there, its LEDs in the notch); a wide shallow notch at the
 * rear; folded edges all round the sides.
 */
function roofGeo(): THREE.BufferGeometry {
  const f = ROOF.frontX, r = ROOF.rearX, hw = ROOF.w / 2, nh = 1.1, nd = 1.2, rh = hw * 0.62, cf = 0.2, cr = 0.35, mid = (f + r) / 2, waist = 0.3;
  const side = (s: number): P2[] => [[f, s * (hw - cf)], [f - cf, s * hw], [mid + 0.9, s * hw], [mid, s * (hw - waist)], [mid - 0.9, s * hw], [r + cr, s * hw], [r, s * (hw - cr)]];
  const outline: P2[] = [[f, -nh], [f - nd, -nh], [f - nd, nh], [f, nh], ...side(1), [r, rh], [r + 0.35, rh - 0.15], [r + 0.35, -rh + 0.15], [r, -rh], ...side(-1).reverse()];
  const plate = extrudeTop(outline, PANEL_T, 0.02).translate(0, ROOF.top - PANEL_T, 0);
  const parts: THREE.BufferGeometry[] = [plate];
  for (const s of SIDES) {
    const e = side(s);
    for (let k = 1; k < e.length - 2; k++) { // folded edge, following the waist and the chamfers
      const [ax, az] = e[k], [bx, bz] = e[k + 1], L = Math.hypot(bx - ax, bz - az);
      parts.push(box(L, 0.3, PANEL_T).rotateY(Math.atan2(-(bz - az), bx - ax)).translate((ax + bx) / 2, ROOF.top - 0.15, (az + bz) / 2 - s * 0.02).toNonIndexed());
    }
    const legIn = LIGHT_BAR.w / 2 + 0.05; // beside the light bar's ends, which tuck under the plate
    parts.push(box(PANEL_T, 0.95, hw - cf - legIn).translate(f - 0.03, ROOF.top - 0.47, (s * (hw - cf + legIn)) / 2).toNonIndexed()); // downturned front leg
    parts.push(box(PANEL_T, 0.5, hw - cr - rh).translate(r + 0.03, ROOF.top - 0.25, (s * (hw - cr + rh)) / 2).toNonIndexed()); // short rear leg beside the notch
  }
  return mergeGeometries(parts)!;
}
/** Flat black infill plate (outline in x, y) with round holes, centred on z = 0. */
function perforated({ outline, holes, hr }: Perforated): THREE.BufferGeometry {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const [x, y] of holes) { const h = new THREE.Path(); h.absarc(x, y, hr, 0, TAU, true); s.holes.push(h); }
  return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.03);
}
/** Sticker finish: matte vinyl, so dark ink stays dark instead of mirroring the sky (the paint under it is toned down too). */
const VINYL = { roughness: 0.6, metalness: 0, envMapIntensity: 0.3 } as const, INK_VINYL = { roughness: 0.8, metalness: 0, envMapIntensity: 0.15 } as const;
/**
 * A decal laid out along u (text direction) and v (letter tops) from c, optionally pressed onto a curved surface. A
 * pressed one is cut about every 0.15 so its chords follow the surface instead of sinking into it at the creases.
 */
function sticker(parent: THREE.Object3D, part: PartKey, tex: THREE.Texture, w: number, h: number, c: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, surf?: (p: THREE.Vector3) => void,
  finish: THREE.MeshStandardMaterialParameters = VINYL): PartMesh {
  const g = surf ? new THREE.PlaneGeometry(w, h, Math.max(16, Math.ceil(w / 0.15)), Math.max(4, Math.ceil(h / 0.15))) : new THREE.PlaneGeometry(w, h), p = g.getAttribute('position'), q = V();
  for (let i = 0; i < p.count; i++) {
    q.copy(c).addScaledVector(u, p.getX(i)).addScaledVector(v, p.getY(i)); surf?.(q);
    p.setXYZ(i, q.x, q.y, q.z);
  }
  g.computeVertexNormals();
  const m = mk(g, () => new THREE.MeshStandardMaterial({ map: tex, transparent: true, ...finish, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }), part, { cast: false });
  parent.add(m);
  return m;
}

const std = (o: THREE.MeshStandardMaterialParameters) => (): StdMat => new THREE.MeshStandardMaterial(o);
/**
 * Fine silver metallic flake in the paint (photos 15, 29): each tiny cell of the panel tilts the base coat's normal a
 * little at random, so it sparkles, while the clear coat above stays smooth (the decals are separate meshes).
 */
function flake(m: THREE.MeshPhysicalMaterial, cell = 0.025, strength = 0.14): THREE.MeshPhysicalMaterial {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFlake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlake = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vFlake;
vec3 flakeHash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(normal + (flakeHash(floor(vFlake / ${cell.toFixed(4)})) - 0.5) * ${strength.toFixed(3)});`);
  };
  m.customProgramCacheKey = () => `flake${cell}${strength}`;
  return m;
}
/** The real car's finishes (measured from the blue car's photos). */
const M = {
  shell: (): StdMat => flake(new THREE.MeshPhysicalMaterial({ color: 0x1550f0, metalness: 0.5, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.6, side: THREE.DoubleSide })),
  /** The same paint on the near-horizontal roof and hood, which face the bright sky: less clearcoat so they stay blue from above. */
  shellTop: (): StdMat => flake(new THREE.MeshPhysicalMaterial({ color: 0x1248d8, metalness: 0.45, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.3, side: THREE.DoubleSide })),
  plastic: std({ color: 0x1e1f22, roughness: 0.5, metalness: 0.05 }),
  plasticDark: std({ color: 0x18191c, roughness: 0.62, metalness: 0.03 }),
  /** Satin black moulded housings (gearbox, steering box): solid on the real car. */
  housing: std({ color: 0x17181b, roughness: 0.42, metalness: 0.06 }),
  tyre: std({ color: 0x1c1f22, roughness: 0.8, envMapIntensity: 1 }), // a little sheen, so the lugs read on the shaded side
  /** Near-black satin spokes (photo 12) whose broad faces still catch the light against the black interior (photo 28). */
  rim: (): StdMat => new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.32, metalness: 0.25, clearcoat: 0.2, clearcoatRoughness: 0.2, envMapIntensity: 1.3 }),
  ring: std({ color: 0xb0bec8, roughness: 0.6, metalness: 0.1 }),
  spring: std({ color: 0xdde2e8, metalness: 0.95, roughness: 0.18 }),
  vent: std({ color: 0x0c0d0f, roughness: 0.8, side: THREE.DoubleSide }),
  screw: std({ color: 0xffffff, metalness: 0.95, roughness: 0.25, vertexColors: true }),
};

/** Silver Phillips pan heads (with dark cross slots), merged into one mesh: each [position, facing]. */
function screwHeads(list: readonly (readonly [THREE.Vector3, Readonly<THREE.Vector3>])[], r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [], q = new THREE.Quaternion();
  const paint = (g: THREE.BufferGeometry, c: number) => {
    const n = g.getAttribute('position').count, col = new THREE.Color(c), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
  };
  for (const [p, n] of list) {
    q.setFromUnitVectors(UP, n);
    const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
    parts.push(paint(new THREE.SphereGeometry(r, 14, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.42, 1), 0xc9ced6).applyMatrix4(m));
    for (const a of [0, Math.PI / 2]) parts.push(paint(box(r * 1.3, r * 0.2, r * 0.2).rotateY(a).translate(0, r * 0.38, 0), 0x2a2d33).applyMatrix4(m));
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

const v3 = (pts: [number, number, number][]) => pts.map((p) => V(...p));
const glowFwd = V(), glowEye = V(), glowPos = V();
const SIDES = [-1, 1] as const;

export function buildCar(scene: THREE.Scene): Car {
  const root = new THREE.Group(); scene.add(root);
  const sprung = new THREE.Group(); root.add(sprung);
  const rearUnit = new THREE.Group(); rearUnit.position.copy(PIVOT); sprung.add(rearUnit);

  /* ---- Chassis: black ABS tub, nose block, battery bay underneath, front bumper ---- */
  const pChassis = piece('chassis', sprung, V(0, -0.4, 0));
  {
    const c = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => pChassis.add(put(mk(geo, M.plastic, 'chassis'), x, y, z, rx, ry, rz));
    const y0 = CHASSIS.clearance, bay = { x0: BATTERY.bayX - BATTERY.bayL / 2, x1: BATTERY.bayX + BATTERY.bayL / 2, hw: BATTERY.bayW / 2 };
    // belly plate: the wide tub between the axles, narrowing into the nose block
    c(extrudeTop([[NOSE_X, -1.5], [8.2, -1.9], [TUB.x1 + 1.2, -2.0], [TUB.x1, -TUB.hw], [TUB.x0 + 0.3, -TUB.hw], [TUB.x0, -TUB.hw + 0.3],
      [TUB.x0, TUB.hw - 0.3], [TUB.x0 + 0.3, TUB.hw], [TUB.x1, TUB.hw], [TUB.x1 + 1.2, 2.0], [8.2, 1.9], [NOSE_X, 1.5]], 0.3, 0.04,
    [roundRectPts(bay.x0, -bay.hw, bay.x1, bay.hw, 0.25)]), 0, y0 + 0.08, 0); // with the battery bay's opening, which the cover closes
    for (const s of SIDES) c(box(TUB.x1 - TUB.x0, TUB.top - y0 - 0.4, 0.2), (TUB.x0 + TUB.x1) / 2, (TUB.top + y0 + 0.4) / 2, s * (TUB.hw - 0.1)); // tub walls
    for (const x of [TUB.x0 + 0.1, TUB.x1 - 0.1]) c(box(0.2, TUB.top - y0 - 0.4, 2 * TUB.hw - 0.2), x, (TUB.top + y0 + 0.4) / 2, 0);
    c(box(TUB.x1 - TUB.x0 - 0.4, 0.14, 2 * TUB.hw - 0.4), (TUB.x0 + TUB.x1) / 2, TUB.floor, 0); // bay ceiling = electronics floor
    c(box(NOSE_X - TUB.x1, 1.45, 3.1), (NOSE_X + TUB.x1) / 2, y0 + 1.1, 0); // nose block: carries the arms and the steering
    // front shock towers beside the hood's front corners, each with a round boss for the shock's top eye
    for (const s of SIDES) {
      const t = FRONT_SHOCK_TOP(s);
      c(extrudeXY([[t.x - 0.75, y0 + 1.7], [t.x + 0.45, y0 + 1.7], [t.x + 0.1, t.y - 0.2], [t.x - 0.45, t.y - 0.2]], 0.24, 0.03), 0, 0, t.z - s * 0.4); // slim, just inboard of its own boss
      c(new THREE.CylinderGeometry(0.27, 0.27, 0.45, 18).rotateZ(Math.PI / 2), t.x - 0.33, t.y, t.z); // behind the eye, so its screw shows
    }
    // battery cover: one screw at a rear corner, a tab at the other, moulded print
    pChassis.add(put(mk(extrudeTop(roundRectPts(bay.x0, -bay.hw, bay.x1, bay.hw, 0.25), 0.12, 0.02), M.plasticDark, 'chassis'), 0, y0, 0));
    c(box(0.5, 0.1, 0.9), bay.x0 + 0.15, y0 - 0.03, bay.hw - 1.1); // tab
    const print = canvasTex(512, 600, (g, w) => {
      g.fillStyle = '#7d8590'; g.textAlign = 'center'; g.font = '700 46px sans-serif';
      g.fillText('2.4GHz', w / 2, 70); g.fillText('CE  UK CA', w / 2, 200); g.font = '700 34px sans-serif';
      g.fillText('CAUTION-ELECTRIC TOY', w / 2, 300); g.strokeStyle = '#7d8590'; g.lineWidth = 4; g.strokeRect(90, 345, 332, 60); g.fillText('MADE IN CHINA', w / 2, 388);
      g.font = '800 70px sans-serif'; g.fillText('K.K', w / 2, 540);
    });
    print.colorSpace = THREE.SRGBColorSpace;
    // seen from below with the nose up, the print reads with its top toward the nose
    decal(pChassis, 'chassis', print, BATTERY.bayW * 0.8, BATTERY.bayL * 0.75, V(BATTERY.bayX - 0.2, y0 - 0.035, 0), null, [Math.PI / 2, 0, -Math.PI / 2]);
    // power switch at the front edge of the cover on the car's left: ON inboard, OFF outboard (set to ON)
    c(box(0.45, 0.1, 1.0), bay.x1 + 0.4, y0 + 0.03, -1.9);
    pChassis.add(put(mk(box(0.32, 0.16, 0.36), () => new THREE.MeshStandardMaterial({ color: 0xff4a1c, roughness: 0.45 }), 'chassis'), bay.x1 + 0.4, y0 - 0.02, -1.62));
    // steering-trim dial on the centre line just behind the arm block, between the tie rods' inner ends
    const dial = canvasTex(256, 256, (g, w) => {
      g.strokeStyle = '#555b63'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, w / 2, 104, Math.PI, TAU); g.lineTo(w - 24, w / 2); g.stroke();
      for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 + 84 * Math.cos(a), w / 2 + 84 * Math.sin(a)); g.lineTo(w / 2 + 70 * Math.cos(a), w / 2 + 70 * Math.sin(a)); g.stroke(); }
      g.fillStyle = '#555b63'; g.fillRect(14, w / 2 - 24, 22, 22); g.fillRect(w - 36, w / 2 - 24, 22, 22);
    });
    // flat edge toward the nose, graduated arc behind it, and a lever running back from a round hub
    c(new THREE.CylinderGeometry(0.75, 0.75, 0.04, 24, 1, false, 0, Math.PI), DIAL_X, y0 + 0.06, 0, 0, Math.PI, 0);
    decal(pChassis, 'chassis', dial, 1.5, 1.5, V(DIAL_X, y0 + 0.03, 0), null, [Math.PI / 2, 0, Math.PI / 2]);
    c(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 14), DIAL_X, y0 - 0.09, 0);
    c(box(0.55, 0.1, 0.16), DIAL_X - 0.3, y0 - 0.11, 0);
    // round recesses ahead of and behind the bay
    for (const x of [bay.x1 + 0.55, bay.x0 - 0.3]) c(new THREE.TorusGeometry(0.26, 0.06, 6, 16).rotateX(Math.PI / 2), x, y0 + 0.05, 0);
    pChassis.add(mk(screwHeads([
      [V(bay.x0 + 0.42, y0 - 0.01, -(bay.hw - 0.42)), DOWN], // the one cover screw (rear-left on the real cars' undersides)
      ...[[NOSE_X - 0.7, 0], [NOSE_X - 2.3, -0.75], [NOSE_X - 2.3, 0.75]].map(([x, z]) => [V(x, y0 + 0.07, z), DOWN] as const), // 3 nose screws in a triangle
    ], 0.17), M.screw, 'chassis'));
    // rear shock crossbar behind the cockpit, flat-faced, on two posts from the tub's rear corners
    for (const s of SIDES) c(tube(v3([[TUB.x0 + 0.2, TUB.top - 0.2, s * 2.4], [TUB.x0 - 0.8, TUB.top + 1.2, s * 2.55], [REAR_SHOCK_TOP(s).x, REAR_SHOCK_TOP(s).y - 0.25, s * 2.6]]), 0.13, 16, 8));
    c(box(0.35, 0.55, 2 * REAR_SHOCK_TOP(1).z - 0.14), REAR_SHOCK_TOP(1).x, REAR_SHOCK_TOP(1).y, 0); // ends at the shocks' eyes
    c(cylZ(0.34, 3.6, 18), PIVOT.x, PIVOT.y, 0); // pivot boss for the rear drive unit
  }

  /* ---- Front bumper: flat plate kicked forward at the top, round-section hoop behind and below ---- */
  const pBumper = piece('chassis', sprung, V(2, 0, 0));
  {
    const sh = new THREE.Shape(), hw = BUMPER.plateW / 2, len = Math.hypot(BUMPER.top - BUMPER.bottom, 0.55), r = 0.35;
    sh.moveTo(-hw + r, 0); sh.lineTo(hw - r, 0); sh.quadraticCurveTo(hw, 0, hw, r); sh.lineTo(hw, len - r); sh.quadraticCurveTo(hw, len, hw - r, len);
    sh.lineTo(-hw + r, len); sh.quadraticCurveTo(-hw, len, -hw, len - r); sh.lineTo(-hw, r); sh.quadraticCurveTo(-hw, 0, -hw + r, 0);
    const plate = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }).rotateY(Math.PI / 2).rotateZ(-Math.atan2(0.55, BUMPER.top - BUMPER.bottom));
    plate.computeBoundingBox(); plate.translate(BUMPER.faceX - plate.boundingBox!.max.x, BUMPER.bottom - plate.boundingBox!.min.y, 0);
    pBumper.add(mk(plate, std({ color: 0x2b2e34, roughness: 0.36, metalness: 0.08 }), 'chassis')); // satin, so it reads as a plate, not a hole
    pBumper.add(put(mk(box(NOSE_X - 9.2 + 1.5, 0.45, 2.2), M.plastic, 'chassis'), (NOSE_X + 9.2) / 2 + 0.2, BUMPER.bottom + 0.15, 0)); // mount to the nose
    const h = BUMPER.hoopW / 2 - 0.14, hy = BUMPER.bottom - 0.35;
    pBumper.add(mk(tube(v3([[NOSE_X - 0.6, hy + 0.15, -1.6], [NOSE_X + 0.1, hy, -h + 0.25], [NOSE_X + 0.75, hy + 0.05, -h], [BUMPER.faceX - 0.45, hy + 0.2, -h + 0.7],
      [BUMPER.faceX - 0.55, hy + 0.35, -1.6], [BUMPER.faceX - 0.6, hy + 0.4, 0], [BUMPER.faceX - 0.55, hy + 0.35, 1.6], [BUMPER.faceX - 0.45, hy + 0.2, h - 0.7],
      [NOSE_X + 0.75, hy + 0.05, h], [NOSE_X + 0.1, hy, h - 0.25], [NOSE_X - 0.6, hy + 0.15, 1.6]]), 0.14, 80, 8), M.plastic, 'chassis'));
  }

  /* ---- Body: painted metal panels screwed to a moulded black plastic frame; they lift off together ---- */
  const BODY_EX = V(0, 9, 0);
  const pBody = piece('body', sprung, BODY_EX);
  const roof = mk(roofGeo(), M.shellTop, 'body');
  {
    const bar = (pts: [number, number, number][], r = FRAME_R) => pBody.add(mk(tube(v3(pts), r, 8 * pts.length, 8), M.plastic, 'body'));
    pBody.add(mk(panelGeo(HOOD_ST.map(([x, hw, y]) => ({ x, pts: hoodSection(hw, y) })), PANEL_T, { capStart: true }), M.shellTop, 'body')); // the nose folds down closed
    for (const s of SIDES) { // each pod's raked front is a closed, flat painted face
      const pod = panelGeo(POD_X.map((x) => ({ x, pts: podSection(interpStations(POD_ST, x), s) })), PANEL_T, { capStart: true }), p = pod.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + podRake(p.getX(i), p.getY(i)));
      pod.computeVertexNormals();
      pBody.add(mk(pod, M.shell, 'body'));
    }
    pBody.add(roof);
    // the moulded frame: A-pillars, front cross-tube (carries the light bar), roof rails, B-pillars, side diagonals, rear hoop
    const rf = (s: number) => [ROOF.frontX - 0.12, ROOF.top - 0.2, s * (ROOF.w / 2 - 0.15)] as [number, number, number];
    const rr = (s: number) => B_PILLAR(s)[0];
    for (const s of SIDES) {
      const hood = HOOD_ST[HOOD_ST.length - 1];
      bar([[HOOD.rearX + 0.25, surfHood(HOOD.rearX + 0.25, hood[1] - 0.35) - 0.05, s * (hood[1] - 0.35)], [HOOD.rearX, 7.6, s * 2.25], rf(s)]); // A-pillar
      bar([rf(s), [-1.0, ROOF.top - 0.2, s * (ROOF.w / 2 - 0.12)], rr(s)]); // roof rail
      bar(B_PILLAR(s)); // B-pillar, along the rear infill's top edge to the shock crossbar
      bar([[ROOF.frontX - 0.4, ROOF.top - 0.35, s * 2.0], [-0.6, 7.6, s * 2.65], [-2.0, SIDE_POD.top - 0.05, s * 2.95]]); // side diagonal
      bar([[ROOF.frontX - 0.2, 8.1, s * 2.0], [-1.2, 8.15, s * 2.05], [ROOF.rearX + 0.05, 8.05, s * 2.1]], 0.09); // waist rail, to the hoop leg
      // perforated infill: the rear one closes the triangle behind the cockpit, 6 holes in two staggered rows in its
      // upper part; a small front one with 3
      for (const pn of [REAR_PANEL, FRONT_PANEL]) pBody.add(put(mk(perforated(pn), M.plastic, 'body'), 0, 0, s * pn.z));
    }
    bar([rf(-1), [ROOF.frontX - 0.25, 8.12, -1.2], [ROOF.frontX - 0.25, 8.12, 1.2], rf(1)]); // front cross-tube under the notch
    // rear hoop: its legs frame the rear panels' front edges
    bar([[ROOF.rearX + 0.05, TUB.top + 0.5, -2.35], [ROOF.rearX + 0.05, 8.2, -2.05], [ROOF.rearX + 0.1, ROOF.top - 0.22, -1.1], [ROOF.rearX + 0.1, ROOF.top - 0.22, 1.1], [ROOF.rearX + 0.05, 8.2, 2.05], [ROOF.rearX + 0.05, TUB.top + 0.5, 2.35]]);
    pBody.add(put(mk(box(0.3, 0.32, 4.9), M.plastic, 'body'), ROOF.rearX + 0.05, TUB.top + 0.45, 0)); // its bottom crossbar
    for (const s of SIDES) bar([[HOOD.rearX + 0.2, SIDE_POD.top - 0.6, s * 2.7], [-1.0, SIDE_POD.top - 0.5, s * 2.85], [SIDE_POD.rearX + 0.3, SIDE_POD.top - 0.4, s * 2.95]], 0.1); // sill under the pod edge
    // cockpit: black moulded bucket seat with side bolsters and a seat back (no driver)
    pBody.add(put(mk(extrudeXY([[0.5, LID_TOP + 0.05], [0.6, LID_TOP + 0.45], [-1.7, LID_TOP + 0.4], [-2.1, 8.3], [-2.55, 8.3], [-2.4, LID_TOP + 0.05]], 1.9, 0.1), M.plastic, 'body'), 0, 0, 0));
    for (const s of SIDES) pBody.add(put(mk(extrudeXY([[0.3, LID_TOP + 0.4], [0.2, LID_TOP + 0.85], [-1.6, LID_TOP + 0.9], [-2.0, 8.1], [-2.45, 8.1], [-2.35, LID_TOP + 0.4]], 0.3, 0.08), M.plastic, 'body'), 0, 0, s * 1.05));
    // silver pan-head screws: hood 3, pods 3 a side, roof 3, rear crossbar 2
    const hs = (x: number, z: number) => V(x, surfHood(x, z) + 0.02, z);
    const ps = (x: number, y: number, s: number) => V(x, y, s * (podZ(x, y) + 0.02));
    pBody.add(mk(screwHeads([
      [hs(HOOD.rearX + 0.35, -2.3), UP], [hs(HOOD.rearX + 0.35, 2.3), UP], [hs(HOOD.tipX - 0.45, 0), UP],
      // pods: just ahead of the '08', just ahead of the WILD ROAD frame's lower front corner, and up at the rear corner
      ...SIDES.flatMap((s) => [[ps(3.3, 5.05, s), V(0, 0, s)], [ps(WILD.x0 + 0.22, POD.bottom + 0.45, s), V(0, 0, s)], [ps(-4.35, 6.45, s), V(0, 0, s)]] as const),
      [V(ROOF.frontX - 0.3, ROOF.top + 0.02, -1.8), UP], [V(ROOF.frontX - 0.3, ROOF.top + 0.02, 1.8), UP], [V(ROOF.rearX + 0.6, ROOF.top + 0.02, 0), UP],
      [V(ROOF.rearX - 0.11, TUB.top + 0.45, -1.2), V(-1, 0, 0)], [V(ROOF.rearX - 0.11, TUB.top + 0.45, 1.2), V(-1, 0, 0)],
    ], 0.14), M.screw, 'body'));
    // pod vents: an elongated upper window with chamfered corners above the ledge, and a long thin slot with an
    // angled front end under SHUTTLE, black frame behind
    for (const s of SIDES) {
      pBody.add(mk(onPod([[-1.75, 6.08], [-1.75, 5.85], [-1.55, 5.65], [0.05, 5.65], [-0.3, 6.3], [-1.55, 6.3]], s), M.vent, 'body', { cast: false }));
      pBody.add(mk(onPod([[-1.7, 3.95], [0.85, 3.95], [1.2, 4.3], [-1.7, 4.42]], s), M.vent, 'body', { cast: false })); // ends clear of the '08'
    }
  }

  /* ---- Light bar: three white LEDs in chrome bezels, in the roof's front notch ---- */
  const pLights = piece('lights', sprung, BODY_EX); // lifts off with the body
  const leds: PartMesh[] = [], ledGlows: THREE.Sprite[] = [];
  const LB = { x: LIGHT_BAR.x, y: ROOF.top - LIGHT_BAR.h / 2, tilt: 0.3 }; // face tilted forward and up
  const lightBar = new THREE.Group(); lightBar.position.set(LB.x, LB.y, 0); lightBar.rotation.z = LB.tilt; pLights.add(lightBar);
  {
    const sh = new THREE.Shape(), hw = LIGHT_BAR.w / 2, r = LIGHT_BAR.h / 2;
    sh.absarc(hw - r, 0, r, -Math.PI / 2, Math.PI / 2, false); sh.absarc(-hw + r, 0, r, Math.PI / 2, 1.5 * Math.PI, false);
    const body = new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 12 }).rotateY(Math.PI / 2).translate(-0.3, 0, 0);
    lightBar.add(mk(body, M.plastic, 'lights'));
    const glowTex = canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(250,252,255,1)'); gr.addColorStop(0.25, 'rgba(225,238,255,.55)'); gr.addColorStop(1, 'rgba(210,228,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    for (let i = 0; i < LIGHT_BAR.leds; i++) {
      const z = (i - (LIGHT_BAR.leds - 1) / 2) * LIGHT_BAR.pitch, lr = LIGHT_BAR.lensR;
      lightBar.add(put(mk(new THREE.TorusGeometry(lr + 0.06, 0.06, 8, 24), MAT.chrome, 'lights'), 0.3, 0, z, 0, Math.PI / 2, 0));
      lightBar.add(put(mk(cylX(lr + 0.04, 0.12, 20), MAT.chrome, 'lights'), 0.24, 0, z)); // recessed bezel cup
      const lens = put(mk(new THREE.SphereGeometry(lr, 20, 10, 0, TAU, 0, Math.PI / 2), () => new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.25, emissive: 0xe8f1ff, emissiveIntensity: 2 }), 'lights', { led: true }), 0.27, 0, z, 0, 0, -Math.PI / 2);
      lens.scale.set(1, 0.55, 1); lightBar.add(lens); leds.push(lens);
      // a small glow in front of each lens that shows only when the lenses face the viewer
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const spr = new THREE.Sprite(glowMat);
      spr.position.set(0.45, 0, z); spr.scale.set(0.95, 0.95, 1);
      spr.onBeforeRender = (_r, _s, cam) => {
        glowFwd.setFromMatrixColumn(spr.matrixWorld, 0);
        glowMat.opacity = facingGlow(glowFwd, glowEye.setFromMatrixPosition(cam.matrixWorld).sub(glowPos.setFromMatrixPosition(spr.matrixWorld)));
      };
      lightBar.add(spr); ledGlows.push(spr);
    }
  }
  const headlight = new THREE.SpotLight(0xf2f6ff, 0, 140, 0.42, 0.6, 0);
  headlight.position.set(HOOD.tipX + 0.3, LB.y, 0); pLights.add(headlight); // ahead of the hood's nose, so it lights the ground, not the car
  const hlTarget = new THREE.Object3D(); hlTarget.position.set(40, -6, 0); pLights.add(hlTarget); headlight.target = hlTarget;

  /* ---- Battery: one 14500 cell lying across the car at the front of the underside bay ---- */
  const pBattery = piece('battery', sprung, V(0, -1.2, -9));
  {
    const label = canvasTex(256, 1024, (g, w, h) => {
      g.fillStyle = '#2a78d8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d5cae'; g.fillRect(0, 0, w, 40); g.fillRect(0, h - 40, w, 40);
      g.save(); g.translate(w * 0.3, h / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 74px "Chakra Petch",sans-serif'; g.fillText('IMR14500', 0, -10); g.font = '600 46px "Chakra Petch",sans-serif'; g.fillText('3.7V  500mAh', 0, 62); g.restore();
    });
    const cx = BATT_CELL.x, cy = BATT_CELL.y, hl = BATTERY.len / 2;
    pBattery.add(put(mk(cylZ(BATTERY.r, BATTERY.len - 0.1, 36), () => new THREE.MeshStandardMaterial({ map: label, roughness: 0.3 }), 'battery'), cx, cy, 0));
    for (const s of SIDES) pBattery.add(put(mk(cylZ(BATTERY.r * 0.82, 0.08, 24), MAT.steel, 'battery'), cx, cy, s * (hl - 0.03)));
    pBattery.add(put(mk(cylZ(0.2, 0.08, 14), MAT.steel, 'battery'), cx, cy, hl + 0.03)); // + button
    // red and black leads from the + end to a small black 2-pin SM plug; its mate comes up through the bay floor
    const plug = V(-1.9, CHASSIS.clearance + 0.45, 0.9);
    for (const [dz, dy, m] of [[0.06, 0.08, MAT.redWire], [-0.06, -0.08, MAT.blackWire]] as const)
      pBattery.add(mk(tube(v3([[cx - 0.2, cy + dy, hl + 0.05], [cx - 0.7, cy + dy, hl + 0.25], [cx - 1.6, CHASSIS.clearance + 0.45 + dy * 0.5, 2.0 + dz], [plug.x + 0.25, plug.y + dy * 0.5, plug.z + dz]]), 0.045, 24, 5), m, 'battery')); // into the plug
    pBattery.add(put(mk(box(0.7, 0.42, 0.55), M.plastic, 'battery'), plug.x, plug.y, plug.z));
    pBattery.add(put(mk(box(0.55, 0.38, 0.5), M.plastic, 'battery'), plug.x - 0.6, plug.y, plug.z));
  }

  /* ---- Receiver board (the brain), copper-coil antenna and the electronics tub lid ---- */
  const pBoard = piece('board', sprung, V(0, 5, 0));
  {
    const pcbTex = canvasTex(512, 400, (g, w, h) => {
      g.fillStyle = '#1f7a3a'; g.fillRect(0, 0, w, h);
      const r = rng(3); g.strokeStyle = 'rgba(222,190,110,.75)'; g.lineWidth = 5; g.lineCap = 'round';
      for (let i = 0; i < 34; i++) {
        let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { if (r() < 0.5) x = r() * w; else y = r() * h; g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = '#d9c27a'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(r() * w, r() * h, 6, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '700 30px "Chakra Petch",sans-serif'; g.fillText('RX-2.4G', 24, h - 24); g.fillText('M+  M-   S+  S-', 250, 40);
    });
    const { x: bx, y: by, z: bz } = BOARD; // PCB centre, at the front end of the tub
    const bd = (geo: THREE.BufferGeometry, mat: () => THREE.MeshStandardMaterial, x: number, y: number, z: number, o = {}) => { const m = put(mk(geo, mat, 'board', o), x, y, z); pBoard.add(m); return m; };
    bd(box(1.6, 0.1, 2.5), () => new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.5 }), bx, by, bz);
    bd(box(0.6, 0.12, 0.6), MAT.chip, bx + 0.2, by + 0.1, bz - 0.5); // receiver chip
    bd(box(0.35, 0.1, 0.3), MAT.chip, bx - 0.45, by + 0.09, bz + 0.6); // drive switches (H-bridge)
    bd(box(0.35, 0.1, 0.3), MAT.chip, bx - 0.45, by + 0.09, bz + 0.15);
    bd(box(0.25, 0.09, 0.25), MAT.chip, bx + 0.45, by + 0.09, bz + 0.65); // steering driver
    bd(box(0.4, 0.16, 0.18), MAT.chrome, bx + 0.5, by + 0.11, bz - 1.0); // crystal
    bd(box(0.12, 0.08, 0.1), () => new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2a1a, emissiveIntensity: 1.5 }), bx + 0.65, by + 0.08, bz + 1.1, { led: true });
    // its own leads: red (one formed into a loop), blue, yellow, white, red/white, and a white 2-pin plug in the tub
    const lead = (pts: [number, number, number][], m: () => THREE.MeshStandardMaterial) => pBoard.add(mk(tube(v3(pts), 0.05, 40, 5), m, 'board'));
    const loop: [number, number, number][] = [];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU; loop.push([bx - 2.2 + 0.32 * Math.cos(a), by + 0.35 + 0.32 * Math.sin(a), -1.5 + i * 0.012]); }
    lead([[bx - 0.6, by + 0.08, bz - 0.9], [bx - 1.5, by + 0.25, -1.3], ...loop, [bx - 1.8, by + 0.1, -0.4], [bx - 0.7, by + 0.07, bz - 0.2]], MAT.redWire);
    lead([[bx - 0.7, by + 0.07, bz + 0.3], [bx - 1.8, by + 0.15, 0.1], [bx - 2.6, by + 0.1, -0.2]], MAT.blueWire);
    lead([[bx - 0.7, by + 0.07, bz + 0.5], [bx - 1.9, by + 0.2, 0.5], [bx - 2.5, by + 0.16, -0.1], [bx - 2.5, by + 0.14, -0.5]], MAT.yellowWire); // into the white plug
    lead([[bx - 0.7, by + 0.07, bz + 0.8], [bx - 1.6, by + 0.12, 1.1], [bx - 2.7, by + 0.12, 0.2], [bx - 2.7, by + 0.1, -0.5]], MAT.white);
    lead([[bx - 0.7, by + 0.07, bz - 0.6], [bx - 1.5, by + 0.1, -0.8], [bx - 2.4, by + 0.06, -0.6]], () => new THREE.MeshStandardMaterial({ color: 0xf0b8b8, roughness: 0.45 }));
    bd(box(0.45, 0.32, 0.6), MAT.white, bx - 2.6, by + 0.12, -0.6);
    // the antenna: an open-pitch copper coil along the tub's right wall
    const coil: THREE.Vector3[] = [], turns = 40, c0 = BOARD.x - 0.6, c1 = ANT_TIP.x;
    for (let i = 0; i <= turns * 10; i++) { const t = i / (turns * 10), a = t * turns * TAU; coil.push(V(lerp(c0, c1, t), ANT_TIP.y + 0.2 * Math.sin(a), ANT_TIP.z + 0.2 * Math.cos(a))); }
    pBoard.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), turns * 8, 0.03, 3), MAT.copper, 'board')); // thin wire: few sides
    // box-shaped lid with a round hole in its top, screwed down from above; see-through while the brain is picked
    const lid = new THREE.Shape(), lp = roundRectPts(TUB.x0 + 0.3, -TUB.hw + 0.25, TUB.x1 - 0.3, TUB.hw - 0.25, 0.3);
    lp.forEach(([x, z], i) => (i ? lid.lineTo(x, z) : lid.moveTo(x, z)));
    const hole = new THREE.Path(); hole.absarc(-1.0, 0, 0.6, 0, TAU, true); lid.holes.push(hole);
    const top = new THREE.ExtrudeGeometry(lid, { depth: 0.14, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, LID_TOP, 0);
    bd(top, M.plastic, 0, 0, 0, { cutaway: 'board' });
    for (const s of SIDES) bd(box(TUB.x1 - TUB.x0 - 0.6, LID_TOP - TUB.top + 0.1, 0.12), M.plastic, (TUB.x0 + TUB.x1) / 2, (LID_TOP + TUB.top) / 2 - 0.05, s * (TUB.hw - 0.3), { cutaway: 'board' });
    for (const x of [TUB.x0 + 0.36, TUB.x1 - 0.36]) bd(box(0.12, LID_TOP - TUB.top + 0.1, 2 * TUB.hw - 0.6), M.plastic, x, (LID_TOP + TUB.top) / 2 - 0.05, 0, { cutaway: 'board' });
    pBoard.add(mk(screwHeads([[-3.8, -2.3], [-3.8, 2.3], [3.2, -2.3], [3.2, 2.3]].map(([x, z]) => [V(x, LID_TOP + 0.02, z), UP] as const), 0.13), M.screw, 'board'));
  }

  /*
   * ---- Steering: motor, gears and rack in the nose (illustrative: the stock box was never photographed), two bare
   * steel half rods hooked into the knuckles' rear-facing steering arms ----
   */
  const pSteerBox = piece('steering', sprung, V(4, 5.5, 0));
  const SB = { x: RACK.x - 0.53, motorX: RACK.x - 1.57, y: RACK.y - 0.35 }; // pinion shaft, motor shaft, gear plane
  // a closed black box, opened up while Steering is picked
  pSteerBox.add(put(mk(extrudeTop(roundRectPts(SB.motorX - 0.6, -1.25, RACK.x + 0.25, 1.25, 0.25), 1.35, 0.05), M.housing, 'steering', { cutaway: 'steering' }), 0, SB.y - 0.2, 0));
  pSteerBox.add(put(mk(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 24), MAT.steel, 'steering'), SB.motorX, SB.y + 0.8, 0));
  pSteerBox.add(put(mk(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 24), MAT.bell, 'steering'), SB.motorX, SB.y + 1.5, 0));
  const sMotor = put(mk(gearGeo(STEER_TEETH.motor, STEER_MODULE, 0.22, { hole: 0.03 }).rotateX(-Math.PI / 2), MAT.brass, 'steering'), SB.motorX, SB.y, 0);
  const sBig = put(mk(gearGeo(STEER_TEETH.big, STEER_MODULE, 0.22, { hole: 0.05, windows: 4 }).rotateX(-Math.PI / 2), MAT.nylon, 'steering'), SB.x, SB.y, 0);
  const sPinion = put(mk(gearGeo(STEER_TEETH.pinion, STEER_MODULE, 0.26, { hole: 0.05 }).rotateX(-Math.PI / 2), MAT.nylon, 'steering'), SB.x, RACK.y, 0);
  pSteerBox.add(sMotor, sBig, sPinion, put(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), MAT.steel, 'steering'), SB.x, SB.y + 0.2, 0));

  const pRack = piece('steering', sprung, V(5.5, 3.2, 0), true);
  {
    const p = Math.PI * STEER_MODULE, teeth: THREE.BufferGeometry[] = [];
    for (let k = -5; k <= 4; k++) teeth.push(box(0.16, 0.26, p * 0.45).translate(RACK.x - 0.21, RACK.y, (k + 0.5) * p)); // stays inside the nose block at full lock
    pRack.add(mk(mergeGeometries(teeth)!, MAT.nylon, 'steering'));
    pRack.add(put(mk(box(0.26, 0.3, 2 * RACK.halfW), MAT.nylon, 'steering'), RACK.x, RACK.y, 0));
    const pts: THREE.Vector3[] = []; // centring spring around the rack
    for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(V(RACK.x + 0.3 * Math.cos(t * TAU * 7), RACK.y + 0.3 * Math.sin(t * TAU * 7), 0.2 + t * 0.8)); }
    pRack.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.03, 4), MAT.steel, 'steering'));
  }
  const tieRods: TieRod[] = [], knuckles: Piece[] = [];
  const HOOK = cylZ(0.035, 0.3, 6).translate(0, 0, -0.1); // the rod's 90° bent ends, upright once linked
  for (const s of SIDES) {
    const tr = piece('steering', sprung, V(3, 2, s * 2.5), true);
    tr.add(mk(new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0), MAT.steel, 'steering'));
    // a Z-bend: the knuckle end hooks up through the steering arm and the rack end down, mirrored left to right
    const ends = [0, 1].map((y) => { const m = mk(HOOK, MAT.steel, 'steering'); m.position.y = y; m.scale.z = y ? s : -s; tr.add(m); return m; });
    tieRods.push({ group: tr, ends });
    // black knuckle on a vertical Phillips kingpin, white plastic stub axle, steering arm facing rearward
    const kn = piece('steering', sprung, V(0, 0.5, s * 3.5), true);
    kn.add(put(mk(box(0.6, 1.0, 0.45), M.plastic, 'steering'), 0, 0.05, 0));
    kn.add(put(mk(cylZ(0.2, 1.0, 12), MAT.white, 'steering'), 0, 0, s * 0.6));
    kn.add(put(mk(box(STEER_ARM + 0.2, 0.18, 0.3), M.plastic, 'steering'), -STEER_ARM / 2, KNUCKLE.armY, 0));
    kn.add(put(mk(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 8), MAT.steel, 'steering'), 0, 0.05, 0)); // kingpin
    kn.add(mk(screwHeads([[V(0, 0.56, 0), UP]], 0.14), M.screw, 'steering'));
    knuckles.push(kn);
  }

  /* ---- Suspension: one wide lower arm a side at the front, four spring-only coil-overs ---- */
  const SPRING_LEN = SHOCK.extended - 0.85, SPRING_GEO = springGeo(SHOCK.springR, SHOCK.coils, 0.045, 1, SPRING_LEN);
  // eyes: the fronts' screws point forward; the rears' point outboard, along z
  const EYE_X = new THREE.TorusGeometry(0.17, 0.07, 8, 16).rotateY(Math.PI / 2), EYE_Z = new THREE.TorusGeometry(0.17, 0.07, 8, 16);
  const EYE_SCREW = (n: THREE.Vector3) => screwHeads([[n.clone().multiplyScalar(0.1), n]], 0.14);
  const makeShock = (ex: THREE.Vector3, eyeAxis: THREE.Vector3): Shock => {
    const g = piece('suspension', sprung, ex, true), EYE = eyeAxis.x ? EYE_X : EYE_Z, SCREW = EYE_SCREW(eyeAxis);
    const part = (geo: THREE.BufferGeometry, mat: () => StdMat) => { const m = mk(geo, mat, 'suspension'); g.add(m); return m; };
    part(EYE, M.plastic); part(SCREW, M.screw);
    part(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 18).translate(0, -0.25, 0), M.plastic); // cap and upper spring seat
    part(new THREE.CylinderGeometry(SHOCK.bodyR, SHOCK.bodyR, 1.6, 18).translate(0, -1.1, 0), M.plastic); // telescopic body
    const shaft = part(new THREE.CylinderGeometry(0.2, 0.2, 1, 14).translate(0, -0.5, 0), M.plastic); shaft.position.y = -1.85; // inner sleeve: black plastic, no oil damper
    const spring = part(SPRING_GEO, M.spring); spring.position.y = -0.35;
    const seat = part(new THREE.CylinderGeometry(0.3, 0.36, 0.22, 18), M.plastic);
    const eye = part(EYE, M.plastic); eye.add(mk(SCREW, M.screw, 'suspension'));
    return {
      group: g,
      update(top, bottom) {
        const d = bottom.clone().sub(top), L = d.length();
        g.position.copy(top); g.quaternion.setFromUnitVectors(DOWN, d.divideScalar(L));
        shaft.scale.y = Math.max(0.05, L - 1.85 - 0.2); spring.scale.y = Math.max(0.2, L - 0.35 - 0.36) / SPRING_LEN;
        seat.position.y = -(L - 0.25); eye.position.y = -L;
      },
    };
  };
  const shocks: Record<Corner, Shock> = {
    FL: makeShock(V(2, 4, -3.5), V(1, 0, 0)), FR: makeShock(V(2, 4, 3.5), V(1, 0, 0)), RL: makeShock(V(-2, 4.5, -3.5), V(0, 0, -1)), RR: makeShock(V(-2, 4.5, 3.5), V(0, 0, 1)),
  };
  const LOWER_ARM = armGeo(1.7, 1.0);
  const arms: Arm[] = SIDES.map((s) => {
    const lower = piece('suspension', sprung, V(0, -0.3, s * 2.2), true); lower.add(mk(LOWER_ARM, M.plastic, 'suspension'));
    return { side: s, lower };
  });
  for (const s of SIDES) pChassis.add(put(mk(cylX(0.12, 1.9, 10), MAT.steel, 'chassis'), FRONT_PIVOT(s).x, FRONT_PIVOT(s).y, FRONT_PIVOT(s).z)); // arm hinge pins

  /* ---- Rear drive unit: a live axle; motor, gearbox and axle swing together on a pivot ---- */
  const ru = new THREE.Group(); ru.position.copy(PIVOT).negate(); rearUnit.add(ru);

  /*
   * Rear wing on a short boxy lattice standing on the gearbox (photo 30), with the tubular rear guard behind the
   * gearbox wrapping round behind the tyres' upper halves (photos 21, 22). No photo shows how the wing is fixed, but
   * its feet sit on the gearbox, so it is carried on the rear drive unit and moves with it.
   */
  const pWing = piece('chassis', ru, V(-2.5, 2.5, 0));
  const wing = new THREE.Group(); pWing.add(wing);
  {
    const w = (geo: THREE.BufferGeometry, mat = M.plastic) => wing.add(mk(geo, mat, 'chassis'));
    const hs = WING.span / 2, T = 0.1, C = WING_CENTRE.lift;
    /** Lay a part on the deck at x (a distance along it from the trailing edge), tilted with it, `lift` above its top. */
    const onDeck = (g: THREE.BufferGeometry, x: number, lift = 0) => g.rotateZ(-WING_TILT).translate(WING.trailX + x * Math.cos(WING_TILT), WING_DECK(WING.trailX + x * Math.cos(WING_TILT)) + lift, 0);
    // the deck, with chamfered front corners
    w(onDeck(extrudeTop([[WING.chord, -hs + 0.5], [WING.chord, hs - 0.5], [WING.chord - 0.6, hs], [0, hs], [0, -hs], [WING.chord - 0.6, -hs]], T, 0.02).translate(0, -T, 0), 0));
    // the raised centre section that carries WILD ROAD, narrowing toward the front, with an angled strake down each side
    const cw = WING_CENTRE.halfW;
    w(onDeck(extrudeTop([[0.2, -cw], [WING.chord - 0.3, -cw + 0.45], [WING.chord - 0.3, cw - 0.45], [0.2, cw]], C, 0.02), 0));
    for (const s of SIDES) {
      w(onDeck(box(2.9, 0.16, 0.08).rotateY(s * Math.atan2(0.45, WING.chord - 0.5)), 1.75, C + 0.04).translate(0, 0, s * (cw - 0.2))); // strake along the edge
      for (const dz of [0, 0.38]) w(onDeck(box(1.5, 0.12, 0.07).rotateY(s * 0.5), 1.7, 0.05).translate(0, 0, s * (3.15 + dz))); // a pair near each tip
      w(onDeck(box(0.2, 0.03, 0.6), 2.1, 0.01).translate(0, 0, s * 3.85), M.vent); // slot near each tip
      w(extrudeXY(WING_ENDPLATE, 0.09, 0.02).translate(0, 0, s * (hs - 0.05))); // tall paddle endplate
    }
    w(onDeck(box(0.22, 0.03, 0.9), 1.85, C + 0.01), M.vent); // slot just behind the screws, on the centre's top
    const sx = WING.chord - 0.75, sp = (z: number) => V(WING.trailX + sx * Math.cos(WING_TILT), WING_DECK(WING.trailX + sx * Math.cos(WING_TILT)) + C + 0.01, z);
    wing.add(mk(screwHeads([[sp(-0.75), V(Math.sin(WING_TILT), Math.cos(WING_TILT), 0)], [sp(0.75), V(Math.sin(WING_TILT), Math.cos(WING_TILT), 0)]], 0.13), M.screw, 'chassis'));
    // the lattice: 4 square struts from the gearbox's top to a pad under the deck, with rungs round them at two heights
    const S = 0.16, [xf, xr] = WING_LATTICE.x, lz = WING_LATTICE.z, under = (x: number) => WING_DECK(x) - T;
    for (const x of [xf, xr]) for (const s of SIDES) {
      const y0 = WING_LATTICE.foot(x), y1 = under(x) + 0.05;
      w(box(S, y1 - y0, S).translate(x, (y0 + y1) / 2, s * lz));
    }
    for (const y of WING_LATTICE.rungs) {
      for (const x of [xf, xr]) w(box(S * 0.8, S * 0.8, 2 * lz).translate(x, y, 0));
      for (const s of SIDES) w(box(xf - xr, S * 0.8, S * 0.8).translate((xf + xr) / 2, y, s * lz));
    }
    w(onDeck(box(xf - xr + 0.5, 0.1, 2 * lz + 0.5), ((xf + xr) / 2 - WING.trailX) / Math.cos(WING_TILT), -T - 0.05)); // pad under the deck
    // the guard: two uprights from the back of the gearbox's lobe, with rungs, and two rails a side that sweep out
    // and wrap round behind the rear tyres at and above their tops, joined at their ends
    const bar = (pts: [number, number, number][], r = 0.11) => w(tube(v3(pts), r, 10 * pts.length, 8));
    const gx = GEARBOX.x0 - 0.2, gz = 1.3, [r0, r1] = GUARD.rails;
    for (const s of SIDES) bar([[GEARBOX.x0 + 0.05, MOTOR.y - 0.35, s * gz], [gx, MOTOR.y, s * gz], [gx, r1, s * gz], [gx + 0.5, r1 + 0.45, s * (gz - 0.2)], [xr - 0.05, WING_LATTICE.rungs[1], s * lz]], 0.12);
    for (const y of GUARD.rails) bar([[gx, y, -gz], [gx, y, gz]], 0.1); // rungs
    for (const s of SIDES) {
      const wrap = (y: number, endX: number): [number, number, number][] => [[gx, y, s * gz], [gx - 0.25, y, s * 2.6], [gx - 0.15, y, s * 3.9], [endX, y, s * (TZR - 1.0)]];
      w(tube(v3(wrap(r0, GUARD.endX[0])), 0.11, 16, 6)); w(tube(v3(wrap(r1, GUARD.endX[1])), 0.11, 16, 6)); // gentle curves: few segments do
      w(tube(v3([[GUARD.endX[0], r0, s * (TZR - 1.0)], [(GUARD.endX[0] + GUARD.endX[1]) / 2 - 0.1, (r0 + r1) / 2, s * (TZR - 0.98)], [GUARD.endX[1], r1, s * (TZR - 1.0)]]), 0.11, 8, 6));
    }
  }
  const pMotor = piece('motor', ru, V(-1, 1, 7)); // it slides out to the right, as on the real car
  const MZ = MOTOR_Z; // the can's inner end; the pinion sits just inboard of it
  const motorCan = put(mk(cylZ(0.78, 2.0, 40), () => new THREE.MeshStandardMaterial({ color: 0xc6ccd4, metalness: 0.95, roughness: 0.3 }), 'motor', { cutaway: 'motor' }), MOTOR.x, MOTOR.y, MZ + 1.0);
  pMotor.add(motorCan);
  pMotor.add(put(mk(cylZ(0.75, 0.5, 36), MAT.bell, 'motor', { cutaway: 'motor' }), MOTOR.x, MOTOR.y, MZ + 2.25));
  pMotor.add(put(mk(cylZ(0.24, 0.16, 16), MAT.brass, 'motor'), MOTOR.x, MOTOR.y, MZ - 0.05));
  for (const dy of [-0.43, 0.43]) pMotor.add(put(mk(box(0.2, 0.26, 0.36), MAT.brass, 'motor'), MOTOR.x, MOTOR.y + dy, MZ + 2.6)); // terminals
  for (const [start, color] of [[0.35, 0xc8473d], [Math.PI + 0.35, 0x3f6fcf]] as const) { // magnets, N red and S blue
    const mag = mk(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 24, 1, true, start, Math.PI - 0.7).rotateX(Math.PI / 2), () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide }), 'motor');
    pMotor.add(put(mag, MOTOR.x, MOTOR.y, MZ + 1.0));
  }
  const rotor = new THREE.Group(); rotor.position.set(MOTOR.x, MOTOR.y, 0); pMotor.add(rotor);
  rotor.add(put(mk(cylZ(0.08, 3.2, 12), MAT.steel, 'motor'), 0, 0, MZ + 1.1));
  for (let i = 0; i < 3; i++) { // three poles with copper windings
    const arm = new THREE.Group(); arm.rotation.z = (i / 3) * TAU; rotor.add(arm);
    arm.add(put(mk(box(0.5, 0.18, 1.5), MAT.steel, 'motor'), 0.25, 0, MZ + 1.0));
    arm.add(put(mk(new THREE.CylinderGeometry(0.58, 0.58, 1.5, 16, 1, false, Math.PI / 2 - 0.5, 1.0).rotateX(Math.PI / 2), MAT.steel, 'motor'), 0, 0, MZ + 1.0));
    arm.add(put(mk(box(0.32, 0.4, 1.7), MAT.copper, 'motor'), 0.29, 0, MZ + 1.0));
  }
  for (let i = 0; i < 3; i++) rotor.add(put(mk(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 8, 1, false, (i / 3) * TAU + 0.12, TAU / 3 - 0.24).rotateX(Math.PI / 2), MAT.copper, 'motor'), 0, 0, MZ + 1.95)); // commutator
  rotor.add(put(mk(gearGeo(DRIVE_TEETH.pinion, MODULE, 0.28, { hole: 0.04 }), MAT.brass, 'gears'), 0, 0, GEAR_Z.pinion)); // pinion on the motor's inner end
  for (const dy of [-0.34, 0.34]) pMotor.add(put(mk(box(0.14, 0.16, 0.26), () => new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 }), 'motor'), MOTOR.x, MOTOR.y + dy, MZ + 1.95)); // brushes

  const pGear1 = piece('gears', ru, V(0, 2, -4));
  const pAxle = piece('gears', ru, V(0, 0, 0));
  const pGearCase = piece('gears', ru, V(-1, 3, -8.5));
  const g1a = put(mk(gearGeo(DRIVE_TEETH.g1Big, MODULE, 0.26, { hole: 0.06, windows: 4 }), MAT.nylon, 'gears'), G1.x, G1.y, GEAR_Z.pinion);
  const g1b = put(mk(gearGeo(DRIVE_TEETH.g1Small, MODULE, 0.3, { hole: 0.06 }), MAT.nylon, 'gears'), G1.x, G1.y, GEAR_Z.final);
  pGear1.add(g1a, g1b, put(mk(cylZ(0.06, 1.0, 8), MAT.steel, 'gears'), G1.x, G1.y, (GEAR_Z.pinion + GEAR_Z.final) / 2));
  const fg = put(mk(gearGeo(DRIVE_TEETH.final, MODULE, 0.3, { hole: 0.17, windows: 5 }), MAT.nylonDark, 'gears'), AXLE.x, AXLE.y, GEAR_Z.final);
  const axle = put(mk(cylZ(0.15, 2 * TZR - 1.8, 14), MAT.steel, 'gears'), AXLE.x, AXLE.y, 0);
  pAxle.add(fg, axle);
  {
    // one solid satin-black housing with a seam on the centre line (issue #10); it opens up while Engine or Gears is picked
    const g = (geo: THREE.BufferGeometry, mat: () => StdMat = M.plastic, o = {}) => pGearCase.add(mk(geo, mat, 'gears', o));
    const OPEN = { cutaway: ['gears', 'motor'] } as const;
    g(extrudeXY(GEARBOX_OUTLINE, 2.1, 0.06), M.housing, OPEN);
    g(tube(GEARBOX_OUTLINE.map(([x, y]) => V(x, y, 0)), 0.075, 160, 6, true)); // the seam: a rim round the two halves
    g(cylZ(0.95, 2 * LOBE_Z, 32).translate(MOTOR.x, MOTOR.y, 0), M.housing, OPEN); // crosswise lobe; the motor lies in its right half
    const oct = new THREE.CylinderGeometry(1.05, 1.05, 0.22, 8).rotateX(Math.PI / 2), cap = cylZ(0.82, 0.3, 24);
    for (const s of SIDES) {
      g(oct.clone().translate(MOTOR.x, MOTOR.y, s * LOBE_Z)); g(cap.clone().translate(MOTOR.x, MOTOR.y, s * (LOBE_Z + 0.12))); // octagon-rimmed caps
      g(cylZ(0.38, TZR - 1.35 - 0.6, 18).translate(AXLE.x, AXLE.y, s * ((TZR - 1.35 + 0.6) / 2))); // axle tube
      for (const dx of [-0.12, 0.12]) g(box(0.08, 0.12, TZR - 2.2).translate(AXLE.x + dx, AXLE.y + 0.4, s * (TZR / 2 + 0.35))); // double rib
      g(cylZ(0.2, 0.35, 12).translate(AXLE.x, AXLE.y, s * (TZR - 1.2)), MAT.white); // white plastic stub axle
      const low = REAR_SHOCK_LOW(s);
      g(extrudeXY([[low.x - 0.35, AXLE.y], [low.x + 0.35, AXLE.y], [low.x + 0.25, low.y + 0.25], [low.x - 0.25, low.y + 0.25]], 0.25, 0.03).translate(0, 0, s * (low.z - 0.2))); // shock lug, against the eye
    }
  }

  /* ---- Wheels: mud-terrain tyre, 5-spoke black rim, flat grey ring, one centre screw ---- */
  const TYRE = tyreGeo(R, TYRE_W, { bead: RING_R });
  const RING = ringGeo(RING_R).translate(0, 0, TYRE_W / 2 - 0.32);
  // deep spokes with rounded edges, so the openings read as holes onto the dark interior
  const RIM_FACE = new THREE.ExtrudeGeometry(rimShape(RING_R * 0.8), { depth: 0.42, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1, curveSegments: 16 }).translate(0, 0, TYRE_W / 2 - 0.81);
  const RIM_BARREL = (() => {
    const g = new THREE.LatheGeometry([[RING_R * 0.8, TYRE_W / 2 - 0.4], [RING_R + 0.02, TYRE_W / 2 - 0.4], [RING_R + 0.02, -TYRE_W / 2 + 0.25], [0.5, -TYRE_W / 2 + 0.25], [0.5, TYRE_W / 2 - 0.6]].map(([r, h]) => new THREE.Vector2(r, h)), 40).rotateX(Math.PI / 2);
    return g;
  })();
  const HUB = (() => {
    const parts: THREE.BufferGeometry[] = []; // round bosses standing out of the rim face's solid centre
    for (let k = 0; k < RIM_SPOKES; k++) { const a = Math.PI / RIM_SPOKES + (k / RIM_SPOKES) * TAU; parts.push(cylZ(0.07, 0.16, 8).translate(0.42 * Math.cos(a), 0.42 * Math.sin(a), TYRE_W / 2 - 0.36)); }
    parts.forEach((p) => p.deleteAttribute('uv'));
    return mergeGeometries(parts)!;
  })();
  const SCREW = screwHeads([[V(0, 0, TYRE_W / 2 - 0.33), V(0, 0, 1)]], 0.2); // on the rim face
  const makeWheel = (front: boolean, side: -1 | 1): Wheel => {
    const outer = piece('wheels', root, V(0, 0, side * 7), true);
    const spin = new THREE.Group(); outer.add(spin);
    spin.add(mk(TYRE, M.tyre, 'wheels'));
    spin.add(mk(RIM_BARREL, () => new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.95, metalness: 0, envMapIntensity: 0.05, side: THREE.DoubleSide }), 'wheels')); // dark matte, so the openings read deep
    spin.add(mk(RIM_FACE, M.rim, 'wheels'));
    spin.add(mk(HUB, M.rim, 'wheels'));
    spin.add(mk(RING, M.ring, 'wheels'));
    spin.add(mk(SCREW, M.screw, 'wheels', { cast: false }));
    spin.add(put(mk(cylZ(0.24, 0.3, 14), MAT.white, 'wheels'), 0, 0, -TYRE_W / 2 + 0.05)); // white plastic bushing on the stub axle
    return { outer, spin, side, front, center: V(front ? XF : XR, R, side * (front ? TZF : TZR)) };
  };
  const wheels: Record<Corner, Wheel> = { FL: makeWheel(true, -1), FR: makeWheel(true, 1), RL: makeWheel(false, -1), RR: makeWheel(false, 1) };

  /* ---- Wires: tubes whose glow shows electricity moving ---- */
  const flowTex = canvasTex(128, 8, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#000'); gr.addColorStop(0.8, '#fff'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  flowTex.wrapS = flowTex.wrapT = THREE.RepeatWrapping; flowTex.colorSpace = THREE.NoColorSpace;
  const pWires = piece('wires', sprung, V(0, 0, 0));
  const wires: Wire[] = [];
  const pWiresRear = piece('wires', ru, V()); // the drive leads' tails, which swing with the motor
  const wire = (pts: [number, number, number][], mat: () => THREE.MeshStandardMaterial, circuit: Circuit, dir: 1 | -1, r = 0.065, parent: Piece = pWires) => {
    const tex = flowTex.clone(); tex.needsUpdate = true; tex.repeat.set(6, 1);
    const mesh = mk(tube(v3(pts), r, 60, 6), () => { const mt = mat(); mt.emissive = new THREE.Color(0xffd27a); mt.emissiveMap = tex; mt.emissiveIntensity = 0; return mt; }, 'wires', { cast: false });
    parent.add(mesh); wires.push({ mesh, tex, circuit, dir });
  };
  // battery: from the plug's mate up through the bay floor to the board
  for (const [dz, m, dir] of [[0.08, MAT.redWire, 1], [-0.08, MAT.blackWire, -1]] as const)
    wire([[-2.55, CHASSIS.clearance + 0.45, 0.9 + dz], [-2.9, 3.5, 1.0 + dz], [-2.95, TUB.floor + 0.15, 0.8 + dz], [-0.6, TUB.floor + 0.2, 0.4 + dz], [BOARD.x - 0.8, BOARD.y + 0.05, 0.2 + dz]], m, 'batt', dir);
  // drive: from the board back to the motor's terminals in the right-hand lobe. Each lead is split where it passes
  // through the pivot boss, on the swing's axis, so the joint hardly moves (and is hidden): the tail swings with the motor
  for (const [dy, m, dir] of [[0.43, MAT.yellowWire, 1], [-0.43, MAT.blueWire, -1]] as const) {
    const joint: [number, number, number] = [PIVOT.x, PIVOT.y, 0.3 + dy * 0.3];
    wire([[BOARD.x - 0.8, BOARD.y + 0.06, 0.65 + dy * 0.3], [-1.5, TUB.floor + 0.25, 1.5 + dy * 0.3], [TUB.x0 + 0.6, TUB.floor + 0.3, 0.8 + dy * 0.3], joint], m, 'drive', dir);
    wire([joint, [-6.2, 4.95, 1.6 + dy * 0.2], [-6.9, 4.95, 2.2 + dy * 0.2], [MOTOR.x + 0.3, MOTOR.y + 1.0, MOTOR_Z + 2.45], [MOTOR.x, MOTOR.y + dy, MOTOR_Z + 2.65]], m, 'drive', dir, 0.065, pWiresRear);
  }
  // steering: board to the steering motor
  for (const [dz, m, dir] of [[0.12, MAT.redWire, 1], [-0.12, MAT.blackWire, -1]] as const)
    wire([[BOARD.x + 0.8, BOARD.y + 0.06, 0.4 + dz], [RACK.x - 2.0, RACK.y + 1.5, 0.3 + dz], [RACK.x - 1.57, RACK.y + 1.25, dz]], m, 'steer', dir, 0.05);
  // lights: red lead from the board, out through the lid's hole, up the rear-right pillar and under the roof to the bar
  wire([[BOARD.x - 0.5, BOARD.y + 0.08, 0.9], [-0.4, LID_TOP - 0.2, 0.4], [-1.0, LID_TOP + 0.2, 0.3], [-2.7, LID_TOP + 0.5, 1.9], [ROOF.rearX + 0.2, 7.0, 1.95],
    [ROOF.rearX + 0.2, 8.3, 1.75], [ROOF.rearX + 0.3, ROOF.top - 0.3, 1.0], [-1.0, ROOF.top - 0.3, 1.0], [LIGHT_BAR.x - 0.4, LB.y + 0.1, 0.9]], MAT.redWire, 'light', 1, 0.05);

  recordBases();

  /* ---- Decals (blue car), drawn once the display font is ready ---- */
  const decalsReady = fontsReady.then(() => {
    const W = '#e6f0f6';
    const INK = '#0b111c'; // near-black on the blue
    const big08 = textTex('08', { w: 256, h: 200, size: 190, color: INK, italic: false }); // upright and rounded (photos 15, 17)
    const roofShuttle = textTex('SHUTTLE', { w: 512, h: 96, size: 78, color: W });
    const hoodShuttle = textTex('SHUTTLE', { size: 100, color: W, letter: 3 });
    const pod08 = textTex('08', { w: 256, h: 200, size: 190, color: INK, italic: false });
    const podShuttle = textTex('SHUTTLE', { size: 96, color: W, letter: 2 });
    // the WILD ROAD frame: nearly a rectangle, upright front and rear edges, a flat top and a level lower edge with a
    // short chamfer at its lower rear corner where the pod's cut begins (photos 12, 22), the words in its rear half.
    // The canvas runs along the words (up the left pod, down the right one) and from the frame's front (its top row)
    // to its rear.
    const wildFrame = (s: number) => canvasTex(512, 300, (g, w, h) => {
      // a bold stroke (about 1.7 mm, photos 12, 22, 26, 30), kept inside the decal's edges
      const cu = (y: number) => (s < 0 ? y - WILD.y0 : WILD.top - y) / (WILD.top - WILD.y0) * w, cv = (x: number) => ((WILD.x0 - x) / (WILD.x0 - WILD.x1)) * h, e = 0.1;
      const corners: P2[] = [[WILD.x0 - e, wildBottom(WILD.x0 - e) + e], [WILD.x0 - e, WILD.top - e], [WILD.x1 + e, WILD.top - e], [WILD.x1 + e, wildBottom(WILD.x1 + e) + e], [POD.cutX, wildBottom(POD.cutX) + e]];
      g.strokeStyle = W; g.lineWidth = 36; g.lineJoin = 'miter'; g.beginPath();
      corners.forEach(([x, y], i) => (i ? g.lineTo(cu(y), cv(x)) : g.moveTo(cu(y), cv(x)))); g.closePath(); g.stroke();
      // big bold letters running about 80% of the frame's length behind its middle, drawn tall (9 letters on a short frame)
      const xt = lerp(WILD.x0, WILD.x1, 0.66), a = cu(wildBottom(xt) + 0.22), b = cu(WILD.top - 0.24), tall = 1.5;
      g.fillStyle = g.strokeStyle = W; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 700 100px "Chakra Petch","Arial Black",sans-serif';
      const fit = (0.94 * Math.abs(b - a)) / g.measureText('WILD ROAD').width, size = Math.floor(100 * fit);
      g.font = `italic 700 ${size}px "Chakra Petch","Arial Black",sans-serif`; g.lineWidth = size * 0.09; g.lineJoin = 'round';
      g.save(); g.translate((a + b) / 2, cv(xt)); g.scale(1, tall); g.fillText('WILD ROAD', 0, 0); g.strokeText('WILD ROAD', 0, 0); g.restore();
    });
    // bold, about 0.65 tall across the chord and 45% of the span (photos 15, 23): drawn a little tall, outlined in its own colour
    const wingText = textTex('WILD ROAD', { w: 1024, h: 184, size: 140, letter: 3, color: W, stroke: W });
    const stripe = canvasTex(16, 16, (g, w, h) => { g.fillStyle = W; g.fillRect(0, 0, w, h); });
    const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1), NX = V(-1, 0, 0), NZ = V(0, 0, -1), NY = V(0, -1, 0);
    // roof and wing read from the front; the hood reads from the left side, front to rear
    const ROOF_MID = (ROOF.frontX + ROOF.rearX) / 2;
    sticker(pBody, 'body', roofShuttle, 1.7, 0.32, V(ROOF_MID + 0.8, ROOF.top + 0.03, 0), NZ, NX); // above the plate's bevel
    sticker(pBody, 'body', big08, 2.0, 1.55, V(ROOF_MID - 0.3, ROOF.top + 0.03, 0), NZ, NX, undefined, INK_VINYL);
    const onHood = (p: THREE.Vector3) => { p.y = surfHood(p.x, p.z) + 0.012; };
    sticker(pBody, 'body', hoodShuttle, 3.4, 0.85, V(4.6, 0, 0), NX, Z, onHood);
    sticker(pBody, 'body', stripe, HOOD.tipX - 0.75 - 6.35, 0.07, V((6.35 + HOOD.tipX - 0.75) / 2, 0, 0), NX, Z, onHood);
    for (const s of SIDES) {
      const onSide = (p: THREE.Vector3) => { p.z = s * (podZ(p.x, p.y) + 0.012); };
      const along = s < 0 ? NX : X; // reading direction as seen from that side
      // sized from photo 12: the '08' about 1.5 × 0.85 just behind the pod's front, SHUTTLE ending just behind it
      sticker(pBody, 'body', pod08, 1.7, 1.3, V(2.15, 4.62, 0), along, Y, onSide, INK_VINYL);
      sticker(pBody, 'body', podShuttle, 2.2, 0.56, V(0.4, 5.05, 0), along, Y, onSide);
      sticker(pBody, 'body', wildFrame(s), WILD.top - WILD.y0, WILD.x0 - WILD.x1, V((WILD.x0 + WILD.x1) / 2, (WILD.top + WILD.y0) / 2, 0), s < 0 ? Y : NY, X, onSide); // reads bottom to top on the left
    }
    const wx = WING.trailX + 1.05 * Math.cos(WING_TILT), up = V(-Math.cos(WING_TILT), Math.sin(WING_TILT), 0); // letter tops toward the trailing edge
    sticker(wing, 'chassis', wingText, 5.2, 1.2, V(wx, WING_DECK(wx) + WING_CENTRE.lift + 0.012, 0), NZ, up);
  });

  return {
    root, sprung, rearUnit, ru,
    pieces: { chassis: pChassis, bumper: pBumper, body: pBody, lights: pLights, wing: pWing, battery: pBattery, board: pBoard, steerBox: pSteerBox, rack: pRack, motor: pMotor, gear1: pGear1, gearCase: pGearCase, wires: pWires },
    wheels, knuckles, tieRods, arms, shocks, rotor, motorCan,
    driveGears: { g1a, g1b, fg, axle },
    steerGears: { motor: sMotor, big: sBig, pinion: sPinion },
    wires, leds, ledGlows, headlight, anchors: { roof }, decalsReady,
  };
}
