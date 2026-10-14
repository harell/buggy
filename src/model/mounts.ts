/*
 * Fixed points and outlines of the model, in car coordinates (cm). They live apart from car.ts, which needs the DOM
 * for its textures, so the tests can check how the parts fit together.
 */
import * as THREE from 'three';
import { HOOD, ROOF, SIDE_POD, XF } from '../core/dims';
import { AXLE, DRIVE_TEETH, G1, MODULE, MOTOR, pitchRadius, STEER_ARM } from '../core/gears';
import { interpStations, V, type P2 } from './geometry';

export const TUB = { x0: -5.0, x1: 4.4, hw: 3.1, floor: 4.25, top: 5.2 } as const; // the tub between the axles

/* ---- Rear drive unit ---- */
/** The rear drive unit swings on a pivot at the gearbox's front-top, where it meets the tub behind the battery cover. */
export const PIVOT = V(TUB.x0 - 0.25, 3.9, 0);
/** Clearance over the middle gear's 28T tooth tips: the housing humps over it. */
const G1_CLEAR = pitchRadius(DRIVE_TEETH.g1Big, MODULE) + MODULE + 0.15;
export const GEARBOX = { x0: MOTOR.x - 1.0, top: G1.y + G1_CLEAR } as const; // back and top of the housing
/** The housing's side profile (x, y): front-top at the pivot, a hump over G1, the motor lobe behind, the axle below. */
export const GEARBOX_OUTLINE: readonly P2[] = [
  [PIVOT.x + 0.25, PIVOT.y - 0.35], [PIVOT.x + 0.25, PIVOT.y + 0.35], [-6.4, 4.55],
  ...Array.from({ length: 11 }, (_, i): P2 => { const a = ((15 + i * 15) * Math.PI) / 180; return [G1.x + G1_CLEAR * Math.cos(a), G1.y + G1_CLEAR * Math.sin(a)]; }),
  [MOTOR.x - 0.3, 4.55], [GEARBOX.x0, MOTOR.y + 0.3], [GEARBOX.x0, MOTOR.y - 0.6], [MOTOR.x - 0.3, 2.45], [-8.4, 1.65], [AXLE.x, 1.55], [-6.2, 1.75], [-5.7, 2.6]];
export const MOTOR_Z = -0.2; // inner end of the motor can, which lies across the car in the right-hand lobe
export const LOBE_Z = 2.65; // the lobe's capped ends
export const GEAR_Z = { pinion: MOTOR_Z - 0.25, final: MOTOR_Z - 0.6 } as const; // the two gear planes
const ARM = Math.hypot(AXLE.x - PIVOT.x, AXLE.y - PIVOT.y);
/** How far the rear unit turns about PIVOT (about z) to put the axle centre at height y; the axle moves in x as it swings. */
export const swingFor = (y: number): number => Math.asin((AXLE.y - PIVOT.y) / ARM) - Math.asin(Math.max(-1, Math.min(1, (y - PIVOT.y) / ARM)));

/* ---- Front corners and steering ---- */
/** Steering rack, in the nose block just behind the front axle. */
export const RACK = { x: XF - STEER_ARM, y: 3.25, halfW: 1.2 } as const;
/** The kingpin is `inset` inboard of the wheel centre; the white stub axle reaches `stub` out from it. */
export const KNUCKLE = { inset: 1.5, armY: -0.15, stub: 1.1 } as const;
export const KNUCKLE_INSET = KNUCKLE.inset;
/** Inner hinge of each front lower arm, on the nose block. */
export const FRONT_PIVOT = (s: number) => V(XF, 2.95, s * 1.55);
/** On a boss on the tower beside the hood's front corner; low enough that the shock is short of full droop at rest. */
export const FRONT_SHOCK_TOP = (s: number) => V(XF + 0.2, 5.9, s * 2.6);
/** The flanged screw at the lower arm's outer end, from the kingpin `kc`. */
export const FRONT_SHOCK_LOW = (kc: THREE.Vector3, s: number) => kc.clone().add(V(0.3, -0.3, -s * 0.5));
export const REAR_SHOCK_TOP = (s: number) => V(-7.5, 7.45, s * 2.7); // ends of the crossbar behind the cockpit
export const REAR_SHOCK_LOW = (s: number) => V(-7.6, 4.1, s * 2.45); // on the gearbox, so it swings with the axle
export const RACK_END = (s: number, travel: number) => V(RACK.x, RACK.y, s * RACK.halfW + travel);
/** Where a knuckle's steering arm hooks the tie rod, relative to the kingpin, before steering. */
export const STEER_ARM_END = (s: number) => V(-STEER_ARM, KNUCKLE.armY, -s * 0.1);
/** A steered front wheel swings round its kingpin: its centre's offset from where it sits when straight. */
export const kingpinSwing = (s: number, steer: number) => V(s * KNUCKLE.inset * Math.sin(steer), 0, s * KNUCKLE.inset * (Math.cos(steer) - 1));

/* ---- Body frame ---- */
/** Hood stations: [x, half-width, top]; it is only HOOD.wAtFrontAxle wide over the front axle. */
export const HOOD_ST: readonly (readonly [number, number, number])[] = [
  [HOOD.tipX, 0.7, 4.5], [HOOD.tipX - 0.1, 1.15, 4.62], [HOOD.tipX - 0.35, 1.5, 4.78], [HOOD.tipX - 0.9, 1.78, 5.05], [XF + 1.0, 1.95, 5.42],
  [XF, HOOD.wAtFrontAxle / 2, HOOD.topAtFrontAxle], [5.8, 2.05, 5.92], [4.0, 2.2, 6.12], [SIDE_POD.frontX, 2.5, 6.25], [HOOD.rearX + 0.5, 2.9, 6.3], [HOOD.rearX, 3.15, 6.32]];
const hoodBand = (hw: number) => Math.min(0.8, hw * 0.45);
/**
 * Hood cross-section (z, y): a flat raised centre band (it carries SHUTTLE and the stripe) between sharp creases, and
 * flat facets sloping down to the folded edges. The crease points are doubled so the shading breaks there.
 */
export const hoodSection = (hw: number, y: number): P2[] => {
  const b = hoodBand(hw);
  return [[-hw + 0.06, y - 0.5], [-hw, y - 0.25], [-b, y + 0.05], [-b, y + 0.05], [b, y + 0.05], [b, y + 0.05], [hw, y - 0.25], [hw - 0.06, y - 0.5]];
};
/** Height of the hood's top face at (x, z). */
export const surfHood = (x: number, z: number): number => {
  const [, hw, y] = interpStations(HOOD_ST, x), b = hoodBand(hw);
  return y + 0.05 - 0.3 * Math.max(0, Math.min(1, (Math.abs(z) - b) / (hw - b)));
};
const FP = { z: 2.45, x0: HOOD.rearX + 0.1, x1: HOOD.rearX + 1.15 } as const, FP_Y = surfHood(FP.x0 + 0.4, FP.z);
/** B-pillar each side: from the roof's rear corner, bowed back behind the rear panel's holes, down to the pod. */
export const B_PILLAR = (s: number): [number, number, number][] => [[ROOF.rearX + 0.12, ROOF.top - 0.2, s * (ROOF.w / 2 - 0.15)], [ROOF.rearX - 1.05, 8.3, s * 2.2],
  [SIDE_POD.rearX + 0.15, SIDE_POD.rearTop - 0.4, s * 3.0]];
/** Flat perforated infill plates (outline in x, y, at |z| = z). The rear one runs from the hoop leg back to the B-pillar. */
export interface Perforated { outline: P2[]; holes: P2[]; hr: number; z: number }
export const REAR_PANEL: Perforated = {
  outline: [[ROOF.rearX + 0.1, ROOF.top - 0.25], [ROOF.rearX + 0.1, 7.4], [SIDE_POD.rearX + 0.25, 7.55], [SIDE_POD.rearX + 0.2, 7.65], [ROOF.rearX - 1.1, 8.25], [ROOF.rearX - 0.75, 8.68], [ROOF.rearX - 0.2, ROOF.top - 0.25]],
  holes: [[-3.5, 8.3], [-3.8, 8.3], [-4.1, 8.3], [-3.6, 7.92], [-3.9, 7.92], [-4.2, 7.92]],
  hr: 0.1, z: 2.15,
};
/** The small front plate stands on the hood's sloping facet beside each A-pillar base. */
export const FRONT_PANEL: Perforated = {
  outline: [[FP.x1, surfHood(FP.x1, FP.z) - 0.02], [FP.x0, surfHood(FP.x0, FP.z) - 0.02], [FP.x0 - 0.05, FP_Y + 1.05]],
  holes: [[FP.x0 + 0.2, FP_Y + 0.25], [FP.x0 + 0.45, FP_Y + 0.25], [FP.x0 + 0.2, FP_Y + 0.52]],
  hr: 0.08, z: FP.z,
};
