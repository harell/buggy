import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { R, XR, type Corner } from '../core/dims';
import { AXLE, G1, MOTOR } from '../core/gears';
import { rng, TAU } from '../core/math';
import {
  armGeo, box, cylX, cylZ, DOWN, extrudeTop, extrudeXY, gearGeo, interpStations, loft, put, roundRectPts, section, springGeo, tube, V, type P2,
} from './geometry';
import { MAT, mk, piece, recordBases, type PartMesh, type Piece } from './parts';
import { canvasTex, decal, fontsReady, textTex } from './textures';

export interface Wheel { outer: Piece; spin: THREE.Group; side: -1 | 1; front: boolean; center: THREE.Vector3 }
export interface Shock { group: Piece; update(top: THREE.Vector3, bottom: THREE.Vector3): void }
export interface TieRod { group: Piece; end: PartMesh }
export interface Arm { side: -1 | 1; lower: Piece; upper: Piece }
export type Circuit = 'batt' | 'drive' | 'steer' | 'light';
export interface Wire { mesh: PartMesh; tex: THREE.Texture; circuit: Circuit; dir: 1 | -1 }

export interface Car {
  root: THREE.Group;
  sprung: THREE.Group;
  rearUnit: THREE.Group;
  ru: THREE.Group;
  pieces: Record<'chassis' | 'shell' | 'cage' | 'lights' | 'wing' | 'battery' | 'board' | 'steerBox' | 'rack' | 'motor' | 'gear1' | 'gearCase' | 'wires', Piece>;
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
  anchors: { cage: PartMesh };
  decalsReady: Promise<void>;
}

/* Fixed points of the chassis, in car coordinates (cm). */
export const PIVOT = V(-2.6, 3.0, 0); // rear drive unit swings here
export const ANT_TIP = V(1.45, 8.15, -2.8);
export const FRONT_PIVOT = { lower: (s: number) => V(7.5, 2.75, s * 2.3), upper: (s: number) => V(7.5, 4.45, s * 2.45) };
export const FRONT_SHOCK_TOP = (s: number) => V(8.6, 5.95, s * 3.2);
export const REAR_SHOCK_TOP = (s: number) => V(-6.1, 7.0, s * 3.8);
export const REAR_SHOCK_LOW = (s: number) => V(-7.0, 4.1, s * 3.8); // on the swinging unit
export const RACK_END = (s: number, travel: number) => V(6.41, 3.65, s * 2.45 + travel);

const HOOD = [ // x, half-width bottom, half-width top, y bottom, y top
  [10.6, 2.2, 1.6, 3.7, 4.35], [10.2, 2.95, 2.3, 3.4, 4.65], [8.5, 3.5, 2.75, 3.2, 5.1], [6.0, 3.8, 2.95, 3.1, 5.6], [3.5, 3.9, 3.05, 3.1, 6.0], [2.0, 3.9, 3.1, 3.1, 6.15]];
const DECK = [
  [-2.8, 4.0, 3.2, 3.1, 6.0], [-4.6, 4.0, 3.3, 3.1, 6.35], [-5.4, 3.25, 2.8, 3.2, 6.4], [-8.6, 3.1, 2.6, 3.4, 6.0], [-9.8, 2.6, 2.0, 4.0, 5.3]];
const shellOf = (defs: number[][]) => loft(defs.map(([x, a, b, c, d]) => ({ x, pts: section(0, a, b, c, d, 5) })));
const v3 = (pts: [number, number, number][]) => pts.map((p) => V(...p));
const SIDES = [-1, 1] as const;

export function buildCar(scene: THREE.Scene): Car {
  const root = new THREE.Group(); scene.add(root);
  const sprung = new THREE.Group(); root.add(sprung);

  /* ---- Chassis (frame) ---- */
  const pChassis = piece('chassis', sprung, V(0, -0.4, 0));
  {
    const out: P2[] = [[10.2, -1.6], [8.6, -2.4], [5.0, -2.8], [3.6, -3.5], [-3.0, -3.5], [-4.4, -3.0], [-9.3, -3.0], [-9.9, -2.2], [-9.9, 2.2], [-9.3, 3.0], [-4.4, 3.0], [-3.0, 3.5], [3.6, 3.5], [5.0, 2.8], [8.6, 2.4], [10.2, 1.6]];
    pChassis.add(put(mk(extrudeTop(out, 0.45), MAT.black, 'chassis'), 0, 1.75, 0));
    for (const s of SIDES) {
      pChassis.add(put(mk(box(6.6, 1.6, 0.22), MAT.black, 'chassis'), 0.3, 3.05, s * 1.25)); // battery bay walls
      pChassis.add(put(mk(box(1.0, 2.1, 0.6), MAT.black, 'chassis'), 7.5, 3.95, s * 2.3)); // front towers
      pChassis.add(put(mk(cylX(0.16, 1.4, 10), MAT.steel, 'chassis'), 7.5, 2.75, s * 2.3)); // lower hinge pins
      pChassis.add(put(mk(cylX(0.14, 1.0, 10), MAT.steel, 'chassis'), 7.5, 4.45, s * 2.45)); // upper hinge pins
      pChassis.add(put(mk(box(0.5, 0.5, 1.2), MAT.black, 'chassis'), 8.55, 5.55, s * 2.75)); // shock towers
      pChassis.add(put(mk(box(0.6, 1.2, 0.5), MAT.black, 'chassis'), 8.4, 4.95, s * 2.35));
      pChassis.add(put(mk(box(0.5, 1.0, 0.5), MAT.black, 'chassis'), -6.1, 6.45, s * 3.45)); // rear shock mounts
      pChassis.add(put(mk(box(0.5, 0.25, 1.0), MAT.black, 'chassis'), -6.1, 6.0, s * 3.05));
    }
    pChassis.add(put(mk(box(6.6, 1.6, 0.22), MAT.black, 'chassis'), -3.0, 3.05, 0, 0, Math.PI / 2, 0)); // bay rear wall
    pChassis.add(put(mk(box(5.0, 0.7, 4.0), MAT.black, 'chassis'), 6.5, 2.55, 0)); // front bulkhead
    pChassis.add(put(mk(cylZ(0.42, 4.6, 20), MAT.black, 'chassis'), PIVOT.x, PIVOT.y, 0)); // rear pivot boss
    for (const [x, z] of [[-1.5, 2.5], [2.5, -2.5], [-1.5, -2.5], [2.5, 2.5], [8.8, 0], [-8.6, 1.8], [-8.6, -1.8]])
      pChassis.add(put(mk(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), MAT.chrome, 'chassis'), x, 1.72, z));
    pChassis.add(put(mk(box(0.9, 0.12, 0.5), MAT.white, 'chassis'), -1.2, 1.67, 0.8)); // power switch underneath
  }

  /* ---- Body shell (blue alloy) ---- */
  const pShell = piece('body', sprung, V(0, 8, 0));
  pShell.add(mk(shellOf(HOOD), MAT.shell, 'body'));
  pShell.add(mk(shellOf(DECK), MAT.shell, 'body'));
  for (const s of SIDES) {
    pShell.add(mk(loft([2.1, 0.4, -1.2, -3.0].map((x) => ({ x, pts: section(s * 3.7, 0.38, 0.24, 3.1, 5.95, 6, 32) }))), MAT.shell, 'body'));
    pShell.add(put(mk(box(1.6, 0.9, 0.12), MAT.black, 'body', { cast: false }), -6.3, 4.7, s * 3.05, -s * 0.15, 0, 0)); // side vents
    for (let i = 0; i < 4; i++) pShell.add(put(mk(box(1.5, 0.08, 0.16), MAT.blackGloss, 'body', { cast: false }), -6.3, 4.4 + i * 0.2, s * 3.1, -s * 0.15, 0, 0));
  }
  // cockpit: floor, seat, tiny steering wheel
  pShell.add(put(mk(box(4.9, 0.2, 6.6), MAT.black, 'body'), -0.4, 5.0, 0));
  pShell.add(put(mk(extrudeXY([[-1.0, 5.1], [1.0, 5.1], [1.0, 5.65], [-0.75, 5.65], [-1.25, 7.4], [-1.85, 7.4], [-1.65, 5.1]], 2.5, 0.12), MAT.blackGloss, 'body'), -0.4, 0, 0));
  pShell.add(put(mk(new THREE.TorusGeometry(0.48, 0.07, 8, 24), MAT.black, 'body'), 1.35, 6.45, 0, 0, Math.PI / 2, 0.5));
  pShell.add(put(mk(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), MAT.black, 'body'), 1.75, 6.05, 0, 0, 0, 0.9));
  for (const [x, y, z] of [[9.0, 4.95, 1.6], [9.0, 4.95, -1.6], [-8.3, 6.1, 1.4], [-8.3, 6.1, -1.4]])
    pShell.add(put(mk(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), MAT.chrome, 'body', { cast: false }), x, y, z));

  /* ---- Roll cage + roof ---- */
  const pCage = piece('body', sprung, V(0, 13, 0));
  const add = (pts: [number, number, number][]) => pCage.add(mk(tube(v3(pts), 0.16, 64, 10), MAT.cage, 'body'));
  add([[2.0, 5.9, -3.5], [1.75, 7.6, -3.15], [1.3, 8.45, -2.6], [1.3, 8.5, 0], [1.3, 8.45, 2.6], [1.75, 7.6, 3.15], [2.0, 5.9, 3.5]]); // front hoop
  add([[-2.9, 6.0, -3.5], [-2.7, 7.7, -3.15], [-2.4, 8.45, -2.6], [-2.4, 8.5, 0], [-2.4, 8.45, 2.6], [-2.7, 7.7, 3.15], [-2.9, 6.0, 3.5]]); // main hoop
  for (const s of SIDES) {
    add([[1.3, 8.45, s * 2.6], [-0.5, 8.5, s * 2.62], [-2.4, 8.45, s * 2.6]]); // roof rails
    add([[1.5, 8.3, s * 2.75], [4.0, 6.95, s * 3.0], [6.6, 6.1, s * 2.95], [8.45, 5.75, s * 2.8]]); // A-pillars to the shock towers
    add([[-2.4, 8.35, s * 2.4], [-4.6, 7.5, s * 2.45], [-6.1, 6.85, s * 3.1], [-7.6, 6.3, s * 2.3]]); // rear stays
    add([[2.0, 6.35, s * 3.78], [-0.5, 6.6, s * 4.05], [-2.9, 6.4, s * 3.78]]); // side bars
  }
  add([[-2.5, 8.1, -2.4], [-2.75, 6.6, 0], [-2.5, 8.1, 2.4]]); // seat brace
  const roof = put(mk(extrudeTop(roundRectPts(-2.75, -2.9, 1.7, 2.9, 0.5), 0.22, 0.06), MAT.shell, 'body'), 0, 8.6, 0);
  pCage.add(roof);

  /* ---- Light pod ---- */
  const pLights = piece('lights', sprung, V(3, 13.4, 0));
  const leds: PartMesh[] = [], ledGlows: THREE.Sprite[] = [];
  pLights.add(mk(extrudeXY([[1.05, 8.35], [1.95, 8.35], [2.15, 8.7], [1.95, 9.2], [1.05, 9.2]], 4.0, 0.08), MAT.blackGloss, 'lights'));
  const glowTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,.55)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  for (const z of [-1.25, 0, 1.25]) {
    pLights.add(put(mk(new THREE.TorusGeometry(0.33, 0.07, 8, 24), MAT.chrome, 'lights'), 2.17, 8.78, z, 0, Math.PI / 2, 0));
    const lens = put(mk(cylX(0.3, 0.12, 20), MAT.led, 'lights', { led: true }), 2.17, 8.78, z);
    pLights.add(lens); leds.push(lens);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    spr.position.set(2.45, 8.78, z); spr.scale.set(2.2, 2.2, 1);
    pLights.add(spr); ledGlows.push(spr);
  }
  const headlight = new THREE.SpotLight(0xfff3d6, 0, 140, 0.42, 0.6, 0);
  headlight.position.set(2.3, 8.8, 0); pLights.add(headlight);
  const hlTarget = new THREE.Object3D(); hlTarget.position.set(40, -6, 0); pLights.add(hlTarget); headlight.target = hlTarget;

  /* ---- Rear wing ---- */
  const pWing = piece('body', sprung, V(-4, 10, 0));
  const wingPivot = new THREE.Group(); wingPivot.position.set(-10.6, 9.0, 0); wingPivot.rotation.z = -0.12; pWing.add(wingPivot);
  const wingInner = new THREE.Group(); wingInner.position.set(10.6, -9.0, 0); wingPivot.add(wingInner);
  wingInner.add(put(mk(extrudeTop(roundRectPts(-12.25, -4.75, -9.0, 4.75, 0.35), 0.18, 0.05), MAT.blackGloss, 'body'), 0, 9.0, 0));
  wingInner.add(put(mk(box(0.12, 0.5, 9.4), MAT.blackGloss, 'body'), -12.2, 9.38, 0));
  for (const s of SIDES) {
    wingInner.add(put(mk(extrudeXY([[-12.4, 8.5], [-8.9, 8.75], [-8.9, 9.5], [-12.0, 10.1]], 0.12, 0.03), MAT.blackGloss, 'body'), 0, 0, s * 4.8));
    pWing.add(put(mk(extrudeXY([[-8.0, 5.9], [-8.9, 5.9], [-10.4, 8.95], [-9.6, 8.95]], 0.28, 0.04), MAT.black, 'body'), 0, 0, s * 1.7));
  }

  /* ---- Front bumper ---- */
  const pBumper = piece('body', sprung, V(7, 0.5, 0));
  pBumper.add(mk(extrudeXY([[9.3, 1.85], [11.6, 1.9], [12.2, 2.3], [12.5, 4.3], [12.1, 4.45], [11.55, 2.75], [9.3, 2.35]], 8.6, 0.1), MAT.black, 'body'));
  for (let i = -3; i <= 3; i++) pBumper.add(put(mk(box(0.12, 1.6, 0.14), MAT.blackGloss, 'body', { cast: false }), 12.4, 3.35, i * 1.15, 0, 0, -0.2));

  /* ---- Battery ---- */
  const pBattery = piece('battery', sprung, V(0, 0.3, -10));
  {
    const label = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#2f7fd6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e5fae'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
      g.save(); g.translate(w / 2, h / 2); g.fillStyle = '#fff'; g.font = '700 46px "Chakra Petch",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('3.7V  Li-ion', 0, -26); g.font = '600 26px "Chakra Petch",sans-serif'; g.fillText('RECHARGEABLE  ⊕ →', 0, 28); g.restore();
    });
    pBattery.add(put(mk(new THREE.CylinderGeometry(0.78, 0.78, 5.6, 36), () => new THREE.MeshStandardMaterial({ map: label, roughness: 0.32 }), 'battery'), 0.3, 3.0, 0, 0, 0, -Math.PI / 2));
    pBattery.add(put(mk(cylX(0.5, 0.12, 24), MAT.steel, 'battery'), 3.15, 3.0, 0));
    pBattery.add(put(mk(cylX(0.2, 0.12, 16), MAT.steel, 'battery'), 3.25, 3.0, 0));
    pBattery.add(put(mk(cylX(0.62, 0.08, 24), MAT.steel, 'battery'), -2.55, 3.0, 0));
    pBattery.add(put(mk(box(0.55, 0.5, 0.75), MAT.white, 'battery'), 3.9, 3.35, 0)); // SM-2P plug
    pBattery.add(put(mk(box(0.4, 0.42, 0.7), MAT.white, 'battery'), 4.35, 3.35, 0));
  }

  /* ---- Receiver board (the brain) ---- */
  const pBoard = piece('board', sprung, V(0, 4.6, 0));
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
    pBoard.add(put(mk(box(3.6, 0.12, 2.8), () => new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.5 }), 'board'), 0.3, 4.15, 0));
    pBoard.add(put(mk(box(0.95, 0.16, 0.95), MAT.chip, 'board'), 0.55, 4.28, -0.35)); // receiver chip
    pBoard.add(put(mk(box(0.55, 0.13, 0.42), MAT.chip, 'board'), -0.85, 4.27, 0.65)); // MOSFETs (H-bridge)
    pBoard.add(put(mk(box(0.55, 0.13, 0.42), MAT.chip, 'board'), -0.85, 4.27, -0.15));
    pBoard.add(put(mk(box(0.32, 0.11, 0.32), MAT.chip, 'board'), 1.35, 4.26, 0.75)); // steering driver
    pBoard.add(put(mk(box(0.55, 0.22, 0.24), MAT.chrome, 'board'), 1.3, 4.32, -0.75)); // crystal
    pBoard.add(put(mk(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 18), () => new THREE.MeshStandardMaterial({ color: 0x223e8c, roughness: 0.4 }), 'board'), -1.15, 4.51, -0.85));
    pBoard.add(put(mk(box(0.16, 0.1, 0.12), () => new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2a1a, emissiveIntensity: 1.5 }), 'board', { led: true }), 1.75, 4.27, 1.1));
    pBoard.add(mk(tube([V(1.55, 4.25, -1.15), V(1.9, 5.0, -2.4), V(1.85, 6.6, -3.2), V(1.7, 7.6, -3.05), ANT_TIP.clone()], 0.045, 40, 6), MAT.blackWire, 'board')); // antenna
    pBoard.add(put(mk(extrudeTop(roundRectPts(-1.85, -1.75, 2.45, 1.75, 0.3), 1.1, 0.06), MAT.black, 'board', { cutaway: 'board' }), 0, 3.85, 0));
  }

  /* ---- Steering: motor + gears + rack, tie rods and knuckles ---- */
  const pSteerBox = piece('steering', sprung, V(4, 5.5, 0));
  pSteerBox.add(put(mk(extrudeTop(roundRectPts(4.2, -1.25, 6.15, 1.25, 0.25), 1.95, 0.05), MAT.smoke, 'steering', { cast: false }), 0, 2.95, 0));
  pSteerBox.add(put(mk(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 24), MAT.steel, 'steering'), 4.84, 4.1, 0));
  pSteerBox.add(put(mk(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 24), MAT.bell, 'steering'), 4.84, 4.8, 0));
  const sMotor = put(mk(gearGeo(6, 0.08, 0.22, { hole: 0.03 }).rotateX(-Math.PI / 2), MAT.brass, 'steering'), 4.84, 3.3, 0);
  const sBig = put(mk(gearGeo(20, 0.08, 0.22, { hole: 0.05, windows: 4 }).rotateX(-Math.PI / 2), MAT.nylon, 'steering'), 5.88, 3.3, 0);
  const sPinion = put(mk(gearGeo(8, 0.08, 0.26, { hole: 0.05 }).rotateX(-Math.PI / 2), MAT.nylon, 'steering'), 5.88, 3.65, 0);
  pSteerBox.add(sMotor, sBig, sPinion, put(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), MAT.steel, 'steering'), 5.88, 3.5, 0));

  const pRack = piece('steering', sprung, V(5.5, 3.2, 0), true);
  {
    const p = Math.PI * 0.08, teeth: THREE.BufferGeometry[] = [];
    for (let k = -9; k <= 9; k++) teeth.push(box(0.16, 0.26, p * 0.45).translate(6.2, 3.65, (k + 0.5) * p));
    pRack.add(mk(mergeGeometries(teeth)!, MAT.nylon, 'steering'));
    pRack.add(put(mk(box(0.26, 0.3, 4.9), MAT.nylon, 'steering'), 6.41, 3.65, 0));
    for (const s of SIDES) pRack.add(put(mk(new THREE.SphereGeometry(0.16, 12, 10), MAT.chrome, 'steering'), 6.41, 3.65, s * 2.45));
    const pts: THREE.Vector3[] = []; // centring spring around the rack
    for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(V(6.41 + 0.3 * Math.cos(t * TAU * 7), 3.65 + 0.3 * Math.sin(t * TAU * 7), -0.9 + t * 1.8)); }
    pRack.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.03, 5), MAT.steel, 'steering'));
  }
  const tieRods: TieRod[] = [], knuckles: Piece[] = [];
  for (const s of SIDES) {
    const tr = piece('steering', sprung, V(3, 2, s * 2.5), true);
    tr.add(mk(new THREE.CylinderGeometry(0.08, 0.08, 1, 8).translate(0, 0.5, 0), MAT.steel, 'steering'));
    const end = mk(new THREE.SphereGeometry(0.15, 10, 8), MAT.chrome, 'steering'); tr.add(end);
    tieRods.push({ group: tr, end });
    const kn = piece('steering', sprung, V(0, 0.5, s * 3.5), true);
    kn.add(mk(box(0.7, 1.5, 0.6), MAT.black, 'steering'));
    kn.add(put(mk(cylZ(0.22, 1.3, 12), MAT.steel, 'steering'), 0, 0, s * 0.6));
    kn.add(put(mk(box(1.1, 0.22, 0.3), MAT.black, 'steering'), -0.55, -0.15, -s * 0.2, 0, -s * 0.35, 0));
    knuckles.push(kn);
  }

  /* ---- Suspension: A-arms and four coil-over shocks ---- */
  const SPRING_GEO = springGeo();
  const makeShock = (ex: THREE.Vector3): Shock => {
    const g = piece('suspension', sprung, ex, true);
    const part = (geo: THREE.BufferGeometry, mat: () => THREE.MeshStandardMaterial) => { const m = mk(geo, mat, 'suspension'); g.add(m); return m; };
    part(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 20).translate(0, -0.16, 0), MAT.chrome);
    part(new THREE.CylinderGeometry(0.28, 0.28, 1.7, 20).translate(0, -1.0, 0), MAT.chrome);
    part(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 20), MAT.chrome).position.y = -0.6;
    part(new THREE.TorusGeometry(0.18, 0.07, 8, 16), MAT.black).position.y = 0.05;
    const shaft = part(new THREE.CylinderGeometry(0.09, 0.09, 1, 10).translate(0, -0.5, 0), MAT.chrome); shaft.position.y = -1.8;
    const spring = part(SPRING_GEO, MAT.spring); spring.position.y = -0.66;
    const ret = part(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20), MAT.chrome);
    const eye = part(new THREE.TorusGeometry(0.17, 0.07, 8, 16), MAT.black);
    return {
      group: g,
      update(top, bottom) {
        const d = bottom.clone().sub(top), L = d.length();
        g.position.copy(top); g.quaternion.setFromUnitVectors(DOWN, d.divideScalar(L));
        shaft.scale.y = Math.max(0.05, L - 1.8 - 0.2); spring.scale.y = Math.max(0.2, L - 0.66 - 0.42);
        ret.position.y = -(L - 0.36); eye.position.y = -L;
      },
    };
  };
  const shocks: Record<Corner, Shock> = { FL: makeShock(V(2, 4, -3.5)), FR: makeShock(V(2, 4, 3.5)), RL: makeShock(V(-2, 4.5, -3.5)), RR: makeShock(V(-2, 4.5, 3.5)) };
  const LOWER_ARM = armGeo(1.9, 0.7), UPPER_ARM = armGeo(1.0, 0.45);
  const arms: Arm[] = SIDES.map((s) => {
    const lower = piece('suspension', sprung, V(0, -0.3, s * 2.2), true); lower.add(mk(LOWER_ARM, MAT.black, 'suspension'));
    const upper = piece('suspension', sprung, V(0, 0.4, s * 2.2), true); upper.add(mk(UPPER_ARM, MAT.black, 'suspension'));
    return { side: s, lower, upper };
  });

  /* ---- Rear drive unit: motor + gearbox + axle swing together on a pivot ---- */
  const rearUnit = new THREE.Group(); rearUnit.position.copy(PIVOT); sprung.add(rearUnit);
  const ru = new THREE.Group(); ru.position.copy(PIVOT).negate(); rearUnit.add(ru);
  const pMotor = piece('motor', ru, V(0, 4, 6.5));
  const motorCan = put(mk(cylZ(1.0, 2.0, 40), () => new THREE.MeshStandardMaterial({ color: 0xc6ccd4, metalness: 0.95, roughness: 0.22 }), 'motor', { cutaway: 'motor' }), MOTOR.x, MOTOR.y, -0.85);
  pMotor.add(motorCan);
  pMotor.add(put(mk(cylZ(0.96, 0.5, 36), MAT.bell, 'motor', { cutaway: 'motor' }), MOTOR.x, MOTOR.y, 0.4));
  pMotor.add(put(mk(cylZ(0.3, 0.18, 16), MAT.brass, 'motor'), MOTOR.x, MOTOR.y, -1.93));
  for (const dy of [-0.55, 0.55]) pMotor.add(put(mk(box(0.22, 0.3, 0.4), MAT.brass, 'motor'), MOTOR.x, MOTOR.y + dy, 0.78));
  for (const [start, color] of [[0.35, 0xc8473d], [Math.PI + 0.35, 0x3f6fcf]] as const) { // magnets, N red and S blue
    const mag = mk(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 24, 1, true, start, Math.PI - 0.7).rotateX(Math.PI / 2), () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide }), 'motor');
    pMotor.add(put(mag, MOTOR.x, MOTOR.y, -0.85));
  }
  const rotor = new THREE.Group(); rotor.position.set(MOTOR.x, MOTOR.y, 0); pMotor.add(rotor);
  rotor.add(put(mk(cylZ(0.1, 3.5, 12), MAT.steel, 'motor'), 0, 0, -0.85));
  for (let i = 0; i < 3; i++) { // three poles with copper windings
    const arm = new THREE.Group(); arm.rotation.z = (i / 3) * TAU; rotor.add(arm);
    arm.add(put(mk(box(0.62, 0.22, 1.5), MAT.steel, 'motor'), 0.31, 0, -0.85));
    arm.add(put(mk(new THREE.CylinderGeometry(0.74, 0.74, 1.5, 16, 1, false, Math.PI / 2 - 0.5, 1.0).rotateX(Math.PI / 2), MAT.steel, 'motor'), 0, 0, -0.85));
    arm.add(put(mk(box(0.4, 0.52, 1.75), MAT.copper, 'motor'), 0.36, 0, -0.85));
  }
  for (let i = 0; i < 3; i++) rotor.add(put(mk(new THREE.CylinderGeometry(0.3, 0.3, 0.36, 8, 1, false, (i / 3) * TAU + 0.12, TAU / 3 - 0.24).rotateX(Math.PI / 2), MAT.copper, 'motor'), 0, 0, 0.1)); // commutator
  rotor.add(put(mk(gearGeo(8, 0.1, 0.3, { hole: 0.04 }), MAT.brass, 'gears'), 0, 0, -2.4)); // pinion on the motor shaft
  for (const dy of [-0.42, 0.42]) pMotor.add(put(mk(box(0.16, 0.2, 0.3), () => new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6 }), 'motor'), MOTOR.x, MOTOR.y + dy, 0.12)); // brushes

  const pGear1 = piece('gears', ru, V(0, 2, -3.5));
  const pAxle = piece('gears', ru, V(0, 0, 0));
  const pGearCase = piece('gears', ru, V(-1, 3, -8.5));
  const g1a = put(mk(gearGeo(28, 0.1, 0.28, { hole: 0.06, windows: 4 }), MAT.nylon, 'gears'), G1.x, G1.y, -2.4);
  const g1b = put(mk(gearGeo(10, 0.1, 0.32, { hole: 0.06 }), MAT.nylon, 'gears'), G1.x, G1.y, -2.75);
  pGear1.add(g1a, g1b, put(mk(cylZ(0.07, 1.2, 8), MAT.steel, 'gears'), G1.x, G1.y, -2.55));
  const fg = put(mk(gearGeo(30, 0.1, 0.32, { hole: 0.17, windows: 5 }), MAT.nylonDark, 'gears'), AXLE.x, AXLE.y, -2.75);
  const axle = put(mk(cylZ(0.17, 11.2, 14), MAT.steel, 'gears'), AXLE.x, AXLE.y, 0);
  pAxle.add(fg, axle);
  pGearCase.add(mk(extrudeXY([[-9.35, 1.9], [-9.35, 4.4], [-8.4, 5.6], [-7.2, 6.35], [-5.4, 6.45], [-3.45, 5.6], [-3.45, 4.0], [-4.6, 3.2], [-6.0, 1.9]], 1.0, 0.08).translate(0, 0, -2.65), MAT.smoke, 'gears', { cast: false }));
  pGearCase.add(put(mk(cylZ(0.45, 5.8, 20), MAT.smoke, 'gears', { cast: false }), AXLE.x, AXLE.y, 1.0));
  for (const s of SIDES) {
    pGearCase.add(put(mk(box(3.4, 0.35, 0.3), MAT.black, 'suspension'), -4.4, 3.25, s * 1.9, 0, 0, -0.12)); // swing arms to the pivot
    pGearCase.add(put(mk(box(0.6, 0.6, 0.7), MAT.black, 'suspension'), -7.0, 4.0, s * 3.55)); // shock mounts
  }

  /* ---- Wheels ---- */
  const TIRE_GEO = (() => {
    const prof = [[2.35, -1.45], [2.85, -1.5], [3.12, -1.42], [3.28, -1.12], [3.32, -0.5], [3.33, 0], [3.32, 0.5], [3.28, 1.12], [3.12, 1.42], [2.85, 1.5], [2.35, 1.45]].map(([r, h]) => new THREE.Vector2(r, h));
    const parts: THREE.BufferGeometry[] = [new THREE.LatheGeometry(prof, 56)];
    const N = 20, st = TAU / N, rotX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    for (let k = 0; k < N; k++) {
      const a = k * st;
      for (const [ax, off] of [[-0.62, 0], [0.62, 0.5]]) parts.push(new THREE.BoxGeometry(0.3, 0.78, 1.05).translate(3.43, 0, 0).applyMatrix4(rotX).translate(0, ax, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(-(a + off * st))));
      for (const s of SIDES) parts.push(new THREE.BoxGeometry(0.26, 0.62, 0.5).translate(3.3, 0, 0).applyMatrix4(rotX).translate(0, s * 1.33, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(-(a + (s > 0 ? 0.5 : 0) * st))));
    }
    parts.forEach((p) => p.deleteAttribute('uv'));
    return mergeGeometries(parts)!.rotateX(Math.PI / 2);
  })();
  const lathe = (pts: number[][], seg: number) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg).rotateX(Math.PI / 2);
  const RIM_BARREL = lathe([[2.05, -1.4], [2.36, -1.42], [2.36, 1.2], [2.05, 1.2]], 40);
  const RIM_RING = lathe([[1.72, 1.28], [2.42, 1.28], [2.5, 1.42], [2.4, 1.6], [1.82, 1.6], [1.7, 1.44], [1.72, 1.28]], 48);
  const RIM_DISH = (() => {
    const s = new THREE.Shape(); s.absarc(0, 0, 1.85, 0, TAU, false);
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + 0.2, a1 = ((i + 1) / 6) * TAU - 0.2, h = new THREE.Path();
      h.absarc(0, 0, 1.55, a0, a1, false); h.absarc(0, 0, 0.62, a1, a0, true); h.closePath(); s.holes.push(h);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 24 }).translate(0, 0, 1.0);
  })();
  const makeWheel = (front: boolean, side: -1 | 1): Wheel => {
    const outer = piece('wheels', root, V(0, 0, side * 7.2), true);
    const spin = new THREE.Group(); outer.add(spin);
    spin.add(mk(TIRE_GEO, MAT.rubber, 'wheels'));
    spin.add(mk(RIM_BARREL, () => new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, side: THREE.DoubleSide }), 'wheels'));
    spin.add(mk(RIM_RING, MAT.ring, 'wheels'));
    spin.add(mk(RIM_DISH, MAT.blackGloss, 'wheels'));
    spin.add(put(mk(new THREE.CylinderGeometry(0.36, 0.36, 0.4, 6).rotateX(Math.PI / 2), MAT.chrome, 'wheels'), 0, 0, 1.42));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; spin.add(put(mk(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 8).rotateX(Math.PI / 2), MAT.chrome, 'wheels', { cast: false }), Math.cos(a) * 2.08, Math.sin(a) * 2.08, 1.63)); }
    return { outer, spin, side, front, center: V(front ? 7.5 : XR, R, side * 5.7) };
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
  const wire = (pts: [number, number, number][], mat: () => THREE.MeshStandardMaterial, circuit: Circuit, dir: 1 | -1, r = 0.065) => {
    const tex = flowTex.clone(); tex.needsUpdate = true; tex.repeat.set(6, 1);
    const mesh = mk(tube(v3(pts), r, 60, 6), () => { const mt = mat(); mt.emissive = new THREE.Color(0xffd27a); mt.emissiveMap = tex; mt.emissiveIntensity = 0; return mt; }, 'wires', { cast: false });
    pWires.add(mesh); wires.push({ mesh, tex, circuit, dir });
  };
  wire([[3.25, 3.15, 0.15], [3.7, 3.55, 0.15], [3.4, 4.3, 0.5], [2.2, 4.45, 0.6]], MAT.redWire, 'batt', 1);
  wire([[3.25, 2.85, -0.15], [3.75, 3.2, -0.2], [3.5, 4.3, -0.4], [2.2, 4.45, -0.5]], MAT.blackWire, 'batt', -1);
  wire([[-1.4, 4.35, 0.5], [-2.6, 4.7, 0.7], [-3.6, 5.25, 0.95], [MOTOR.x, MOTOR.y + 0.55, 1.0]], MAT.yellowWire, 'drive', 1);
  wire([[-1.4, 4.3, -0.2], [-2.7, 4.0, 0.4], [-3.6, 4.0, 0.95], [MOTOR.x, MOTOR.y - 0.55, 1.0]], MAT.blueWire, 'drive', -1);
  wire([[2.2, 4.4, 0.9], [3.4, 4.75, 0.5], [4.3, 5.0, 0.2], [4.84, 4.9, 0.12]], MAT.redWire, 'steer', 1, 0.05);
  wire([[2.2, 4.35, 0.75], [3.4, 4.7, 0.3], [4.3, 4.95, -0.1], [4.84, 4.9, -0.12]], MAT.blackWire, 'steer', -1, 0.05);
  wire([[1.9, 4.4, 1.3], [2.0, 5.3, 2.6], [1.95, 6.6, 3.3], [1.75, 7.7, 3.0], [1.45, 8.45, 2.2], [1.4, 8.75, 1.6]], MAT.redWire, 'light', 1, 0.05);

  recordBases();

  /* ---- Decals, drawn once the display font is ready ---- */
  const FLAT_UP: [number, number, number] = [-Math.PI / 2, 0, -Math.PI / 2];
  const decalsReady = fontsReady.then(() => {
    const shuttle = textTex('SHUTTLE', { size: 96 });
    const e08 = textTex('08', { w: 256, h: 256, size: 200, stroke: 'rgba(0,0,0,.25)' });
    const wild = textTex('WILD ROAD', { w: 1024, h: 160, size: 110, letter: 4 });
    const small08 = textTex('08', { w: 256, h: 256, size: 170 });
    for (const s of SIDES) {
      const [, hwb, hwt, yb, yt] = interpStations(HOOD, 5.6), n = V(0, hwb - hwt, s * (yt - yb)).normalize();
      decal(pShell, 'body', shuttle, 4.2, 1.05, V(5.6, (yb + yt) / 2, (s * (hwb + hwt)) / 2).addScaledVector(n, 0.05), n);
      const [, b2, t2, yb2, yt2] = interpStations(DECK, -4.0), n2 = V(0, b2 - t2, s * (yt2 - yb2)).normalize();
      decal(pShell, 'body', e08, 2.0, 2.0, V(-4.0, (yb2 + yt2) / 2 + 0.1, (s * (b2 + t2)) / 2).addScaledVector(n2, 0.05), n2);
      decal(pShell, 'body', shuttle, 2.0, 0.5, V(-1.4, 5.55, s * 4.0), V(0, 0.1, s));
    }
    decal(pCage, 'body', small08, 1.9, 1.9, V(-0.6, 8.9, 0), null, FLAT_UP);
    decal(wingInner, 'body', wild, 6.6, 1.05, V(-10.6, 9.26, 0), null, FLAT_UP);
  });

  return {
    root, sprung, rearUnit, ru,
    pieces: { chassis: pChassis, shell: pShell, cage: pCage, lights: pLights, wing: pWing, battery: pBattery, board: pBoard, steerBox: pSteerBox, rack: pRack, motor: pMotor, gear1: pGear1, gearCase: pGearCase, wires: pWires },
    wheels, knuckles, tieRods, arms, shocks, rotor, motorCan,
    driveGears: { g1a, g1b, fg, axle },
    steerGears: { motor: sMotor, big: sBig, pinion: sPinion },
    wires, leds, ledGlows, headlight, anchors: { cage: roof }, decalsReady,
  };
}
