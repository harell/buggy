export interface LabelBox { x: number; y: number; w: number; h: number }

/**
 * Nudge labels upward until they stop overlapping. Earlier labels win (put the selected one first),
 * and the same input always gives the same output, so labels never flip-flop between frames.
 * A label that would have to go above `minY` (say, under a bar at the top) stacks downward instead.
 */
export function resolveOverlaps(boxes: readonly LabelBox[], minY = -Infinity): { x: number; y: number }[] {
  const done: LabelBox[] = [];
  for (const b of boxes) {
    const L = { ...b };
    let down = false;
    for (let tries = 0; tries < 16; tries++) {
      const hit = done.find((d) => Math.abs(d.x - L.x) < (d.w + L.w) / 2 + 4 && Math.abs(d.y - L.y) < (d.h + L.h) / 2 + 2);
      if (!hit) break;
      const up = hit.y - (hit.h + L.h) / 2 - 3;
      if (!down && up >= minY) L.y = up;
      else { down = true; L.y = hit.y + (hit.h + L.h) / 2 + 3; }
    }
    done.push(L);
  }
  return done.map(({ x, y }) => ({ x, y }));
}
