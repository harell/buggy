import { describe, expect, it } from 'vitest';
import {
  BATTERY, BUMPER, CHASSIS, CORNERS, HOOD, LIGHT_BAR, OVERALL, R, RING_R, ROOF, SHOCK, SIDE_POD, TYRE_W, TZ, TZF, TZR, WB, WING, XF, XR,
} from '../src/core/dims';

/*
 * Every size here was measured from photos of real DK087 cars (research/measurements.csv). Each test allows the
 * measurement's own uncertainty, in mm, so the model can't drift away from the real car unnoticed.
 */
const mm = (cm: number) => cm * 10;
const within = (cm: number, target: number, tol: number) => {
  expect(mm(cm)).toBeGreaterThanOrEqual(target - tol);
  expect(mm(cm)).toBeLessThanOrEqual(target + tol);
};

describe('wheels and axles (measured)', () => {
  it('has the measured wheelbase, centred on the car', () => {
    within(WB, 146.5, 3);
    expect(XF - XR).toBeCloseTo(WB, 9);
    expect(XF + XR).toBeCloseTo(0, 9);
  });

  it('has 60 mm tyres, 23 mm wide, with a 33 mm grey ring on the wheel face', () => {
    within(2 * R, 60, 2);
    within(TYRE_W, 23, 2.5);
    within(2 * RING_R, 33, 1);
    expect(RING_R).toBeLessThan(R - 0.8); // the tyre sidewall shows around the ring
  });

  it('has the measured front and rear tracks, slightly wider at the back', () => {
    within(2 * TZF, 117, 3);
    within(2 * TZR, 119, 3);
    expect(TZR).toBeGreaterThanOrEqual(TZF);
    expect(TZ).toBeCloseTo((TZF + TZR) / 2, 9);
  });

  it('puts each wheel at its own track', () => {
    for (const c of CORNERS) expect(Math.abs(c.z)).toBe(c.front ? TZF : TZR);
  });
});

describe('overall size (measured)', () => {
  it('is 141.5 mm wide outside the tyres', () => within(OVERALL.width, 141.5, 3));
  it('is 234 mm from bumper to wing tip', () => within(OVERALL.length, 234, 9));
  it('is 93 mm tall to the top of the wing', () => within(OVERALL.height, 93, 3));

  it('derives the overall size from the parts, so they stay consistent', () => {
    expect(OVERALL.width).toBeCloseTo(2 * TZR + TYRE_W, 9);
    expect(OVERALL.length).toBeCloseTo(BUMPER.faceX - WING.trailX, 9);
    expect(OVERALL.height).toBeCloseTo(WING.top, 9);
  });
});

describe('body (measured)', () => {
  it('puts the bumper face 40-43 mm ahead of the front axle and ahead of the hood tip', () => {
    within(BUMPER.faceX - XF, 41.5, 2);
    expect(BUMPER.faceX).toBeGreaterThan(HOOD.tipX);
    within(BUMPER.faceX - HOOD.tipX, 16, 6);
  });

  it('has a narrow bumper plate with a wider tubular hoop behind it', () => {
    within(BUMPER.plateW, 44, 4);
    within(BUMPER.hoopW, 66, 6);
    within(BUMPER.top - BUMPER.bottom, 20, 4);
  });

  it('has only the narrow hood at the front axle', () => {
    within(HOOD.wAtFrontAxle, 40, 6);
    within(HOOD.topAtFrontAxle, 56.5, 4);
    within(HOOD.tipX - XF, 28.7, 4);
  });

  it('has side pods 78 mm across at the cockpit, widest near the back', () => {
    within(SIDE_POD.wCockpit, 78, 4);
    within(SIDE_POD.wMax, 84.5, 4);
    within(SIDE_POD.wMaxX - XR, 42.5, 8); // 35-50 mm ahead of the rear axle
    within(XF - SIDE_POD.rearX, 120, 6); // painted panel ends 119-121 mm behind the front axle
    within(HOOD.tipX - SIDE_POD.rearX, 149, 6); // painted body length
  });

  it('keeps the pods clear of the tyres', () => {
    expect(SIDE_POD.wMax / 2).toBeLessThan(TZR - TYRE_W / 2 - 0.2);
    expect(HOOD.wAtFrontAxle / 2).toBeLessThan(TZF - TYRE_W / 2 - 0.2);
  });

  it('has the roof 92 mm up, just below the wing endplates', () => {
    within(ROOF.top, 92, 3);
    expect(ROOF.top).toBeLessThan(WING.top);
    expect(WING.top - ROOF.top).toBeLessThanOrEqual(0.3);
  });

  it('has a 90 mm wing with a 33 mm chord, its tip 39-43 mm behind the rear axle', () => {
    within(WING.span, 90, 3);
    within(WING.chord, 33, 5);
    within(XR - WING.trailX, 41, 2);
    expect(WING.span).toBeLessThan(OVERALL.width);
  });

  it('has three LEDs in a bar about 30 mm wide', () => {
    expect(LIGHT_BAR.leds).toBe(3);
    within(LIGHT_BAR.w, 30, 4);
    within(LIGHT_BAR.pitch, 9.3, 1);
    within(2 * LIGHT_BAR.lensR, 5, 1);
    expect((LIGHT_BAR.leds - 1) * LIGHT_BAR.pitch + 2 * LIGHT_BAR.lensR).toBeLessThan(LIGHT_BAR.w);
  });

  it('rides 25 mm off the ground under the chassis tub', () => within(CHASSIS.clearance, 25, 5));
});

describe('suspension and battery (measured)', () => {
  it('has springs of about 9 coils on shocks about 36 mm long at full droop', () => {
    expect(SHOCK.coils).toBeGreaterThanOrEqual(8);
    expect(SHOCK.coils).toBeLessThanOrEqual(10);
    within(SHOCK.extended, 36, 5);
  });

  it('carries one 14500 cell crosswise in a 56 x 65 mm bay', () => {
    within(2 * BATTERY.r, 14, 0.5);
    within(BATTERY.len, 51, 2);
    within(BATTERY.bayW, 56, 4);
    within(BATTERY.bayL, 65, 4);
    expect(BATTERY.len).toBeLessThan(BATTERY.bayW); // it lies across the car
    expect(BATTERY.bayW).toBeLessThan(2 * TZF - TYRE_W);
  });
});
