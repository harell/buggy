import { TAU } from './math';

/** The ground repeats every TILE cm, so the mesh can be shifted by whole tiles as the car drives. */
export const TILE = 40;
const K = TAU / TILE;

/** Gentle dirt-track swells (whole-number frequencies per tile keep it tileable). */
export function bump(x: number, z: number): number {
  return 0.3 * Math.sin(2 * K * x + 0.7) * Math.sin(K * z + 1.1) + 0.17 * Math.sin(K * (3 * x + 2 * z) + 2.0) + 0.1 * Math.sin(K * (x + 2 * z) + 0.5);
}

/** Small, fast gravel bumps for the springs demo. */
export function roughBump(x: number, z: number): number {
  return 0.46 * Math.sin(4 * K * x + 0.3) * Math.sin(3 * K * z + 1.7) + 0.28 * Math.sin(K * (5 * x - 2 * z) + 0.9) + 0.2 * Math.sin(K * (2 * x + 6 * z) + 2.2);
}

export function groundHeight(x: number, z: number, rough: boolean): number {
  return rough ? bump(x, z) + roughBump(x, z) : bump(x, z);
}

export interface GridSpec {
  /** The ground runs from -half to half in x and z. */
  half: number;
  /** The band (in mesh coordinates) kept at `step` spacing: where the car can be, plus a margin all round. */
  fine: readonly [number, number];
  step: number;
  /** Each gap outside the band is at most this many times the one before. */
  grow: number;
}

/** The car always sits in [0, TILE) of the mesh, so only the ground near that square needs the fine grid. */
export const GROUND: GridSpec = { half: 180, fine: [-30, 70], step: 1.6, grow: 1.07 };

/** Grid line positions across the ground: `step` apart in the fine band, then gaps growing by `grow` out to the edges. */
export function gridLines({ half, fine: [f0, f1], step, grow }: GridSpec): number[] {
  const n = Math.ceil((f1 - f0) / step), h = (f1 - f0) / n;
  // gaps h·grow, h·grow², … until they cover `span`, then all scaled down a little to end exactly on the edge
  const outward = (span: number) => {
    const gaps: number[] = [];
    for (let g = h * grow, sum = 0; sum < span; g *= grow) { gaps.push(g); sum += g; }
    const k = span / gaps.reduce((a, b) => a + b, 0);
    return gaps.map((g) => g * k);
  };
  const lines = Array.from({ length: n + 1 }, (_, i) => f0 + i * h);
  let x = f1;
  for (const g of outward(half - f1)) lines.push((x += g));
  x = f0;
  for (const g of outward(f0 + half)) lines.unshift((x -= g));
  lines[0] = -half; lines[lines.length - 1] = half; // no float drift at the edges
  return lines;
}
