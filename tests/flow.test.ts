import { describe, expect, it } from 'vitest';
import { activeFlows, FLOWS, litCount } from '../src/core/flow';

describe('signal path strip', () => {
  it('shows the drive path while throttling and the steer path while steering', () => {
    expect(activeFlows(0, 0)).toEqual([]);
    expect(activeFlows(1, 0)).toEqual(['drive']);
    expect(activeFlows(-1, 0.5)).toEqual(['drive', 'steer']);
    expect(activeFlows(0, -1)).toEqual(['steer']);
  });

  it('starts at the remote and ends at the wheels', () => {
    for (const f of Object.values(FLOWS)) {
      expect(f.steps[0].label).toBe('Remote');
      expect(f.steps[f.steps.length - 1].part).toBe('wheels');
    }
  });

  it('lights one more step every 1/7 s, up to the whole path', () => {
    expect(litCount(0, 6)).toBe(1);
    expect(litCount(1 / 7 + 1e-6, 6)).toBe(2);
    expect(litCount(10, 6)).toBe(6);
  });
});
