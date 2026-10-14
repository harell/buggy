import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { R, SHOCK, SIDE_POD, TZF, XF, XR } from '../src/core/dims';
import { AXLE, DRIVE_TEETH, G1, MODULE, MOTOR, pitchRadius } from '../src/core/gears';
import { STEER_MAX } from '../src/core/vehicle';
import { circleInPolygon, interpStations, UP, V } from '../src/model/geometry';
import {
  FRONT_PANEL, FRONT_SHOCK_LOW, LEDGE_END, FRONT_SHOCK_TOP, GEARBOX_OUTLINE, HOOD_ST, KNUCKLE, kingpinSwing, PIVOT, POD, POD_ST, podBottom, RACK_END, REAR_PANEL, REAR_SHOCK_LOW,
  REAR_SHOCK_TOP, STEER_ARM_END, surfHood, swingFor,
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

describe('body panels', () => {
  const descending = (xs: number[]) => xs.every((x, i) => i === 0 || x < xs[i - 1]);

  it('gives the hood one station per x, from the nose back to the cockpit', () => {
    expect(descending(HOOD_ST.map((r) => r[0]))).toBe(true);
  });

  it('runs each side pod from just behind the front tyre back to the B-pillar, its top sweeping up', () => {
    const xs = POD_ST.map((r) => r[0]), tops = POD_ST.map((r) => r[2]);
    expect(descending(xs)).toBe(true);
    expect(xs[0]).toBe(SIDE_POD.frontX);
    expect(xs[xs.length - 1]).toBe(SIDE_POD.rearX);
    expect(tops.every((t, i) => i === 0 || t >= tops[i - 1])).toBe(true); // never dips going back
    expect(Math.abs(tops[0] - surfHood(SIDE_POD.frontX, 0))).toBeLessThan(0.3); // low at the front, about hood height
    expect(tops[tops.length - 1]).toBeCloseTo(SIDE_POD.rearTop, 6);
  });

  it('cuts the pod\'s lower edge clear of both tyres, flat and low between them', () => {
    expect(podBottom(0)).toBe(POD.bottom);
    expect(podBottom(SIDE_POD.frontX)).toBeGreaterThan(POD.bottom + 0.5);
    expect(podBottom(SIDE_POD.rearX)).toBeGreaterThan(POD.bottom + 0.5);
    for (let x = SIDE_POD.rearX; x <= SIDE_POD.frontX; x += 0.05) {
      for (const ax of [XF, XR]) expect(Math.hypot(x - ax, podBottom(x) - R), `x = ${x.toFixed(2)}`).toBeGreaterThan(R + 0.3);
      if (x > LEDGE_END) expect(podBottom(x)).toBeLessThan(POD.ledge - 0.2); // the ledge stays above the lower edge
    }
  });

  it('runs the ledge out ahead of the WILD ROAD panel, whose lower edge rises in a straight diagonal behind it', () => {
    const insetAt = (x: number) => interpStations(POD_ST, x)[3];
    expect(insetAt(LEDGE_END)).toBe(0);
    expect(insetAt(LEDGE_END + 0.5)).toBeGreaterThan(0.2);
    // photo 12: from about (-1.9, 3.7) up to (-4.7, 5.7), following the rear tyre
    expect(podBottom(POD.cutX)).toBeCloseTo(POD.bottom, 6);
    expect(podBottom(SIDE_POD.rearX)).toBeGreaterThan(5.4);
    const mid = (POD.cutX + SIDE_POD.rearX) / 2;
    expect(podBottom(mid)).toBeCloseTo((podBottom(POD.cutX) + podBottom(SIDE_POD.rearX)) / 2, 6); // straight, not an arch
  });
});
