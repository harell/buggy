import { describe, expect, it } from 'vitest';
import { bodyHeightAt, createBody, stepSuspension, type CornerBumps } from '../src/core/suspension';

const flat = (h: number): CornerBumps => ({ FL: h, FR: h, RL: h, RR: h });
const opts = { accel: 0, v: 0, steer: 0 };

/** Feed the same vertical wobble to all four wheels and measure how much the body moves. */
function bodySwing(locked: boolean, hz: number) {
  const b = createBody(), dt = 1 / 120, amp = 0.5;
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 6; t += dt) { // measure over the last 4 s, longer than one slow swell
    stepSuspension(b, flat(amp * Math.sin(2 * Math.PI * hz * t)), { ...opts, locked, dt });
    if (t > 2) { lo = Math.min(lo, b.heave); hi = Math.max(hi, b.heave); }
  }
  return (hi - lo) / (2 * amp);
}

describe('suspension', () => {
  it('locked springs bolt the body to the wheels instantly', () => {
    const b = createBody();
    stepSuspension(b, flat(0.5), { ...opts, locked: true, dt: 1 / 60 });
    expect(b.heave).toBeCloseTo(0.5, 9);
    expect(b.heaveV).toBe(0);
  });

  it('springs let the body settle onto a step instead of jumping', () => {
    const b = createBody();
    stepSuspension(b, flat(0.5), { ...opts, locked: false, dt: 1 / 60 });
    expect(b.heave).toBeLessThan(0.1);
    for (let i = 0; i < 600; i++) stepSuspension(b, flat(0.5), { ...opts, locked: false, dt: 1 / 60 });
    expect(b.heave).toBeCloseTo(0.45, 2);
  });

  it('soaks up fast gravel bumps (5 Hz) far better than locked springs', () => {
    const sprung = bodySwing(false, 5), rigid = bodySwing(true, 5);
    expect(rigid).toBeCloseTo(1, 2);
    expect(sprung).toBeLessThan(0.3);
  });

  it('still follows slow swells of the ground (0.3 Hz)', () => {
    expect(bodySwing(false, 0.3)).toBeGreaterThan(0.7);
  });

  it('tilts the nose up when the front wheels ride higher', () => {
    const b = createBody();
    stepSuspension(b, { FL: 0.6, FR: 0.6, RL: 0, RR: 0 }, { ...opts, locked: true, dt: 1 / 60 });
    expect(b.pitch).toBeGreaterThan(0);
  });

  it('dips the left side when the left wheels ride lower', () => {
    const b = createBody();
    stepSuspension(b, { FL: -0.4, FR: 0.4, RL: -0.4, RR: 0.4 }, { ...opts, locked: true, dt: 1 / 60 });
    expect(bodyHeightAt(b, 0, -5.7)).toBeLessThan(bodyHeightAt(b, 0, 5.7));
  });

  it('measures body height at a corner from heave, pitch and roll', () => {
    const b = { ...createBody(), heave: 1, pitch: 0.1, roll: 0.02 };
    expect(bodyHeightAt(b, 7.5, -5.7)).toBeCloseTo(1 + 0.75 + 0.114, 9);
  });

  it('ignores a time step that is zero or negative', () => {
    const b = createBody();
    stepSuspension(b, flat(0.5), { ...opts, locked: false, dt: -3.7 });
    stepSuspension(b, flat(0.5), { ...opts, locked: false, dt: 0 });
    expect(b).toEqual(createBody());
  });

  it('stays stable when a frame takes much longer than usual', () => {
    for (const dt of [0.1, 0.25, 1]) {
      const b = createBody();
      for (let i = 0; i < 50; i++) stepSuspension(b, flat(0.5), { ...opts, locked: false, dt });
      expect(Math.abs(b.heave - 0.45)).toBeLessThan(0.05);
      expect(Math.abs(b.pitch)).toBeLessThan(0.01);
    }
  });
});
