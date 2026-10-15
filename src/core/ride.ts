const STEP = 1 / 60;

/** Records a wheel's bumps and the body above it, and works out how much of the bumping reaches the body. */
export class RideMeter {
  /** Percentage of the wheel's vertical motion the body feels (0–100), smoothed. */
  feel = 0;
  private wheel: Float32Array;
  private body: Float32Array;
  private i = 0;
  private acc = 0;
  private prevW = 0;
  private prevB = 0;
  private vW2 = 0;
  private vB2 = 0;

  constructor(readonly size = 240) {
    this.wheel = new Float32Array(size);
    this.body = new Float32Array(size);
  }

  sample(dt: number, w: number, b: number, still: boolean): void {
    if (dt <= 0) return;
    const vw = (w - this.prevW) / dt, vb = (b - this.prevB) / dt;
    this.prevW = w; this.prevB = b;
    const a = Math.min(1, dt * 1.2);
    this.vW2 += (vw * vw - this.vW2) * a;
    this.vB2 += (vb * vb - this.vB2) * a;
    this.acc += dt;
    while (this.acc >= STEP - 1e-9) {
      this.acc -= STEP;
      this.wheel[this.i] = w; this.body[this.i] = b;
      this.i = (this.i + 1) % this.size;
    }
    const pct = still || this.vW2 < 1e-4 ? 0 : Math.min(100, Math.sqrt(this.vB2 / this.vW2) * 100);
    this.feel += (pct - this.feel) * Math.min(1, dt * 2);
  }

  /** History, oldest first. */
  series(): { wheel: number[]; body: number[] } {
    const wheel: number[] = [], body: number[] = [];
    for (let k = 0; k < this.size; k++) {
      const j = (this.i + k) % this.size;
      wheel.push(this.wheel[j]); body.push(this.body[j]);
    }
    return { wheel, body };
  }
}
