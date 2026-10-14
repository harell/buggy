import { describe, expect, it } from 'vitest';
import { R, XR } from '../src/core/dims';
import {
  AXLE, DRIVE_TEETH, driveAngles, G1, MODULE, MOTOR, pitchRadius, RATIO,
  rackTravel, STEER_TEETH, STEER_MODULE, steerGearAngles, STEER_ARM,
} from '../src/core/gears';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('gear layout', () => {
  it('places gears so their pitch circles touch', () => {
    expect(dist(MOTOR, G1)).toBeCloseTo(pitchRadius(DRIVE_TEETH.pinion, MODULE) + pitchRadius(DRIVE_TEETH.g1Big, MODULE), 6);
    expect(dist(G1, AXLE)).toBeCloseTo(pitchRadius(DRIVE_TEETH.g1Small, MODULE) + pitchRadius(DRIVE_TEETH.final, MODULE), 6);
  });

  it('drives the rear axle at wheel-centre height', () => {
    expect(AXLE.x).toBe(XR);
    expect(AXLE.y).toBe(R);
  });

  it('sits the motor crosswise behind the rear axle, as on the real car', () => {
    expect(MOTOR.x).toBeLessThan(AXLE.x - 1.5);
    expect(G1.y).toBeGreaterThan(Math.min(MOTOR.y, AXLE.y)); // the idler gear rides above the line between them
  });

  it('keeps every gear tooth well clear of the ground', () => {
    const tip = (teeth: number) => pitchRadius(teeth, MODULE) + MODULE;
    expect(AXLE.y - tip(DRIVE_TEETH.final)).toBeGreaterThan(1.2);
    expect(G1.y - tip(DRIVE_TEETH.g1Big)).toBeGreaterThan(1.2);
    expect(MOTOR.y - tip(DRIVE_TEETH.pinion)).toBeGreaterThan(1.2);
  });

  it('reduces the motor speed about 10.5 times', () => {
    expect(RATIO).toBeCloseTo(10.5, 9);
  });
});

describe('drive train motion', () => {
  it('turns the axle exactly with the wheels', () => {
    const a = driveAngles(1.234), z = driveAngles(0);
    expect(a.axle).toBeCloseTo(1.234, 9);
    expect(a.final - z.final).toBeCloseTo(1.234, 9);
  });

  it('spins the motor 10.5 times faster than the wheels, the same way round', () => {
    const a = driveAngles(0.5), z = driveAngles(0);
    expect((a.rotor - z.rotor) / 0.5).toBeCloseTo(RATIO, 9);
  });

  it('turns the middle gear the opposite way, at pinion speed × 8/28', () => {
    const a = driveAngles(0.5), z = driveAngles(0);
    expect((a.g1 - z.g1) / (a.rotor - z.rotor)).toBeCloseTo(-8 / 28, 9);
  });

  it('starts meshed: a pinion tooth points into a gap of the big gear', () => {
    const z = driveAngles(0);
    const toward = Math.atan2(G1.y - MOTOR.y, G1.x - MOTOR.x);
    const step = (2 * Math.PI) / DRIVE_TEETH.g1Big;
    expect(z.rotor).toBeCloseTo(toward, 9);
    // gear 1's nearest tooth to the pinion sits half a tooth away from the contact line
    const rel = (((z.g1 - (toward + Math.PI)) % step) + step) % step;
    expect(rel).toBeCloseTo(step / 2, 9);
  });
});

describe('rack-and-pinion steering', () => {
  it('slides the rack by the steering arm times sin(angle)', () => {
    expect(rackTravel(0)).toBe(0);
    expect(rackTravel(0.3)).toBeCloseTo(STEER_ARM * Math.sin(0.3), 9);
  });

  it('rolls the pinion along the rack without slipping', () => {
    const s = rackTravel(0.3), g = steerGearAngles(s), g0 = steerGearAngles(0);
    expect(-(g.pinion - g0.pinion) * pitchRadius(STEER_TEETH.pinion, STEER_MODULE)).toBeCloseTo(s, 9);
  });

  it('runs the steering motor faster than the pinion, the other way round', () => {
    const g = steerGearAngles(0.4), g0 = steerGearAngles(0);
    expect((g.motor - g0.motor) / (g.pinion - g0.pinion)).toBeCloseTo(-STEER_TEETH.big / STEER_TEETH.motor, 9);
  });
});
