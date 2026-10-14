import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { R, ROOF, SHOCK, SIDE_POD, TZF, TZR, TYRE_W, WING, XF, XR } from '../src/core/dims';
import { AXLE, DRIVE_TEETH, G1, MODULE, MOTOR, pitchRadius } from '../src/core/gears';
import { lerp } from '../src/core/math';
import { STEER_MAX } from '../src/core/vehicle';
import { circleInPolygon, interpStations, UP, V, type P2 } from '../src/model/geometry';
import {
  FRONT_PANEL, FRONT_SHOCK_LOW, LEDGE_END, FRONT_SHOCK_TOP, GEARBOX_OUTLINE, HOOD_ST, KNUCKLE, kingpinSwing, PIVOT, POD, POD_ST, podBottom, RACK_END, REAR_PANEL, REAR_SHOCK_LOW,
  REAR_SHOCK_TOP, STEER_ARM_END, surfHood, swingFor, TUB, WING_DECK, WING_ENDPLATE, WING_LATTICE, WING_TILT, GUARD, B_PILLAR, GEARBOX,
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

describe('rear wing (photos 14, 22, 23, 30)', () => {
  const xs = WING_ENDPLATE.map(([x]) => x), ys = WING_ENDPLATE.map(([, y]) => y);

  it('tilts the deck 10-12°, its trailing edge up, so WILD ROAD reads from the front', () => {
    expect((WING_TILT * 180) / Math.PI).toBeGreaterThanOrEqual(10);
    expect((WING_TILT * 180) / Math.PI).toBeLessThanOrEqual(12);
    expect(WING_DECK(WING.trailX)).toBeCloseTo(WING.trailY, 9);
    expect(WING_DECK(WING.trailX + WING.chord)).toBeCloseTo(WING.trailY - WING.chord * Math.tan(WING_TILT), 9);
  });

  it('has paddle endplates nearly the full chord, tilted nose-down, their top-rear corners the car\'s highest point (photos 12, 21, 22)', () => {
    const lowAt = xs[ys.indexOf(Math.min(...ys))];
    expect(Math.max(...ys)).toBeCloseTo(WING.top, 9);
    expect(xs[ys.indexOf(Math.max(...ys))]).toBeLessThan(WING.trailX + 0.5 * WING.chord); // highest at the rear
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1.6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2.0);
    expect(lowAt).toBeGreaterThan(WING.trailX + 0.5 * WING.chord); // deepest under the front half, not a scoop at the back
    /** Where a vertical line at x crosses the outline. */
    const slice = (x: number) => WING_ENDPLATE.flatMap(([ax, ay], i) => {
      const [bx, by] = WING_ENDPLATE[(i + 1) % WING_ENDPLATE.length];
      return (ax - x) * (bx - x) <= 0 && ax !== bx ? [ay + ((by - ay) * (x - ax)) / (bx - ax)] : [];
    });
    const rear = slice(WING.trailX + 0.3);
    expect(Math.max(...rear) - Math.min(...rear)).toBeLessThan(1.0); // the trailing end is a narrow paddle
    for (const x of [WING.trailX + 0.1, WING.trailX + WING.chord - 0.1]) { // and still covers both ends of the deck
      const ys = slice(x);
      expect(Math.min(...ys), `${x}`).toBeLessThan(WING_DECK(x) - 0.15);
      expect(Math.max(...ys), `${x}`).toBeGreaterThan(WING_DECK(x) + 0.05);
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(WING.trailX - 1e-9);
    expect(Math.max(...xs)).toBeLessThanOrEqual(WING.trailX + WING.chord);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.85 * WING.chord);
  });

  it('stands the lattice on the gearbox\'s top, under the deck', () => {
    for (const x of WING_LATTICE.x) {
      expect(WING_LATTICE.foot(x)).toBeGreaterThan(MOTOR.y + 0.9); // on top, not down the back
      expect(WING_LATTICE.foot(x)).toBeLessThanOrEqual(GEARBOX.top);
      for (const y of WING_LATTICE.rungs) { expect(y).toBeGreaterThan(WING_LATTICE.foot(x)); expect(y).toBeLessThan(WING_DECK(x) - 0.3); }
    }
    expect(WING_LATTICE.x[0] - WING_LATTICE.x[1]).toBeLessThan(1.5); // short and boxy
  });

  it('wraps the guard\'s rails round behind the tyres at and above their tops (photos 21, 22, 30)', () => {
    expect(GUARD.rails[0]).toBeGreaterThan(R + 1.7);
    expect(GUARD.rails[1]).toBeGreaterThan(2 * R + 0.5);
    GUARD.rails.forEach((y, i) => expect(Math.hypot(GUARD.endX[i] - XR, y - R) - R, `${y}`).toBeGreaterThan(0.4));
    expect(Math.min(...WING_ENDPLATE.map(([, y]) => y)) - GUARD.rails[1]).toBeGreaterThan(0.2); // below the endplates
  });

  it('keeps the wing clear of the body at full bump, when the rear unit swings it forward', () => {
    const swing = (x: number, y: number, ry: number) => V(x, y, 0).sub(PIVOT).applyAxisAngle(new THREE.Vector3(0, 0, 1), swingFor(ry)).add(PIVOT);
    const lead = WING.trailX + WING.chord;
    for (const ry of [R + 0.8, R - 0.8]) for (let x = WING.trailX; x <= lead; x += 0.1) {
      const p = swing(x, WING_DECK(x) - 0.1, ry);
      expect(p.x).toBeLessThan(ROOF.rearX - 1);
      const pillar = B_PILLAR(1).at(-1)!;
      if (Math.abs(p.x - pillar[0]) < 0.5) expect(p.y).toBeGreaterThan(pillar[1] + 0.3);
    }
  });

  it('keeps the lattice and its pad clear of the rear shock crossbar at full bump (bumpy road)', () => {
    const c = REAR_SHOCK_TOP(1), hx = 0.175, hy = 0.275; // the crossbar box's centre and half-size
    const toBar = (p: THREE.Vector3) => Math.hypot(Math.max(0, Math.abs(p.x - c.x) - hx), Math.max(0, Math.abs(p.y - c.y) - hy));
    /** Points round the edge of a rectangle x0..x1, y0..y1. */
    const rim = (x0: number, x1: number, y0: number, y1: number) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 20; k++) pts.push(V(lerp(x0, x1, k / 20), y0, 0), V(lerp(x0, x1, k / 20), y1, 0), V(x0, lerp(y0, y1, k / 20), 0), V(x1, lerp(y0, y1, k / 20), 0));
      return pts;
    };
    const [xf, xr] = WING_LATTICE.x, a = 0.08;
    const parts = [...WING_LATTICE.x.map((x) => rim(x - a, x + a, WING_LATTICE.foot(x), WING_DECK(x))), rim(xr - 0.25, xf + 0.25, WING_DECK(xf + 0.25) - 0.2, WING_DECK(xf + 0.25))];
    const lo = swingFor(R + 0.8), hi = swingFor(R - 0.8);
    for (let k = 0; k <= 40; k++) {
      const ang = lerp(lo, hi, k / 40);
      for (const pts of parts) for (const p of pts) {
        const q = p.clone().sub(PIVOT).applyAxisAngle(new THREE.Vector3(0, 0, 1), ang).add(PIVOT);
        expect(toBar(q), `${ang.toFixed(3)} rad at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}`).toBeGreaterThan(0.1);
      }
    }
  });

  it('keeps the endplates above the rear tyres', () => {
    for (const [x, y] of WING_ENDPLATE) expect(Math.hypot(x - XR, y - R), `${x}, ${y}`).toBeGreaterThan(R + 0.5);
  });
});

describe('rear infill behind the cockpit (issue #10)', () => {
  const xs = REAR_PANEL.outline.map(([x]) => x), ys = REAR_PANEL.outline.map(([, y]) => y);
  /** Where a rear shock's axis is, a fraction t from its top eye, with the axle at height y (it swings with the axle). */
  const shockAt = (s: number, y: number, t: number) => {
    const low = REAR_SHOCK_LOW(s).sub(PIVOT).applyAxisAngle(new THREE.Vector3(0, 0, 1), swingFor(y)).add(PIVOT);
    return REAR_SHOCK_TOP(s).lerp(low, t);
  };

  it('closes the triangle from the roof\'s rear edge back to the shock crossbar and down to the chassis', () => {
    expect(Math.max(...ys)).toBeGreaterThan(ROOF.top - 0.4); // up under the roof's rear edge
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(ROOF.rearX); // from the roof's rear edge ...
    expect(Math.min(...xs)).toBeLessThan(REAR_SHOCK_TOP(1).x + 0.5); // ... back to the crossbar ...
    expect(Math.min(...ys)).toBeLessThan(SIDE_POD.rearTop - 1); // ... and down behind the pod to the tub
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(TUB.top);
  });

  it('keeps the six holes in its upper part, above the pod', () => {
    for (const [, y] of REAR_PANEL.holes) expect(y - REAR_PANEL.hr).toBeGreaterThan(SIDE_POD.rearTop + 0.3);
  });

  /** How far a point is from a polygon: 0 inside it, else the distance to its nearest edge. */
  const distToPoly = (c: P2, poly: readonly P2[]) => {
    if (circleInPolygon(c, 1e-6, poly)) return 0;
    let d = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((c[0] - ax) * dx + (c[1] - ay) * dy) / (dx * dx + dy * dy)));
      d = Math.min(d, Math.hypot(ax + t * dx - c[0], ay + t * dy - c[1]));
    }
    return d;
  };

  it('stays clear of the rear shocks and tyres from full droop to full bump', () => {
    const shockR = 0.4; // the shock's widest part, its spring seats
    for (const s of SIDES) for (const y of [R - 0.8, R, R + 0.8]) for (let t = 0; t <= 1; t += 0.05) {
      const p = shockAt(s, y, t);
      const overlaps = distToPoly([p.x, p.y], REAR_PANEL.outline) < shockR; // in side view
      if (overlaps) expect(Math.abs(p.z) - shockR, `y ${y} t ${t.toFixed(2)}`).toBeGreaterThan(REAR_PANEL.z + 0.03);
    }
    expect(REAR_PANEL.z + 0.03).toBeLessThan(TZR - TYRE_W / 2 - 0.5); // well inboard of the rear tyres
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
