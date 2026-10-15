import type { RideMeter } from '../core/ride';

/** Live graph of one wheel's bumps against the body above it, plus the "body feels N%" readout. */
export class RideGraph {
  private shown = false;
  constructor(private box: HTMLElement, private canvas: HTMLCanvasElement, private feel: HTMLElement) {}

  draw(meter: RideMeter, show: boolean): void {
    if (show !== this.shown) { this.box.hidden = !show; this.box.parentElement?.classList.toggle('ride-on', show); this.shown = show; }
    if (!show) return;
    const dpr = Math.min(devicePixelRatio, 2), W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(W * dpr)) { this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr); }
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const cs = getComputedStyle(document.documentElement);
    g.strokeStyle = cs.getPropertyValue('--line').trim(); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    const scale = H / 2 / 1.2; // ±1.2 cm fills the graph
    const { wheel, body } = meter.series();
    const plot = (arr: number[], color: string, width: number) => {
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.beginPath();
      arr.forEach((v, i) => { const x = (i / (arr.length - 1)) * W, y = H / 2 - v * scale; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    };
    plot(wheel, cs.getPropertyValue('--glow').trim(), 1.5);
    plot(body, cs.getPropertyValue('--blue').trim(), 2.5);
    this.feel.textContent = `Body feels ${Math.round(meter.feel)}% of the bumps`;
  }
}
