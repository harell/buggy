import { R, XR } from './dims';

export const pitchRadius = (teeth: number, module: number): number => (teeth * module) / 2;

/*
 * Drive train. The real motor lies across the car in the right-hand lobe of the gearbox, behind the rear axle.
 * The tooth counts are illustrative (no photo shows the gears): 8T pinion → 28T, 10T on the same shaft → 30T on the
 * axle. Positions are in the car's side view (x, y).
 */
export const MODULE = 0.08;
export const DRIVE_TEETH = { pinion: 8, g1Big: 28, g1Small: 10, final: 30 } as const;
export const AXLE = { x: XR, y: R } as const;
export const MOTOR = { x: XR - 2.2, y: R + 0.5 } as const;

/** Where two circles cross, taking the upper crossing. */
function upperCrossing(a: { x: number; y: number }, ra: number, b: { x: number; y: number }, rb: number) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const along = (ra * ra - rb * rb + d * d) / (2 * d), up = Math.sqrt(ra * ra - along * along);
  const ux = dx / d, uy = dy / d, sx = a.x + ux * along, sy = a.y + uy * along;
  const p1 = { x: sx - uy * up, y: sy + ux * up }, p2 = { x: sx + uy * up, y: sy - ux * up };
  return p1.y >= p2.y ? p1 : p2;
}
/** The middle gear sits where it meshes with both the motor pinion and the axle gear. */
export const G1 = upperCrossing(
  MOTOR, pitchRadius(DRIVE_TEETH.pinion, MODULE) + pitchRadius(DRIVE_TEETH.g1Big, MODULE),
  AXLE, pitchRadius(DRIVE_TEETH.g1Small, MODULE) + pitchRadius(DRIVE_TEETH.final, MODULE),
);
export const RATIO = (DRIVE_TEETH.g1Big / DRIVE_TEETH.pinion) * (DRIVE_TEETH.final / DRIVE_TEETH.g1Small);

const toG1 = Math.atan2(G1.y - MOTOR.y, G1.x - MOTOR.x);
const toAxle = Math.atan2(AXLE.y - G1.y, AXLE.x - G1.x);
/** Starting angles so a tooth of each driving gear points into a gap of the gear it drives. */
const PHASE = {
  rotor: toG1,
  g1: toG1 + Math.PI + Math.PI / DRIVE_TEETH.g1Big,
  g1Small: toAxle,
  final: toAxle + Math.PI + Math.PI / DRIVE_TEETH.final,
};

/** Rotation (about the car's z axis) of every drive-train part for a given wheel angle. */
export function driveAngles(wheelAngle: number) {
  const motor = wheelAngle * RATIO;
  const g1 = -motor * (DRIVE_TEETH.pinion / DRIVE_TEETH.g1Big);
  return { rotor: PHASE.rotor + motor, g1: PHASE.g1 + g1, g1Small: PHASE.g1Small + g1, final: PHASE.final + wheelAngle, axle: wheelAngle };
}

/* Steering: motor pinion 6T → 20T, an 8T pinion on the same shaft drives the rack. */
export const STEER_MODULE = 0.08;
export const STEER_TEETH = { motor: 6, big: 20, pinion: 8 } as const;
export const STEER_ARM = 1.0; // knuckle steering-arm length

export const rackTravel = (steer: number): number => STEER_ARM * Math.sin(steer);

/** Rotation (about the vertical axis) of the steering gears for a given rack position. */
export function steerGearAngles(rack: number) {
  const pinion = -rack / pitchRadius(STEER_TEETH.pinion, STEER_MODULE);
  return { pinion, big: Math.PI + pinion, motor: Math.PI / STEER_TEETH.motor - pinion * (STEER_TEETH.big / STEER_TEETH.motor) };
}
