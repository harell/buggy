import * as THREE from 'three';
import { PART_ORDER, type PartKey } from '../core/catalog';
import { COMPS, type CompKey } from '../core/components';

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
  /** Set when the mesh's component differs from its piece's, or once looked up. */
  comp?: CompKey;
}
export type PartMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material> & { userData: MeshMeta };

export interface PieceMeta { ex: THREE.Vector3; base: THREE.Vector3; dynamic: boolean; comp: CompKey }
export type Piece = THREE.Group & { userData: PieceMeta };

export interface Part { key: PartKey; meshes: PartMesh[]; pieces: Piece[] }

export const PARTS = Object.fromEntries(PART_ORDER.map((k) => [k, { key: k, meshes: [], pieces: [] }])) as unknown as Record<PartKey, Part>;
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

/** Shared see-through material for everything outside the spotlight: faint, but enough to keep the car's shape. */
export const GHOST = new THREE.MeshStandardMaterial({ color: 0x6f84a3, roughness: 1, transparent: true, opacity: 0.13, depthWrite: false });

/** What the bench shows: the components lit up (none: the whole car is solid) and the ones taken off the car. */
export interface View { spot: ReadonlySet<CompKey>; removed: ReadonlySet<CompKey> }
const NO_VIEW: View = { spot: new Set(), removed: new Set() };

/** Meshes that never cast a shadow: made with cast: false, or too small for theirs to show. */
const noShadow = new WeakSet<THREE.Object3D>();
/** Meshes shut inside a housing, whose shadow only shows while the car is taken apart or something is spotlit. */
const shutIn = new WeakSet<THREE.Object3D>();
let apart = false, view: View = NO_VIEW;

/** The component a mesh belongs to: its own, or its piece's. Meshes made after the car (decals) are found on demand. */
export function compOf(m: PartMesh): CompKey {
  if (m.userData.comp) return m.userData.comp;
  for (let n: THREE.Object3D | null = m.parent; n; n = n.parent) {
    const c = (n.userData as Partial<PieceMeta>).comp;
    if (c) return (m.userData.comp = c);
  }
  throw new Error(`mesh of ${m.userData.part} is not on any piece`);
}
const isRemoved = (m: PartMesh) => view.removed.has(compOf(m));
/** Whether a mesh is drawn solid: everything is when nothing is spotlit. */
const isSolid = (m: PartMesh) => view.spot.size === 0 || view.spot.has(compOf(m));
/**
 * A cover opened up so the spotlight can see in: see-through, and casting no shadow onto what it shows. It opens for
 * a spotlit component whose part it covers; a housing lit up on its own stays shut, so you see the housing.
 */
const cutOpen = (m: PartMesh) => {
  const cut = m.userData.cutaway;
  if (!cut || view.spot.size === 0) return false;
  const own = compOf(m);
  for (const c of view.spot) if (cut.includes(COMPS[c].part) && !(c === own && COMPS[own].housing)) return true;
  return false;
};
// with a spotlight, everything else is ghosted and the covers are open, so what is shut inside shows
const casts = (m: PartMesh) => !isRemoved(m) && isSolid(m) && !noShadow.has(m) && !cutOpen(m) && (apart || view.spot.size > 0 || !shutIn.has(m));

export interface MkOpts { cast?: boolean; receive?: boolean; cutaway?: PartKey | readonly PartKey[]; led?: boolean; comp?: CompKey }

/** Make a mesh that belongs to a part. Each mesh gets its own material so it can glow on its own. */
export function mk(geo: THREE.BufferGeometry, src: MatSource, part: PartKey, o: MkOpts = {}): PartMesh {
  const mat = typeof src === 'function' ? src() : src;
  const m = new THREE.Mesh(geo, mat) as unknown as PartMesh;
  m.castShadow = o.cast ?? true;
  if (!m.castShadow) noShadow.add(m);
  m.receiveShadow = o.receive ?? true;
  m.userData = {
    part, mat, em0: mat.emissive.clone(), emI0: mat.emissiveIntensity, op0: mat.opacity, tr0: mat.transparent, dw0: mat.depthWrite,
    cutaway: o.cutaway === undefined ? undefined : ([] as PartKey[]).concat(o.cutaway), isLed: o.led, comp: o.comp,
  };
  PARTS[part].meshes.push(m);
  allMeshes.push(m);
  return m;
}

/** A group of one component's meshes that moves out by `ex` (scaled by how far apart the car is) in the exploded view. */
export function piece(comp: CompKey, parent: THREE.Object3D, ex: THREE.Vector3, dynamic = false): Piece {
  const g = new THREE.Group() as Piece;
  g.userData = { ex, base: new THREE.Vector3(), dynamic, comp };
  parent.add(g);
  PARTS[COMPS[comp].part].pieces.push(g);
  return g;
}

/** Remember every piece's assembled position (call once the model is built). */
export function recordBases(): void {
  for (const p of Object.values(PARTS)) for (const pc of p.pieces) pc.userData.base = pc.position.clone();
}

export const exOf = (o: Piece, e: number): THREE.Vector3 => o.userData.ex.clone().multiplyScalar(e);

/** Show the bench's view: spotlit components solid and the rest ghosted, removed ones gone, covers opened. */
export function applyView(v: View): void {
  view = v;
  for (const m of allMeshes) {
    const meta = m.userData, base = meta.mat;
    m.visible = !isRemoved(m);
    m.material = isSolid(m) ? base : GHOST;
    m.castShadow = casts(m);
    if (meta.cutaway) {
      const cut = cutOpen(m);
      if (base.transparent !== (cut || meta.tr0)) base.needsUpdate = true;
      base.transparent = cut || meta.tr0;
      base.opacity = cut ? 0.2 : meta.op0;
      base.depthWrite = cut ? false : meta.dw0;
    }
  }
}
/** Whether a component is shown solid (not ghosted, not removed) in the current view. */
export const compSolid = (c: CompKey): boolean => !view.removed.has(c) && (view.spot.size === 0 || view.spot.has(c));
export const compRemoved = (c: CompKey): boolean => view.removed.has(c);

/**
 * Stop meshes casting shadows nobody would see (call once the car is built): any whose world bounding radius is
 * under `minRadius`, and the ones under `inside` (the gearbox, the motor can, the electronics tub) other than the
 * covers, whose shadow shows only while the car is apart or something is spotlit.
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

export function isShown(o: THREE.Object3D | null): boolean {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}
