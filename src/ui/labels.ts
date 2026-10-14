import * as THREE from 'three';
import { PART_ORDER, type PartKey } from '../core/catalog';
import { R } from '../core/dims';
import { resolveOverlaps } from '../core/layout';
import { isShown, PARTS } from '../model/parts';
import type { Car } from '../model/car';

interface Anchor { obj: THREE.Object3D; local: THREE.Vector3; visible: () => boolean }
interface LabelEl { el: HTMLButtonElement; x: number; y: number; live: boolean }

/**
 * Name tags over parts. Each hangs from a point fixed to a part that doesn't spin, is smoothed on
 * screen, and is laid out in a fixed order, so tags stay steady while the car moves.
 */
export class LabelLayer {
  private labels = {} as Record<PartKey, LabelEl>;
  private anchors: Record<PartKey, Anchor> | null = null;

  constructor(container: HTMLElement, onPick: (k: PartKey) => void) {
    for (const k of PART_ORDER) {
      const el = document.createElement('button');
      el.className = 'label'; el.textContent = PARTS[k].chip; el.hidden = true;
      el.onclick = () => onPick(k);
      container.append(el);
      this.labels[k] = { el, x: 0, y: 0, live: false };
    }
  }

  setSelected(sel: PartKey | null): void {
    for (const k of PART_ORDER) this.labels[k].el.classList.toggle('sel', k === sel);
  }

  /** Call after the car is posed for the first time. */
  private buildAnchors(car: Car): Record<PartKey, Anchor> {
    const top = (obj: THREE.Object3D, mesh: THREE.Object3D): Anchor => {
      const b = new THREE.Box3().setFromObject(mesh), c = b.getCenter(new THREE.Vector3());
      c.y = b.max.y + 0.4;
      return { obj, local: obj.worldToLocal(c), visible: () => true };
    };
    const p = car.pieces;
    return {
      motor: top(p.motor, car.motorCan),
      gears: top(p.gear1, p.gearCase.children[0]),
      battery: top(p.battery, p.battery.children[0]),
      board: top(p.board, p.board.children[0]),
      steering: top(p.steerBox, p.steerBox.children[0]),
      suspension: { obj: car.shocks.FR.group, local: new THREE.Vector3(0, 0.7, 0), visible: () => true },
      wheels: { obj: car.wheels.FR.outer, local: new THREE.Vector3(0, R + 0.5, 0), visible: () => true },
      lights: top(p.lights, p.lights.children[0]),
      wires: { ...top(p.wires, car.wires[2].mesh), visible: () => car.wires[0].mesh.visible },
      chassis: top(p.chassis, p.chassis.children[0]),
      body: top(p.body, car.anchors.roof),
    };
  }

  update(car: Car, camera: THREE.Camera, w: number, h: number, showAll: boolean, selected: PartKey | null, dt: number): void {
    this.anchors ??= this.buildAnchors(car);
    const smooth = 1 - Math.exp(-dt * 14);
    const order = selected ? [selected, ...PART_ORDER.filter((k) => k !== selected)] : PART_ORDER;
    const placed: { L: LabelEl; w: number; h: number }[] = [];
    for (const k of order) {
      const L = this.labels[k], A = this.anchors[k];
      const hide = () => { L.el.hidden = true; L.live = false; };
      if (!(showAll || k === selected) || !isShown(A.obj) || !A.visible()) { hide(); continue; }
      const p = A.obj.localToWorld(A.local.clone()).project(camera);
      if (p.z > 1) { hide(); continue; }
      const tx = ((p.x + 1) / 2) * w, ty = ((1 - p.y) / 2) * h;
      if (!L.live) { L.x = tx; L.y = ty; L.live = true; } else { L.x += (tx - L.x) * smooth; L.y += (ty - L.y) * smooth; }
      L.el.hidden = false;
      placed.push({ L, w: L.el.offsetWidth || 70, h: L.el.offsetHeight || 24 });
    }
    const out = resolveOverlaps(placed.map(({ L, w: bw, h: bh }) => ({ x: L.x, y: L.y, w: bw, h: bh })));
    placed.forEach(({ L }, i) => { L.el.style.transform = `translate(${Math.round(out[i].x)}px,${Math.round(out[i].y)}px) translate(-50%,-100%)`; });
  }
}
