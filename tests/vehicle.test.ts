import { describe, expect, it } from 'vitest';
import { createDrive, stepDrive, STEER_MAX, STEER_RATE, VMAX, WB, wheelWorld } from '../src/core/vehicle';

const run = (seconds: number, f: (dt: number) => void, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) f(dt); };

describe('driving', () => {
  it('spins the motor up gradually rather than jumping to full speed', () => {
    const s = createDrive();
    stepDrive(s, 1, 0, 1 / 60, false);
    expect(s.throttle).toBeGreaterThan(0);
    expect(s.throttle).toBeLessThan(0.1);
    run(2, (dt) => stepDrive(s, 1, 0, dt, false));
    expect(s.throttle).toBeGreaterThan(0.99);
    expect(s.v).toBeCloseTo(s.throttle * VMAX);
  });

  it('moves forward along +x when pointing straight', () => {
    const s = createDrive();
    run(1, (dt) => stepDrive(s, 1, 0, dt, false));
    expect(s.pose.x).toBeGreaterThan(5);
    expect(Math.abs(s.pose.z)).toBeLessThan(1e-9);
    expect(s.dist).toBeCloseTo(s.pose.x, 6);
  });

  it('backs up along -x in reverse', () => {
    const s = createDrive();
    run(1, (dt) => stepDrive(s, -1, 0, dt, false));
    expect(s.pose.x).toBeLessThan(-5);
  });

  it('limits how fast the steering motor can swing the wheels', () => {
    const s = createDrive();
    stepDrive(s, 0, 1, 0.01, false);
    expect(s.steer).toBeCloseTo(STEER_RATE * 0.01, 9);
    run(1, (dt) => stepDrive(s, 0, 1, dt, false));
    expect(s.steer).toBeCloseTo(STEER_MAX, 9);
    expect(s.steerVel).toBeCloseTo(0, 6);
  });

  it('turns left (heading up) when steering left and moving forward', () => {
    const s = createDrive();
    run(2, (dt) => stepDrive(s, 1, 1, dt, false));
    expect(s.pose.h).toBeGreaterThan(0.3);
    expect(s.pose.z).toBeLessThan(0); // left of the car is -z
  });

  it('follows the bicycle model: heading rate = v·tan(steer)/wheelbase', () => {
    const s = createDrive();
    s.throttle = 1; s.v = VMAX; s.steer = 0.3;
    const h0 = s.pose.h;
    stepDrive(s, 1, 0.3 / STEER_MAX, 0.001, false);
    expect((s.pose.h - h0) / 0.001).toBeCloseTo((VMAX * Math.tan(0.3)) / WB, 2);
  });

  it('keeps the car in place on the stand but still turns the wheels', () => {
    const s = createDrive();
    run(1, (dt) => stepDrive(s, 1, 0, dt, true));
    expect(s.pose.x).toBe(0);
    expect(s.dist).toBeGreaterThan(5);
  });

  it('returns acceleration for squat and dive', () => {
    const s = createDrive();
    const { accel } = stepDrive(s, 1, 0, 1 / 60, false);
    expect(accel).toBeGreaterThan(0);
  });

  it('places a wheel in the world from the car pose', () => {
    const [ax, az] = wheelWorld({ x: 10, z: 5, h: 0 }, 7.5, -5.7);
    expect(ax).toBeCloseTo(17.5, 9);
    expect(az).toBeCloseTo(-0.7, 9);
    const [x, z] = wheelWorld({ x: 0, z: 0, h: Math.PI / 2 }, 1, 0);
    expect(x).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(-1, 9); // facing +x then turned left 90° points at -z
  });
});
