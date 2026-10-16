import { describe, expect, it } from 'vitest';
import { resolveOverlaps, type LabelBox } from '../src/core/layout';

const overlaps = (a: LabelBox, b: LabelBox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe('label layout', () => {
  it('leaves separate labels where they are', () => {
    const boxes = [{ x: 100, y: 100, w: 60, h: 20 }, { x: 300, y: 100, w: 60, h: 20 }];
    expect(resolveOverlaps(boxes)).toEqual(boxes.map(({ x, y }) => ({ x, y })));
  });

  it('never moves the first (selected) label', () => {
    const out = resolveOverlaps([{ x: 100, y: 100, w: 60, h: 20 }, { x: 105, y: 102, w: 60, h: 20 }]);
    expect(out[0]).toEqual({ x: 100, y: 100 });
  });

  it('pushes a clashing label up until nothing overlaps', () => {
    const boxes = [{ x: 100, y: 100, w: 60, h: 20 }, { x: 100, y: 100, w: 60, h: 20 }, { x: 110, y: 95, w: 60, h: 20 }];
    const out = resolveOverlaps(boxes);
    const placed = out.map((p, i) => ({ ...boxes[i], ...p }));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
    expect(out[1].y).toBeLessThan(100);
  });

  it('stacks labels downward instead of pushing them above the top limit', () => {
    const boxes = [{ x: 100, y: 100, w: 60, h: 20 }, { x: 100, y: 100, w: 60, h: 20 }, { x: 105, y: 98, w: 60, h: 20 }];
    const out = resolveOverlaps(boxes, 90);
    const placed = out.map((p, i) => ({ ...boxes[i], ...p }));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
    for (const p of out) expect(p.y).toBeGreaterThanOrEqual(90);
    expect(out[1].y).toBeGreaterThan(100);
  });

  it('gives the same answer for the same input, so labels never flicker', () => {
    const boxes = [{ x: 50, y: 50, w: 40, h: 20 }, { x: 60, y: 55, w: 40, h: 20 }, { x: 55, y: 45, w: 40, h: 20 }];
    expect(resolveOverlaps(boxes)).toEqual(resolveOverlaps(boxes));
  });
});
