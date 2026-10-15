import * as THREE from 'three';
import { COMP_ORDER, COMPS, type CompKey } from '../core/components';
import { resolveOverlaps } from '../core/layout';
import { allMeshes, compOf, isShown, type PartMesh } from '../model/parts';

interface Anchor { obj: THREE.Object3D; local: THREE.Vector3 }
interface LabelEl { el: HTMLButtonElement; x: number; y: number; live: boolean }

/** The piece a mesh hangs from: it moves with the car but never spins, so a tag on it stays steady. */
function pieceOf(m: THREE.Object3D): THREE.Object3D {
  for (let n: THREE.Object3D | null = m; n; n = n.parent) if ((n.userData as { ex?: unknown }).ex) return n;
  return m;
}

/**
 * Name tags over components. Each hangs from a point above the component's biggest mesh on its side nearest the
 * default camera, is smoothed on screen, and is laid out in a fixed order, so tags stay steady while the car moves.
 */
export class LabelLayer {
  private labels = {} as Record<CompKey, LabelEl>;
  private anchors = new Map<CompKey, Anchor | null>();

  constructor(container: HTMLElement, onPick: (k: CompKey) => void) {
    for (const k of COMP_ORDER) {
      const el = document.createElement('button');
      el.className = 'label'; el.textContent = COMPS[k].name; el.hidden = true;
      el.onclick = () => onPick(k);
      container.append(el);
      this.labels[k] = { el, x: 0, y: 0, live: false };
    }
  }

  private anchor(k: CompKey): Anchor | null {
    if (this.anchors.has(k)) return this.anchors.get(k)!;
    let best: PartMesh | null = null, score = -Infinity;
    const c = new THREE.Vector3(), b = new THREE.Box3();
    for (const m of allMeshes) {
      if (compOf(m) !== k) continue;
      b.setFromObject(m); if (b.isEmpty()) continue;
      const s = b.getSize(c).length() + b.getCenter(c).z * 0.5; // big, and on the camera's (+z) side
      if (s > score) { score = s; best = m; }
    }
    let a: Anchor | null = null;
    if (best) {
      const obj = pieceOf(best);
      b.setFromObject(best); b.getCenter(c); c.y = b.max.y + 0.4;
      a = { obj, local: obj.worldToLocal(c.clone()) };
    }
    this.anchors.set(k, a);
    return a;
  }

  /** Draw the tags for `shown` components; `first` wins overlaps. Call after the car is posed. */
  update(camera: THREE.Camera, w: number, h: number, shown: readonly CompKey[], dt: number): void {
    const smooth = 1 - Math.exp(-dt * 14), on = new Set(shown);
    const placed: { L: LabelEl; w: number; h: number }[] = [];
    for (const k of [...shown, ...COMP_ORDER.filter((x) => !on.has(x))]) {
      const L = this.labels[k];
      const hide = () => { if (!L.el.hidden) L.el.hidden = true; L.live = false; };
      const A = on.has(k) ? this.anchor(k) : null;
      if (!A || !isShown(A.obj)) { hide(); continue; }
      const p = A.obj.localToWorld(A.local.clone()).project(camera);
      if (p.z > 1) { hide(); continue; }
      const tx = ((p.x + 1) / 2) * w, ty = ((1 - p.y) / 2) * h;
      if (!L.live) { L.x = tx; L.y = ty; L.live = true; } else { L.x += (tx - L.x) * smooth; L.y += (ty - L.y) * smooth; }
      L.el.hidden = false;
      placed.push({ L, w: L.el.offsetWidth || 90, h: L.el.offsetHeight || 24 });
    }
    const out = resolveOverlaps(placed.map(({ L, w: bw, h: bh }) => ({ x: L.x, y: L.y, w: bw, h: bh })));
    placed.forEach(({ L }, i) => { L.el.style.transform = `translate(${Math.round(out[i].x)}px,${Math.round(out[i].y)}px) translate(-50%,-100%)`; });
  }
}
