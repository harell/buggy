import { describe, expect, it } from 'vitest';
import { RideMeter } from '../src/core/ride';

function feed(m: RideMeter, body: (w: number) => number, seconds = 6, still = false) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const w = 0.5 * Math.sin(2 * Math.PI * 4 * t);
    m.sample(dt, w, body(w), still);
  }
}

describe('RideMeter', () => {
  it('says the body feels ~100% when it moves with the wheel', () => {
    const m = new RideMeter(); feed(m, (w) => w);
    expect(m.feel).toBeGreaterThan(95);
  });

  it('says ~0% when the body stays still', () => {
    const m = new RideMeter(); feed(m, () => 0);
    expect(m.feel).toBeLessThan(2);
  });

  it('reports a fraction for a damped body', () => {
    const m = new RideMeter(); feed(m, (w) => w * 0.25);
    expect(m.feel).toBeGreaterThan(20);
    expect(m.feel).toBeLessThan(30);
  });

  it('reads 0% while the car is on the stand', () => {
    const m = new RideMeter(); feed(m, (w) => w, 6, true);
    expect(m.feel).toBeLessThan(1);
  });

  it('keeps a fixed-length history, oldest first', () => {
    const m = new RideMeter(10);
    for (let i = 1; i <= 25; i++) m.sample(1 / 60, i, -i, false);
    const { wheel, body } = m.series();
    expect(wheel).toHaveLength(10);
    expect(wheel[9]).toBe(25);
    expect(wheel[0]).toBe(16);
    expect(body[9]).toBe(-25);
  });
});
