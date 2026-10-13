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
