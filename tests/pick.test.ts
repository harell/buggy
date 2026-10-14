import { describe, expect, it } from 'vitest';
import { PART_ORDER } from '../src/core/catalog';
import { explodeAfterPick, wiresShown } from '../src/core/pick';

describe('picking a part', () => {
  it('puts the car back together for the wires, which only show while it is together', () => {
    for (const t of [1, 0.4, 0.1]) expect(explodeAfterPick('wires', t)).toBe(0);
    expect(wiresShown(explodeAfterPick('wires', 1))).toBe(true);
  });

  it('leaves the car as it is for every other part and for the whole car', () => {
    for (const k of [...PART_ORDER.filter((p) => p !== 'wires'), null]) expect(explodeAfterPick(k, 0.7), `${k}`).toBe(0.7);
  });

  it('hides the wires once the car is a quarter of the way apart, where their ends have moved away', () => {
    expect(wiresShown(0)).toBe(true);
    expect(wiresShown(0.2)).toBe(true);
    expect(wiresShown(0.25)).toBe(false);
    expect(wiresShown(1)).toBe(false);
  });
});
