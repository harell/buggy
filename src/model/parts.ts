import * as THREE from 'three';
import { PART_INFO, PART_ORDER, type Circuit, type PartInfo, type PartKey } from '../core/catalog';
import type { Cast } from '../core/lesson';

export type StdMat = THREE.MeshStandardMaterial;
type MatSource = StdMat | (() => StdMat);

/** What every model mesh remembers so it can be ghosted, glow, or go see-through and come back. */
export interface MeshMeta {
  part: PartKey;
  mat: StdMat;
  em0: THREE.Color;
  emI0: number;
  op0: number;
  tr0: boolean;
  dw0: boolean;
  /** The parts whose picking turns this cover see-through. */
  cutaway?: readonly PartKey[];
  isLed?: boolean;
}
export type PartMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material> & { userData: MeshMeta };

/** A group that moves out by `ex` (scaled by how far apart the car is) in the exploded view. */
export interface PieceMeta { ex: THREE.Vector3; base: THREE.Vector3; dynamic: boolean }
export type Piece = THREE.Group & { userData: PieceMeta };

export interface Part extends PartInfo { key: PartKey; meshes: PartMesh[]; pieces: Piece[] }

export const PARTS = Object.fromEntries(PART_ORDER.map((k) => [k, { key: k, ...PART_INFO[k], meshes: [], pieces: [] }])) as unknown as Record<PartKey, Part>;
export const allMeshes: PartMesh[] = [];

const std = (o: THREE.MeshStandardMaterialParameters) => () => new THREE.MeshStandardMaterial(o);
export const MAT = {
  chrome: std({ color: 0xe4e8ee, metalness: 1, roughness: 0.14 }),
  steel: std({ color: 0xaab2bd, metalness: 0.9, roughness: 0.32 }),
  brass: std({ color: 0xd1a63a, metalness: 1, roughness: 0.28 }),
  copper: std({ color: 0xc0672e, metalness: 0.9, roughness: 0.32 }),
  nylon: std({ color: 0xf1ebdc, roughness: 0.5 }),
  nylonDark: std({ color: 0x8f97a3, roughness: 0.45 }),
  bell: std({ color: 0xece6d6, roughness: 0.55 }),
  chip: std({ color: 0x15161a, roughness: 0.4 }),
  white: std({ color: 0xf4f4f2, roughness: 0.4 }),
  redWire: std({ color: 0xd3322b, roughness: 0.45 }),
  blackWire: std({ color: 0x26282c, roughness: 0.45 }),
  yellowWire: std({ color: 0xe7b416, roughness: 0.45 }),
  blueWire: std({ color: 0x2a64d6, roughness: 0.45 }),
} satisfies Record<string, () => StdMat>;

/** Shared see-through material for everything outside the focus: faint, but enough to keep the car's shape. */
export const GHOST = new THREE.MeshStandardMaterial({ color: 0x6f84a3, roughness: 1, transparent: true, opacity: 0.13, depthWrite: false });
/** The circuit each wire belongs to, so a focus can keep just its own loop solid. */
const wireCircuit = new WeakMap<THREE.Object3D, Circuit>();

/** Meshes that never cast a shadow: made with cast: false, or too small for theirs to show. */
const noShadow = new WeakSet<THREE.Object3D>();
/** Meshes shut inside a housing, whose shadow only shows while the car is taken apart or a part is in focus. */
const shutIn = new WeakSet<THREE.Object3D>();
let apart = false, focus: Cast | null = null;
/** Whether a mesh is drawn solid under the current focus (everything is, without one). */
const inFocus = (m: PartMesh) => {
  if (!focus) return true;
  if (!focus.parts.includes(m.userData.part)) return false;
  const c = wireCircuit.get(m);
  return !c || focus.circuits.includes(c);
};
/** A cover opened up for the focus: see-through, so it casts no shadow onto what it shows. */
const cutOpen = (m: PartMesh) => focus !== null && !!m.userData.cutaway?.some((k) => focus!.open.includes(k));
// with a focus, everything else is ghosted and the focus's covers are open, so what is shut inside shows
const casts = (m: PartMesh) => inFocus(m) && !noShadow.has(m) && !cutOpen(m) && (apart || focus !== null || !shutIn.has(m));

export interface MkOpts { cast?: boolean; receive?: boolean; cutaway?: PartKey | readonly PartKey[]; led?: boolean }

/** Make a mesh that belongs to a part. Each mesh gets its own material so it can glow on its own. */
export function mk(geo: THREE.BufferGeometry, src: MatSource, part: PartKey, o: MkOpts = {}): PartMesh {
  const mat = typeof src === 'function' ? src() : src;
  const m = new THREE.Mesh(geo, mat) as unknown as PartMesh;
  m.castShadow = o.cast ?? true;
  if (!m.castShadow) noShadow.add(m);
  m.receiveShadow = o.receive ?? true;
  m.userData = {
    part, mat, em0: mat.emissive.clone(), emI0: mat.emissiveIntensity, op0: mat.opacity, tr0: mat.transparent, dw0: mat.depthWrite,
    cutaway: o.cutaway === undefined ? undefined : ([] as PartKey[]).concat(o.cutaway), isLed: o.led,
  };
  PARTS[part].meshes.push(m);
  allMeshes.push(m);
  return m;
}

export function piece(part: PartKey, parent: THREE.Object3D, ex: THREE.Vector3, dynamic = false): Piece {
  const g = new THREE.Group() as Piece;
  g.userData = { ex, base: new THREE.Vector3(), dynamic };
  parent.add(g);
  PARTS[part].pieces.push(g);
  return g;
}

/** Remember every piece's assembled position (call once the model is built). */
export function recordBases(): void {
  for (const p of Object.values(PARTS)) for (const pc of p.pieces) pc.userData.base = pc.position.clone();
}

export const exOf = (o: Piece, e: number): THREE.Vector3 => o.userData.ex.clone().multiplyScalar(e);

/** Draw the cast solid (or everything when null): ghost the rest, open its covers, reset glows. */
export function applyFocus(cast: Cast | null): void {
  focus = cast;
  for (const m of allMeshes) {
    const meta = m.userData, base = meta.mat, on = inFocus(m);
    m.material = on ? base : GHOST;
    m.castShadow = casts(m);
    if (meta.cutaway) {
      const cut = cutOpen(m);
      base.transparent = cut || meta.tr0;
      base.opacity = cut ? 0.2 : meta.op0;
      base.depthWrite = cut ? false : meta.dw0;
      base.needsUpdate = true;
    }
    if (!meta.isLed) { base.emissive.copy(meta.em0); base.emissiveIntensity = meta.emI0; }
  }
}

/** Focus one part on its own, with its covers open (or the whole car when null). */
export const applyHighlight = (k: PartKey | null): void => applyFocus(k ? { parts: [k], circuits: ['batt', 'drive', 'steer', 'light'], open: [k] } : null);

/** Remember which circuit a wire belongs to (call as each wire is made). */
export function markWire(mesh: THREE.Object3D, circuit: Circuit): void { wireCircuit.set(mesh, circuit); }

/**
 * Stop meshes casting shadows nobody would see (call once the car is built): any whose world bounding radius is
 * under `minRadius`, and the ones under `inside` (the gearbox, the motor can, the electronics tub) other than the
 * covers, whose shadow shows only while the car is apart or a part is picked.
 */
export function quietShadows(minRadius: number, inside: readonly THREE.Object3D[]): void {
  for (const m of allMeshes) {
    m.updateWorldMatrix(true, false);
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    if (m.geometry.boundingSphere!.radius * m.matrixWorld.getMaxScaleOnAxis() < minRadius) noShadow.add(m);
  }
  for (const o of inside) o.traverse((m) => { if ((m as PartMesh).isMesh && !(m as PartMesh).userData.cutaway) shutIn.add(m); });
  for (const m of allMeshes) m.castShadow = casts(m);
}

/** Tell the shadows whether the car is taken apart, which lets the parts shut inside it cast again. */
export function setApart(a: boolean): void {
  if (a === apart) return;
  apart = a;
  for (const m of allMeshes) if (shutIn.has(m)) m.castShadow = casts(m);
}

const GLOW = new THREE.Color(0xff7a12);
/** Gentle orange pulse on the selected part. */
export function pulseHighlight(k: PartKey, seconds: number): void {
  if (k === 'wires') return; // wires already glow with the current
  const pulse = 0.5 + 0.5 * Math.sin(seconds * Math.PI * 2 * 0.9);
  for (const m of PARTS[k].meshes) {
    if (m.userData.isLed) continue;
    m.userData.mat.emissive.copy(GLOW);
    m.userData.mat.emissiveIntensity = 0.03 + pulse * 0.13;
  }
}

export function isShown(o: THREE.Object3D | null): boolean {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}
