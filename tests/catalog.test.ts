import { describe, expect, it } from 'vitest';
import { PART_INFO, PART_ORDER } from '../src/core/catalog';
import { OVERALL, R } from '../src/core/dims';
import { DRIVE_TEETH, RATIO } from '../src/core/gears';

const cm = (v: number) => `${+v.toFixed(1)}`;

describe('part catalogue', () => {
  it('has a short kid text and a grown-up note for every part', () => {
    for (const k of PART_ORDER) {
      const p = PART_INFO[k];
      expect(p.kid.length, k).toBeGreaterThan(20);
      expect(p.kid.length, k).toBeLessThanOrEqual(200); // read aloud to a young child
      expect(p.adult.length, k).toBeGreaterThan(40);
      expect(`${p.kid}${p.adult}`, k).not.toMatch(/[<&]/); // shown with innerHTML
    }
  });

  it('quotes the illustrative gear train from gears.ts', () => {
    const t = PART_INFO.gears.adult;
    expect(t).toContain(`${DRIVE_TEETH.pinion} → ${DRIVE_TEETH.g1Big}`);
    expect(t).toContain(`${DRIVE_TEETH.g1Small} → ${DRIVE_TEETH.final}`);
    expect(t).toContain(`${+RATIO.toFixed(1)} : 1`);
    expect(t).toMatch(/illustrative/);
  });

  it('says the real gearbox is solid black and how to see inside it (issue #10)', () => {
    for (const k of ['motor', 'gears'] as const) {
      const t = PART_INFO[k].adult;
      expect(t, k).toMatch(/solid black/);
      expect(t, k).toMatch(/take the car apart/i);
      expect(t, k).not.toMatch(/see-through so you can watch/);
    }
  });

  it('gives the measured sizes from dims.ts', () => {
    expect(PART_INFO.wheels.adult).toContain(`${cm(2 * R)} cm`);
    expect(PART_INFO.body.adult).toContain(`${cm(OVERALL.length)} × ${cm(OVERALL.width)} × ${cm(OVERALL.height)} cm`);
  });
});
