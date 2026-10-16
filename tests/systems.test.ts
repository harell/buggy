import { describe, expect, it } from 'vitest';
import { COMPS } from '../src/core/components';
import { canHide, FAMILY_ORDER, litComps, SYSTEM_ORDER, SYSTEMS, stageOf, systemComps, systemFor } from '../src/core/systems';

const ELECTRIC = ['battery', 'board', 'wires', 'lightBar'];
const MOTORS = ['motor', 'steerMotor'];

describe('systems', () => {
  it('gives every family two systems', () => {
    for (const f of FAMILY_ORDER) expect(SYSTEM_ORDER.filter((s) => SYSTEMS[s].family === f), f).toHaveLength(2);
  });

  it('uses only known components, each in one step of a system', () => {
    for (const s of SYSTEM_ORDER) {
      const cs = systemComps(s);
      for (const c of cs) expect(COMPS[c], `${s}: ${c}`).toBeDefined();
      expect(new Set(cs).size, s).toBe(cs.length);
    }
  });

  it('keeps the battery and wires out of mechanical systems, and motion out of electrical ones', () => {
    for (const s of SYSTEM_ORDER) {
      const cs = systemComps(s);
      if (SYSTEMS[s].family === 'mech') for (const c of ELECTRIC) expect(cs, s).not.toContain(c);
      if (SYSTEMS[s].family === 'elec') for (const c of cs) expect(ELECTRIC, `${s}: ${c}`).toContain(c);
      if (SYSTEMS[s].family === 'both') {
        expect(cs, s).toEqual(expect.arrayContaining(['battery', 'board', 'wires']));
        expect(cs.some((c) => MOTORS.includes(c)), s).toBe(true);
      }
    }
  });

  it('has a motor where electricity becomes spin in each electrical + mechanical chain', () => {
    for (const s of SYSTEM_ORDER.filter((k) => SYSTEMS[k].family === 'both')) {
      const st = SYSTEMS[s].stages, i = st.findIndex((x) => x.form === 'spin');
      expect(i, s).toBeGreaterThan(0);
      expect(MOTORS, s).toContain(st[i].comps[0]);
      expect(st.slice(0, i).every((x) => x.form !== 'movement'), s).toBe(true);
      expect(st.slice(i + 1).every((x) => x.form === 'movement'), s).toBe(true);
    }
  });

  it('finds the step of a component, and the system a click on it opens', () => {
    expect(stageOf('go', 'wheelsR')).toBe(SYSTEMS.go.stages.length - 1);
    expect(stageOf('go', 'wheelsF')).toBe(-1);
    expect(systemFor('battery')).toBe('go');
    expect(systemFor('shocksF')).toBe('bounce');
    expect(systemFor('lightBar')).toBe('lights');
    expect(systemFor('body')).toBeNull();
  });

  it('lights up what is not see-through, and never makes the last step see-through', () => {
    const wheels = stageOf('go', 'wheelsR');
    expect(litComps('go', new Set([wheels]))).not.toContain('wheelsR');
    expect(litComps('go', new Set())).toEqual(systemComps('go'));
    const allButOne = new Set(SYSTEMS.go.stages.map((_, i) => i).filter((i) => i !== 0));
    expect(canHide('go', allButOne, 0)).toBe(false);
    expect(canHide('go', allButOne, 1)).toBe(true); // bringing one back is always allowed
    expect(canHide('go', new Set(), 0)).toBe(true);
  });

  it('keeps names and lines short and safe in HTML', () => {
    for (const s of SYSTEM_ORDER) {
      const { name, line, question, stages, controls } = SYSTEMS[s];
      for (const t of [name, line, question, ...stages.map((x) => x.name), ...controls.map((c) => c[1])]) expect(t, s).not.toMatch(/[<>&"]/);
      expect(line.length, s).toBeLessThanOrEqual(30);
    }
  });
});
