import type { PartKey } from '../core/catalog';
import { FLOWS, litCount, type FlowKey } from '../core/flow';

/** The "Remote › Radio › Brain › …" strip under the car; steps light up one by one. */
export class FlowStrip {
  private key = '';
  private clock = 0;
  constructor(private el: HTMLElement, private onPick: (k: PartKey) => void) {}

  tick(dt: number, active: FlowKey[]): void {
    const key = active.join(',');
    if (key !== this.key) { this.key = key; this.render(active); }
    this.clock = active.length ? this.clock + dt : 0;
    for (const row of this.el.querySelectorAll('.flow-row')) {
      const btns = row.querySelectorAll('button'), lit = litCount(this.clock, btns.length);
      btns.forEach((b, i) => b.classList.toggle('lit', i < lit));
    }
  }

  private render(active: FlowKey[]): void {
    this.el.replaceChildren(...active.map((a) => {
      const row = document.createElement('div'); row.className = 'flow-row';
      const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = FLOWS[a].tag; row.append(tag);
      FLOWS[a].steps.forEach((s, i) => {
        if (i) { const arr = document.createElement('span'); arr.className = 'arr'; arr.textContent = '›'; row.append(arr); }
        const b = document.createElement('button'); b.textContent = s.label;
        const part = s.part;
        if (part) b.onclick = () => this.onPick(part);
        row.append(b);
      });
      return row;
    }));
  }
}
