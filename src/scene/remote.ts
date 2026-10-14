import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU } from '../core/math';
import { box, put, type P2 } from '../model/geometry';

export type RemoteCtrl = 'wheel' | 'trigger' | 'lights';
/** How far the wheel turns at full lock (rad). Steering is on/off switches, so the real wheel barely moves. */
export const WHEEL_TURN = 0.45;

/** The transmitter itself, in its own space: cm, +x toward the head front, +y up from the table, +z its right side. */
export interface RemoteModel {
  root: THREE.Group;
  wheel: THREE.Group;
  trigger: THREE.Group;
  /** The '+' LIGHTING CONTROL button; it rests at z = 0 and pushes in toward -z. */
  button: THREE.Group;
  led: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  /** Where the radio rings start: inside the top of the head (the antenna is a wire in the case). */
  antennaTip: THREE.Object3D;
  /** Every mesh, so the case blocks clicks on whatever is behind it. Controls carry userData.ctrl. */
  meshes: THREE.Mesh[];
}
export interface Remote extends RemoteModel {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(w: number, h: number): void;
}

/** The control a click grabs: whatever the nearest hit belongs to, or null when that is the case or nothing. */
export function ctrlOf(hits: readonly THREE.Intersection[]): RemoteCtrl | null {
  return (hits[0]?.object.userData.ctrl as RemoteCtrl | undefined) ?? null;
}

/*
 * Version B (the one in 2025-26 buyers' photos 36-42), measured in research/: 13.4 tall to the fin,
 * 11.7 from the head front to the back of the base wheel, head 10.4 long and 4.7 tall at the front.
 * Widths were never measured; the top view (photo 40) only gives an impression.
 */
const HEAD_X = 5.85, BACK_X = -5.85;
const HW = 1.65, GW = 1.4, FW = 1.6; // half widths: head side faces, grip, foot
const WHEEL_C: P2 = [2.95, 10.9]; // 4.3 across, filling the head's front half from its chin nearly to the fin tip (photo 37)
const BASE_C: P2 = [BACK_X + 1.45, 1.45], BASE_R = 1.45; // fixed decorative wheel, 2.9 across

const mat = {
  // A dark graphite body with gunmetal panels on it (photo 36): metallic paint on plastic, so both carry a sheen.
  body: new THREE.MeshPhysicalMaterial({ color: 0x363b42, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.2, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  edge: new THREE.MeshPhysicalMaterial({ color: 0x4a5058, roughness: 0.3, metalness: 0.6, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  facet: new THREE.MeshPhysicalMaterial({ color: 0xa2a9b3, roughness: 0.22, metalness: 0.5, envMapIntensity: 1.5, clearcoat: 0.7, clearcoatRoughness: 0.2 }), // gunmetal
  pocket: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.7 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.45, metalness: 0.5 }),
  rim: new THREE.MeshPhysicalMaterial({ color: 0x7a818b, roughness: 0.36, metalness: 0.5, envMapIntensity: 1.15, clearcoat: 0.6, clearcoatRoughness: 0.25 }), // the wheel's lip, spokes, hub
  dish: new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.75 }),
  tick: new THREE.MeshStandardMaterial({ color: 0x7c828c, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  slide: new THREE.MeshStandardMaterial({ color: 0xe8461e, roughness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.3 }),
};

function shapeOf(pts: readonly P2[], smooth: boolean): THREE.Shape {
  const s = new THREE.Shape();
  if (smooth) { s.moveTo(...pts[0]); s.splineThru(pts.slice(1).concat([pts[0]]).map(([x, y]) => new THREE.Vector2(x, y))); }
  else { pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); }
  return s;
}
/**
 * A side profile (x, y) extruded across z to `thick`, with one flat chamfer of `c` all round so the edges read as
 * the moulding's facets. The chamfer cuts inward, so the outline stays where the profile puts it.
 */
function slab(pts: readonly P2[], thick: number, c: number, { smooth = false, holes = [] as readonly P2[][], cz = c } = {}): THREE.ExtrudeGeometry {
  const s = shapeOf(pts, smooth);
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const depth = thick - 2 * cz;
  // groups: 0 = the flat side faces, 1 = the edge all round (top, front, underside) and its chamfers
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: cz, bevelSize: c, bevelOffset: -c, bevelSegments: 1, curveSegments: 10 });
  return g.translate(0, 0, -depth / 2);
}
/** The mould's parting line: a hair-thin rib round the outline on z = 0 (it shows as the seam along the head top). */
const seam = (pts: readonly P2[], smooth = false) =>
  new THREE.ExtrudeGeometry(shapeOf(pts, smooth), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.018, bevelSegments: 1, curveSegments: 10 }).translate(0, 0, -0.015);
const lathe = (pts: readonly P2[], seg = 48) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg).rotateX(Math.PI / 2); // axis +z
const disc = (r: number, len: number, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2).translate(0, 0, len / 2); // z 0..len

/** A point on a circle round c at angle a (degrees), and points along an arc of it. */
const polar = ([cx, cy]: P2, r: number, a: number): P2 => [cx + r * Math.cos(THREE.MathUtils.degToRad(a)), cy + r * Math.sin(THREE.MathUtils.degToRad(a))];
const arc = (c: P2, r: number, a0: number, a1: number, n: number): P2[] => Array.from({ length: n + 1 }, (_, i) => polar(c, r, a0 + ((a1 - a0) * i) / n));

// Side profiles (x, y), traced from the right-side cutout (photo 37) and scaled to the measured height and length.
const HEAD: P2[] = [
  [-4.6, 10.2], [-3.05, 11.6], [-1.2, 12.0], [0.9, 12.45], [3.2, 12.96], // a pointed rear tip; the top falls from the wheel to it
  [4.9, 12.82], [5.55, 12.4], [HEAD_X, 11.9], [HEAD_X, 9.75], [5.62, 9.1], [5.0, 8.76], [4.2, 8.68], // front face and chin
  [1.0, 8.84], [-2.4, 9.04], [-3.4, 9.42], [-4.1, 9.74], // underside back to the tip
];
const R_FIN = 2.2; // the fins hug the wheel just outside its ribbed rim
// Swept blades nearly flush with each side face round the wheel's front (photo 36): one rising from the wheel's top to a
// sharp tip over its front, the remote's highest point (so the head is 4.7 tall at the front), with a steep leading edge
// down to the head front; and a short hooked one under its front.
const FIN_TOP: P2[] = [...arc(WHEEL_C, R_FIN, 80, 25, 8), [HEAD_X, 12.1], [5.75, 13.4]];
const FIN_LOW: P2[] = [...arc(WHEEL_C, R_FIN, -10, -52, 6), polar(WHEEL_C, 2.5, -55), polar(WHEEL_C, 2.95, -24), polar(WHEEL_C, 2.45, -8)];
const GRIP: P2[] = [
  [1.5, 9.05], [0.5, 8.25], [0.02, 7.45], [-0.06, 6.85], [0.06, 6.15], [-0.12, 5.75], [-0.38, 5.2], [-0.28, 4.55], // finger grooves
  [-0.42, 4.1], [-0.8, 3.45], [-0.82, 2.7], [-1.2, 2.2], [-4.3, 2.2], [-4.62, 3.2], [-4.5, 4.4], [-4.25, 5.5], [-3.9, 6.4], // raked about 12 degrees
  [-3.5, 7.3], [-3.05, 8.05], [-2.55, 8.95], [-0.5, 9.3],
];
const FOOT: P2[] = [[BASE_C[0], 0], [-0.6, 0.02], [3.3, 0.26], [3.74, 0.5], [3.82, 0.9], [3.55, 1.2], [1.6, 1.85], [-0.6, 2.4], [-2.6, 2.75], [BASE_C[0], 2.75]];
// A gunmetal panel on each side of the head (inside its chamfer, running into the rear tip), round a dark pocket for the
// button and LED (right) or the switch (left).
const FRAME: P2[] = [[-3.75, 10.2], [-3.5, 10.5], [-2.55, 11.1], [-2.3, 11.2], [-1.2, 11.42], [1.2, 11.9], [1.2, 9.38], [-2.3, 9.58], [-3.05, 9.86]];
const GRIP_PANEL: P2[] = [[-2.95, 8.25], [-0.75, 8.3], [-1.15, 7.3], [-3.6, 6.35], [-3.35, 7.35]]; // photo 37
const POCKET: P2[] = [[-3.1, 10.4], [-2.45, 10.85], [-0.2, 11.25], [0.9, 11.4], [0.9, 10.1], [-2.2, 10.05]]; // a band pointed at the back
const BATTERY_DOOR: P2[] = [[-3.05, 7.25], [-0.45, 7.3], [-0.75, 5.1], [-1.25, 3.4], [-4.1, 3.4], [-3.75, 5.2], [-3.4, 6.5]];

/** The press-on wheel cup (photos 36, 42): ribbed drum, flat lip, dished face with 3 spokes, a hub with 3 ticks. */
function wheelCup(ctrl: RemoteCtrl | null): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material) => { const mesh = new THREE.Mesh(geo, m); if (ctrl) mesh.userData.ctrl = ctrl; g.add(mesh); };
  add(lathe([[0.6, 0], [2.02, 0], [2.08, 0.06], [2.08, 0.76]], 64), mat.wheel); // drum
  add(lathe([[2.08, 0.76], [2.03, 0.82], [1.62, 0.82], [1.55, 0.74]], 64), mat.rim); // the lip, catching the light round the dark dish
  add(lathe([[1.55, 0.74], [1.5, 0.36], [0.6, 0.36]], 64), mat.dish);
  const ribs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 40; i++) ribs.push(box(0.1, 0.12, 0.6).translate(2.1, 0, 0.42).rotateZ((i / 40) * TAU));
  add(mergeGeometries(ribs)!, mat.wheel);
  add(mergeGeometries([-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map((a) => box(1.1, 0.52, 0.22).translate(1.05, 0, 0.46).rotateZ(a)))!, mat.rim); // spokes
  add(disc(0.8, 0.84), mat.rim); // hub
  add(disc(0.46, 0.94, 28), mat.body); // cap
  add(disc(0.22, 0.98, 16), mat.wheel);
  for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i * TAU) / 3; add(new THREE.CircleGeometry(0.1, 3).rotateZ(a).translate(Math.cos(a) * 0.63, Math.sin(a) * 0.63, 0.841), mat.tick); }
  return g;
}

/** One face of the decorative base wheel: tyre lip, five-spoke hub, centre boss. */
function baseHub(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.TorusGeometry(1.2, 0.12, 8, 40), new THREE.CylinderGeometry(0.42, 0.42, 0.16, 20).rotateX(Math.PI / 2)];
  for (let i = 0; i < 5; i++) parts.push(box(0.9, 0.18, 0.1).translate(0.7, 0, 0).rotateZ((i * TAU) / 5 + 0.3));
  return mergeGeometries(parts)!;
}

/** Builds the DK087 version B pistol-grip transmitter, without a renderer so it can be tested. */
export function buildRemote(): RemoteModel {
  const root = new THREE.Group();
  const add = <T extends THREE.Mesh>(m: T, parent: THREE.Object3D = root): T => { parent.add(m); return m; };
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, parent: THREE.Object3D = root) => add(put(new THREE.Mesh(geo, m), x, y, z), parent);

  // case: angular head, raked grip with finger grooves, long wedge foot
  const twoTone = [mat.body, mat.edge];
  mesh(slab(HEAD, 2 * HW, 0.55, { cz: 0.42 }), twoTone);
  mesh(seam(HEAD), mat.dark);
  for (const side of [1, -1]) for (const fin of [FIN_TOP, FIN_LOW]) mesh(slab(fin, 0.3, 0.08, { cz: 0.1 }), twoTone, 0, 0, side * (HW + 0.05)); // thin blades, almost flush with the side face
  mesh(slab(GRIP, 2 * GW, 0.36, { smooth: true, cz: 0.3 }), twoTone); // the glossy edge is the finger-groove strip
  mesh(seam(GRIP, true), mat.dark);
  mesh(slab(FOOT, 2 * FW, 0.22, { cz: 0.16 }), twoTone);
  for (const side of [1, -1]) {
    mesh(slab(FRAME, 0.16, 0.07, { holes: [POCKET] }), mat.facet, 0, 0, side * (HW + 0.06));
    mesh(new THREE.ShapeGeometry(shapeOf(POCKET, false)), mat.pocket, 0, 0, side * (HW + 0.002));
    mesh(box(2.2, 0.08, 0.04), mat.facet, 1.6, 1.62, side * FW).rotation.z = -0.26; // moulded strakes on the foot
    mesh(box(1.6, 0.08, 0.04), mat.facet, 1.2, 1.3, side * FW).rotation.z = -0.24;
  }
  // fender over the base wheel, and the wheel, standing a little proud of the foot so it shows on both sides
  const fender = new THREE.Shape(); fender.absarc(0, 0, 1.85, 0.45, 2.42, false); fender.absarc(0, 0, 1.46, 2.42, 0.45, true); // ends ahead of the wheel's back
  mesh(new THREE.ExtrudeGeometry(fender, { depth: 2 * GW - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelOffset: -0.1, bevelSegments: 1, curveSegments: 20 }).translate(0, 0, -GW + 0.1), twoTone, ...BASE_C);
  mesh(new THREE.CylinderGeometry(BASE_R, BASE_R, 2 * FW + 0.3, 40).rotateX(Math.PI / 2), mat.dark, ...BASE_C);
  for (const side of [1, -1]) mesh(baseHub(), mat.wheel, BASE_C[0], BASE_C[1], side * (FW + 0.17));

  // right side: wheel, '+' LIGHTING CONTROL button, red LED, a light facet high on the grip (the left has the battery door there)
  mesh(slab(GRIP_PANEL, 0.12, 0.05), mat.facet, 0, 0, GW + 0.04);
  const wheel = put(new THREE.Group(), WHEEL_C[0], WHEEL_C[1], HW); root.add(wheel);
  wheel.add(wheelCup('wheel'));
  const leftDrum = put(wheelCup(null), WHEEL_C[0], WHEEL_C[1], -HW); leftDrum.scale.z = -1; root.add(leftDrum); // matching drum; assumed not to turn
  const buttonMount = put(new THREE.Group(), -0.65, 10.7, HW); root.add(buttonMount);
  const button = new THREE.Group(); buttonMount.add(button);
  mesh(new THREE.TorusGeometry(0.48, 0.06, 8, 28), mat.facet, 0, 0, 0.04, buttonMount);
  mesh(disc(0.4, 0.22, 28), mat.body, 0, 0, 0, button);
  mesh(box(0.5, 0.1, 0.07), mat.facet, 0, 0, 0.24, button); // raised '+'
  mesh(box(0.1, 0.5, 0.07), mat.facet, 0, 0, 0.24, button);
  button.traverse((o) => { if (o instanceof THREE.Mesh) o.userData.ctrl = 'lights'; });
  const led = add(put(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff4136, emissive: 0xff2010, emissiveIntensity: 2 })), -1.5, 10.56, HW));
  mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 20), mat.facet, -1.5, 10.56, HW + 0.02);

  // left side: ON/OFF slide (ON at the front), small hole near the rear tip, battery door with one screw (2 x AA inside)
  mesh(box(0.85, 0.3, 0.04), mat.dark, -0.5, 10.6, -HW - 0.01);
  mesh(box(0.4, 0.35, 0.16), mat.slide, -0.27, 10.6, -HW - 0.05);
  mesh(new THREE.CircleGeometry(0.22, 18).rotateY(Math.PI), mat.dark, -3.25, 10.3, -HW - 0.15);
  mesh(slab(BATTERY_DOOR, 0.08, 0.03), mat.body, 0, 0, -GW - 0.02);
  mesh(disc(0.12, 0.05, 12).rotateY(Math.PI), mat.steel, -1.75, 7.0, -GW - 0.05);

  // C-ring trigger under the head front: 2.1 outside, 1.36 finger hole, open at the lower front; it pivots in the head
  const trigger = put(new THREE.Group(), 2.8, 8.75, 0); root.add(trigger);
  const ring = new THREE.Shape(); ring.absarc(0, 0, 1.05, -0.7, 4.62, false); ring.absarc(0, 0, 0.68, 4.62, -0.7, true);
  mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelOffset: -0.06, bevelSegments: 1, curveSegments: 24 }).translate(0, -1.45, -0.3), mat.edge, 0, 0, 0, trigger); // gunmetal sheen, photo 36
  for (const a of [-0.7, 4.62]) mesh(box(0.5, 0.16, 0.72), mat.edge, Math.cos(a) * 0.87, -1.45 + Math.sin(a) * 0.87, 0, trigger).rotation.z = a; // flared tips
  mesh(box(0.7, 0.6, 0.6), mat.body, 0, -0.15, 0, trigger); // stem into the head's slot
  trigger.traverse((o) => { if (o instanceof THREE.Mesh) o.userData.ctrl = 'trigger'; });

  const antennaTip = put(new THREE.Object3D(), 0.6, 12.0, 0); root.add(antennaTip); // inside the head, under its top
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
  return { root, wheel, trigger, button, led, antennaTip, meshes };
}

/** The transmitter in its card, seen from its right side with the head turned a little toward the viewer. */
export function createRemote(canvas: HTMLCanvasElement): Remote {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xeef3ff, 0x40444c, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(8, 14, 16); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc2ff, 1.2); rim.position.set(-10, 8, -6); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 200);

  const model = buildRemote();
  const stand = new THREE.Group(); stand.rotation.y = -0.38; stand.add(model.root); scene.add(stand);
  stand.updateMatrixWorld(true);
  const fit = new THREE.Box3().setFromObject(stand), mid = fit.getCenter(new THREE.Vector3()), dim = fit.getSize(new THREE.Vector3());

  return {
    ...model, renderer, scene, camera,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // fit the whole remote with a margin, leaving room for the hint and LED tag along the card's top
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = dim.z / 2 + Math.max((dim.y * 1.2) / (2 * half), (dim.x * 1.12) / (2 * half * camera.aspect));
      camera.position.set(mid.x + dist * 0.12, mid.y + dist * 0.1, mid.z + dist);
      camera.lookAt(mid.x, mid.y + dim.y * 0.05, mid.z);
      camera.updateProjectionMatrix();
    },
  };
}
