import { TZ, WB, type Corner } from './dims';

export type CornerBumps = Record<Corner, number>;
export interface Body { heave: number; heaveV: number; pitch: number; pitchV: number; roll: number; rollV: number }
export interface SuspensionOpts { locked: boolean; accel: number; v: number; steer: number; dt: number }

export const createBody = (): Body => ({ heave: 0, heaveV: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0 });

const SPRING_K = 80; // soft springs: body natural frequency ≈ 1.4 Hz
const DAMPING_C = 9;

/**
 * Move the sprung body (heave, pitch = nose up, roll = right side down) toward the ground under the wheels.
 * Locked springs bolt it to the wheels; working springs let slow swells through and soak up quick bumps.
 */
export function stepSuspension(b: Body, w: CornerBumps, o: SuspensionOpts): void {
  const front = (w.FL + w.FR) / 2, rear = (w.RL + w.RR) / 2, left = (w.FL + w.RL) / 2, right = (w.FR + w.RR) / 2;
  if (o.locked) {
    b.heave = (front + rear) / 2; b.pitch = (front - rear) / WB; b.roll = -(right - left) / (2 * TZ);
    b.heaveV = b.pitchV = b.rollV = 0;
    return;
  }
  const tHeave = ((front + rear) / 2) * 0.9;
  const tPitch = ((front - rear) / WB) * 0.9 + Math.max(-200, Math.min(200, o.accel)) * 0.00012; // squat when accelerating
  const tRoll = (-(right - left) / (2 * TZ)) * 0.9 + o.v * o.steer * 0.0009; // lean out of turns
  const step = (x: number, v: number, t: number): [number, number] => {
    const a = SPRING_K * (t - x) - DAMPING_C * v;
    v += a * o.dt;
    return [x + v * o.dt, v];
  };
  [b.heave, b.heaveV] = step(b.heave, b.heaveV, tHeave);
  [b.pitch, b.pitchV] = step(b.pitch, b.pitchV, tPitch);
  [b.roll, b.rollV] = step(b.roll, b.rollV, tRoll);
}

/** Height of the body at car-space (x, z), for small angles. */
export function bodyHeightAt(b: Pick<Body, 'heave' | 'pitch' | 'roll'>, x: number, z: number): number {
  return b.heave + b.pitch * x - b.roll * z;
}
