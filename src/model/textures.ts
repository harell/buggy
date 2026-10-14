import * as THREE from 'three';
import type { PartKey } from '../core/catalog';
import { mk, type PartMesh } from './parts';
import { V } from './geometry';

export type Draw2D = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTex(w: number, h: number, draw: Draw2D): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface TextOpts { w?: number; h?: number; size?: number; color?: string; italic?: boolean; weight?: number; stroke?: string | null; letter?: number }
export function textTex(text: string, { w = 512, h = 128, size = 92, color = '#ffffff', italic = true, weight = 700, stroke = null, letter = 0 }: TextOpts = {}): THREE.CanvasTexture {
  return canvasTex(w, h, (g) => {
    g.font = `${italic ? 'italic ' : ''}${weight} ${size}px "Chakra Petch","Arial Black",sans-serif`;
    if (letter) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letter}px`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = size * 0.12; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(text, w / 2, h / 2 + 2); }
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2);
  });
}

/** Resolves when the display font is ready (or after 2.5 s), so decals don't render in a fallback face. */
export const fontsReady: Promise<void> = Promise.race([
  document.fonts.load('italic 700 80px "Chakra Petch"').then(() => undefined),
  new Promise<void>((r) => setTimeout(r, 2500)),
]).catch(() => undefined);

/** A flat sticker. Face it along `normal`, or give an explicit rotation. */
export function decal(parent: THREE.Object3D, part: PartKey, tex: THREE.Texture, w: number, h: number, pos: THREE.Vector3, normal: THREE.Vector3 | null, rot?: [number, number, number]): PartMesh {
  const m = mk(new THREE.PlaneGeometry(w, h), () => new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }), part, { cast: false });
  m.position.copy(pos);
  if (rot) m.rotation.set(...rot);
  else if (normal) m.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(normal, V(), V(0, 1, 0)));
  parent.add(m);
  return m;
}
