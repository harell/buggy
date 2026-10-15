import { describe, expect, it } from 'vitest';
import { ASSEMBLIES, ASSEMBLY_ORDER, COMP_ORDER, COMPS } from '../src/core/components';
import { DRIVE_TEETH, RATIO } from '../src/core/gears';

describe('component catalogue', () => {
  it('puts every component in at least one assembly, and only known ones', () => {
    const listed = new Set(ASSEMBLY_ORDER.flatMap((a) => ASSEMBLIES[a].comps));
    expect([...listed].sort()).toEqual([...COMP_ORDER].sort());
    for (const a of ASSEMBLY_ORDER) expect(new Set(ASSEMBLIES[a].comps).size, a).toBe(ASSEMBLIES[a].comps.length);
  });

  it('gives each component its own name and one short line of facts, safe in HTML', () => {
    expect(new Set(COMP_ORDER.map((k) => COMPS[k].name)).size).toBe(COMP_ORDER.length);
    for (const k of COMP_ORDER) {
      const { name, spec } = COMPS[k];
      expect(spec.length, k).toBeGreaterThan(10);
      expect(spec.length, k).toBeLessThanOrEqual(110); // a tooltip, not a paragraph
      expect(`${name}${spec}`, k).not.toMatch(/[<>&"]/); // put into markup and attributes
    }
  });

  it('shows the shocks with what they work against: the frame, the arms and the swinging rear axle', () => {
    expect(ASSEMBLIES.suspension.comps).toEqual(expect.arrayContaining(['shocksF', 'shocksR', 'arms', 'gearbox']));
  });

  it('quotes the illustrative gear train from gears.ts', () => {
    const t = COMPS.gears.spec;
    expect(t).toContain(`${DRIVE_TEETH.pinion}→${DRIVE_TEETH.g1Big}`);
    expect(t).toContain(`${DRIVE_TEETH.g1Small}→${DRIVE_TEETH.final}`);
    expect(t).toContain(`${+RATIO.toFixed(1)} : 1`);
    expect(t).toMatch(/illustrative/);
  });
});
