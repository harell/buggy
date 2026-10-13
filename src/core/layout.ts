export interface LabelBox { x: number; y: number; w: number; h: number }

/**
 * Nudge labels upward until they stop overlapping. Earlier labels win (put the selected one first),
 * and the same input always gives the same output, so labels never flip-flop between frames.
 */
export function resolveOverlaps(boxes: readonly LabelBox[]): { x: number; y: number }[] {
  const done: LabelBox[] = [];
  for (const b of boxes) {
    const L = { ...b };
    for (let tries = 0; tries < 8; tries++) {
      const hit = done.find((d) => Math.abs(d.x - L.x) < (d.w + L.w) / 2 + 4 && Math.abs(d.y - L.y) < (d.h + L.h) / 2 + 2);
      if (!hit) break;
      L.y = hit.y - (hit.h + L.h) / 2 - 3;
    }
    done.push(L);
  }
  return done.map(({ x, y }) => ({ x, y }));
}
