import { clamp } from './math';
import { WB } from './dims';

export { WB };
/** On-screen top speed in cm/s (the real car does about 20 km/h; the view is slowed down). */
export const VMAX = 42;
export const STEER_MAX = 0.42; // radians at full lock
export const STEER_RATE = 2.4; // rad/s the steering motor can swing the wheels
const THROTTLE_RATE = 3.2; // how fast the motor spins up

export interface Pose { x: number; z: number; h: number }
export interface DriveState { throttle: number; v: number; steer: number; steerVel: number; dist: number; pose: Pose }

export const createDrive = (): DriveState => ({ throttle: 0, v: 0, steer: 0, steerVel: 0, dist: 0, pose: { x: 0, z: 0, h: 0 } });

/**
 * Advance throttle, steering and position. On the stand the wheels turn but the car stays put.
 * Uses a bicycle model: heading changes at v·tan(steer)/wheelbase.
 */
export function stepDrive(s: DriveState, throttleTarget: number, steerTarget: number, dt: number, onStand: boolean): { accel: number } {
  const vPrev = s.v;
  s.throttle += (throttleTarget - s.throttle) * Math.min(1, dt * THROTTLE_RATE);
  s.v = s.throttle * VMAX;
  const accel = dt > 0 ? (s.v - vPrev) / dt : 0;

  const prev = s.steer, maxStep = dt * STEER_RATE;
  s.steer += clamp(steerTarget * STEER_MAX - s.steer, -maxStep, maxStep);
  s.steerVel = dt > 0 ? (s.steer - prev) / dt : 0;

  s.dist += s.v * dt;
  if (!onStand) {
    const p = s.pose;
    p.h += (s.v * dt * Math.tan(s.steer)) / WB;
    p.x += Math.cos(p.h) * s.v * dt;
    p.z += -Math.sin(p.h) * s.v * dt;
  }
  return { accel };
}

/** World (x, z) of a point given in car coordinates. */
export function wheelWorld(p: Pose, lx: number, lz: number): [number, number] {
  return [p.x + lx * Math.cos(p.h) + lz * Math.sin(p.h), p.z - lx * Math.sin(p.h) + lz * Math.cos(p.h)];
}
