/*
 * Fixed points and outlines of the model, in car coordinates (cm). They live apart from car.ts, which needs the DOM
 * for its textures, so the tests can check how the parts fit together.
 */
import * as THREE from 'three';
import { HOOD, R, ROOF, SIDE_POD, XF } from '../core/dims';
import { AXLE, DRIVE_TEETH, G1, MODULE, MOTOR, pitchRadius, STEER_ARM } from '../core/gears';
import { lerp } from '../core/math';
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

/* ---- Body panels ---- */
/**
 * Hood stations: [x, half-width, top]. It is only HOOD.wAtFrontAxle wide over the front axle, with a squared-off nose
 * between the front shock towers, and its rear corners flare out to meet the side pods beside the A-pillar bases.
 */
export const HOOD_ST: readonly (readonly [number, number, number])[] = [
  [HOOD.tipX, 0.8, 4.5], [HOOD.tipX - 0.1, 1.1, 4.6], [HOOD.tipX - 0.35, 1.38, 4.78], [HOOD.tipX - 0.9, 1.68, 5.05], [XF + 1.0, 1.88, 5.42],
  [XF, HOOD.wAtFrontAxle / 2, HOOD.topAtFrontAxle], [5.8, 2.05, 5.92], [4.6, 2.3, 6.08], [3.4, 2.75, 6.2], [2.4, 3.0, 6.27], [HOOD.rearX, 3.15, 6.32]];
const hoodBand = (hw: number) => Math.min(1.0, hw * 0.5);
/** How far the hood's flanks fall from the flat band to the folded edge, and how deep that edge is. */
const HOOD_FLANK = 0.45, HOOD_SKIRT = 0.45;
/**
 * Hood cross-section (z, y): a flat centre band (it carries SHUTTLE and the stripe) between sharp creases, flat
 * flanks sloping down to a second crease and a folded edge. The crease points are doubled so the shading breaks there.
 */
export const hoodSection = (hw: number, y: number): P2[] => {
  const b = hoodBand(hw), top = y + 0.05, side = top - HOOD_FLANK;
  return [[-hw + 0.06, side - HOOD_SKIRT], [-hw, side], [-hw, side], [-b, top], [-b, top], [b, top], [b, top], [hw, side], [hw, side], [hw - 0.06, side - HOOD_SKIRT]];
};
/** Height of the hood's top face at (x, z). */
export const surfHood = (x: number, z: number): number => {
  const [, hw, y] = interpStations(HOOD_ST, x), b = hoodBand(hw);
  return y + 0.05 - HOOD_FLANK * Math.max(0, Math.min(1, (Math.abs(z) - b) / (hw - b)));
};
/**
 * Side pods: a horizontal ledge along the middle, the lower edge cut back in an arch round the front tyre (`archF` from
 * the axle centre) and, behind the point where the ledge runs out (`cutX`), rising in a straight diagonal to `cutTop`
 * at the rear, following the rear tyre (photos 12, 21, 22). So the panel is a long, low shape between the wheels and
 * its WILD ROAD section a tapered wedge.
 */
export const POD = { ledge: 5.55, bottom: 3.5, archF: 3.65, cutX: -2.0, cutTop: 5.6 } as const;
/** Where the ledge has run out: behind it the pod is one flat panel (it carries WILD ROAD). */
export const LEDGE_END = -2.05;
const arch = (x: number, ax: number, r: number) => (Math.abs(x - ax) < r ? R + Math.sqrt(r * r - (x - ax) ** 2) : -Infinity);
/** Height of a pod's lower edge at x. */
export const podBottom = (x: number): number =>
  Math.max(POD.bottom, arch(x, XF, POD.archF), lerp(POD.bottom, POD.cutTop, Math.max(0, Math.min(1, (POD.cutX - x) / (POD.cutX - SIDE_POD.rearX)))));
/**
 * Pod stations, front to rear: [x, outer half-width, top, how far the upper face steps in above the ledge]. The top
 * sweeps up from about hood height just behind the front tyre to the B-pillar; the ledge runs out just behind the
 * upper vent, ahead of the flat rear panel that carries WILD ROAD.
 */
export const POD_ST: readonly (readonly [number, number, number, number])[] = [
  [SIDE_POD.frontX, SIDE_POD.wCockpit / 2 - 0.08, 6.3, 0.45], [2.5, SIDE_POD.wCockpit / 2 - 0.03, 6.45, 0.45], [1.0, SIDE_POD.wCockpit / 2, 6.6, 0.45],
  [0, SIDE_POD.wCockpit / 2, SIDE_POD.top, 0.45], [-1.0, 4.0, 6.8, 0.42], [-1.75, 4.08, 6.93, 0.33], [LEDGE_END, 4.12, 7.0, 0], [SIDE_POD.wMaxX, SIDE_POD.wMax / 2, 7.3, 0],
  [-4.0, 4.15, 7.6, 0], [SIDE_POD.rearX, 4.0, SIDE_POD.rearTop, 0]];
/* ---- Body frame ---- */
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
