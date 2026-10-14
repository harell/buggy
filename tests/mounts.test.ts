import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { R, SHOCK, TZF, XF } from '../src/core/dims';
import { AXLE, DRIVE_TEETH, G1, MODULE, MOTOR, pitchRadius } from '../src/core/gears';
import { STEER_MAX } from '../src/core/vehicle';
import { circleInPolygon, UP, V } from '../src/model/geometry';
import {
  FRONT_PANEL, FRONT_SHOCK_LOW, FRONT_SHOCK_TOP, GEARBOX_OUTLINE, KNUCKLE, kingpinSwing, PIVOT, RACK_END, REAR_PANEL, REAR_SHOCK_LOW, REAR_SHOCK_TOP,
  STEER_ARM_END, swingFor,
} from '../src/model/mounts';

const SIDES = [-1, 1] as const;
/** A front kingpin with the wheel at ride height and pointing straight ahead. */
const kingpin = (s: number) => V(XF, R, s * (TZF - KNUCKLE.inset));

describe('suspension mounts', () => {
  it('leaves every coil-over a little shorter than full droop at ride height', () => {
    for (const s of SIDES) {
      for (const L of [FRONT_SHOCK_TOP(s).distanceTo(FRONT_SHOCK_LOW(kingpin(s), s)), REAR_SHOCK_TOP(s).distanceTo(REAR_SHOCK_LOW(s))]) {
        expect(L).toBeLessThan(SHOCK.extended - 0.1);
        expect(L).toBeGreaterThan(SHOCK.extended - 0.5);
      }
    }
  });

  it('gives each half tie rod about 3.1 cm from the rack to the steering arm', () => {
    for (const s of SIDES) expect(Math.abs(RACK_END(s, 0).distanceTo(kingpin(s).add(STEER_ARM_END(s))) - 3.1)).toBeLessThan(0.1);
  });

  it('swings a steered front wheel round its kingpin, so the stub axle stays on the wheel axis', () => {
    for (const s of SIDES) for (const steer of [-STEER_MAX, -0.2, 0, 0.2, STEER_MAX]) {
      const centre = V(XF, R, s * TZF).add(kingpinSwing(s, steer));
      const tip = kingpin(s).add(V(0, 0, s * KNUCKLE.stub).applyAxisAngle(UP, steer));
      const axis = V(0, 0, 1).applyAxisAngle(UP, steer);
      expect(tip.clone().sub(centre).cross(axis).length()).toBeLessThan(0.02);
      expect(centre.distanceTo(kingpin(s))).toBeCloseTo(KNUCKLE.inset, 6);
    }
  });

  it('swings the rear axle so it reaches the wheel height asked for', () => {
    for (const y of [R - 0.8, R, R + 0.6]) {
      const a = V(AXLE.x, AXLE.y, 0).sub(PIVOT).applyAxisAngle(new THREE.Vector3(0, 0, 1), swingFor(y)).add(PIVOT);
      expect(a.y).toBeCloseTo(y, 6);
      expect(a.x).toBeLessThan(PIVOT.x); // still behind the pivot
    }
    expect(swingFor(AXLE.y)).toBeCloseTo(0, 9);
  });
});

describe('gearbox housing', () => {
  it('keeps every drive gear inside its outline', () => {
    const tip = (teeth: number) => pitchRadius(teeth, MODULE) + 0.95 * MODULE + 0.05;
    expect(circleInPolygon([G1.x, G1.y], tip(DRIVE_TEETH.g1Big), GEARBOX_OUTLINE)).toBe(true);
    expect(circleInPolygon([AXLE.x, AXLE.y], tip(DRIVE_TEETH.final), GEARBOX_OUTLINE)).toBe(true);
    expect(circleInPolygon([MOTOR.x, MOTOR.y], tip(DRIVE_TEETH.pinion), GEARBOX_OUTLINE)).toBe(true);
  });
});

describe('perforated frame panels', () => {
  it('has every hole wholly inside its plate', () => {
    for (const p of [REAR_PANEL, FRONT_PANEL]) for (const h of p.holes) expect(circleInPolygon(h, p.hr + 0.05, p.outline), `${h}`).toBe(true);
  });

  it('lays the rear panel out as two staggered rows of 3 and the front one with 3', () => {
    const rows = new Map<number, number[]>();
    for (const [x, y] of REAR_PANEL.holes) rows.set(y, [...(rows.get(y) ?? []), x]);
    expect([...rows.values()].map((r) => r.length)).toEqual([3, 3]);
    const [a, b] = [...rows.values()].map((r) => Math.max(...r));
    expect(Math.abs(a - b)).toBeGreaterThan(REAR_PANEL.hr); // staggered
    expect(FRONT_PANEL.holes).toHaveLength(3);
  });
});
