import { describe, expect, it } from 'vitest';
import { wiresShown } from '../src/core/pick';

describe('wires while the car comes apart', () => {
  it('hides the wires once the car is a quarter of the way apart, where their ends have moved away', () => {
    expect(wiresShown(0)).toBe(true);
    expect(wiresShown(0.2)).toBe(true);
    expect(wiresShown(0.25)).toBe(false);
    expect(wiresShown(1)).toBe(false);
  });
});
