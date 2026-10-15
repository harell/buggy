import type { PartKey } from './catalog';
import { R } from './dims';
import { DRIVE_TEETH, RATIO } from './gears';

/*
 * The teardown bench: the car as a set of components you can light up, lift off or pull apart, grouped into the
 * assemblies you would talk about together. Each component is one or more pieces of the model.
 */

export type CompKey =
  | 'body' | 'lightBar' | 'chassis' | 'bumper' | 'wing'
  | 'shocksF' | 'shocksR' | 'arms' | 'knuckles'
  | 'motor' | 'gears' | 'gearbox' | 'wheelsR'
  | 'steerMotor' | 'rack' | 'tieRods' | 'wheelsF'
  | 'battery' | 'board' | 'wires';

export interface Comp {
  name: string;
  /** The part its meshes belong to (colours, cutaway covers, shadows). */
  part: PartKey;
  /** One line of facts for whoever is talking: numbers and names, not prose. */
  spec: string;
  /** A cover that stays shut while it is itself spotlit (it opens for what it covers). */
  housing?: true;
}

const T = DRIVE_TEETH;

export const COMPS: Record<CompKey, Comp> = {
  body: { name: 'Body panels', part: 'body', spec: 'Painted sheet-metal hood, side pods and roof, screwed to a black plastic frame' },
  lightBar: { name: 'Light bar', part: 'lights', spec: '3 cool-white LEDs under the roof · switched by the remote’s + button' },
  chassis: { name: 'Chassis tub', part: 'chassis', spec: 'Black ABS tub · battery bay, on/off switch and steering trim underneath' },
  bumper: { name: 'Front bumper', part: 'chassis', spec: 'Plate and tubular hoop on the nose block' },
  wing: { name: 'Rear wing and guard', part: 'chassis', spec: 'Stands on the gearbox, so it swings with the rear axle' },
  shocksF: { name: 'Front shocks', part: 'suspension', spec: 'Coil-over, spring only (no oil) · shock tower to lower arm' },
  shocksR: { name: 'Rear shocks', part: 'suspension', spec: 'Coil-over, spring only · tub crossbar to the swinging rear axle' },
  arms: { name: 'Front lower arms', part: 'suspension', spec: 'One wide arm a side, no upper arm · hinged on steel pins in the nose' },
  knuckles: { name: 'Steering knuckles', part: 'steering', spec: 'Turn on a vertical kingpin screw at the arm’s end · plastic stub axle' },
  motor: { name: 'Drive motor', part: 'motor', spec: 'Brushed DC can, 130/180 size · lies across the car · reverse = + and − swapped' },
  gears: { name: 'Gears', part: 'gears', spec: `${T.pinion}→${T.g1Big}, then ${T.g1Small}→${T.final} ≈ ${+RATIO.toFixed(1)} : 1 (tooth counts illustrative) · no differential` },
  gearbox: { name: 'Gearbox and rear axle', part: 'gears', housing: true, spec: 'Live axle: motor, gears and axle swing together on one pivot' },
  wheelsR: { name: 'Rear wheels', part: 'wheels', spec: `${+(2 * R).toFixed(1)} cm mud tyres · driven (2WD) · plastic bushings, no bearings` },
  steerMotor: { name: 'Steering motor', part: 'steering', spec: 'Plain DC motor, not a servo: full left, straight or full right (illustrative)' },
  rack: { name: 'Steering rack', part: 'steering', spec: 'Slides side to side · a spring centres it again' },
  tieRods: { name: 'Tie rods', part: 'steering', spec: 'Steel wire, Z-bent ends hooked into the knuckles' },
  wheelsF: { name: 'Front wheels', part: 'wheels', spec: `${+(2 * R).toFixed(1)} cm mud tyres · roll free and steer` },
  battery: { name: 'Battery', part: 'battery', spec: '14500 Li-ion · 3.7 V · 500 mAh · 20–30 min a charge' },
  board: { name: 'Receiver board', part: 'board', spec: '2.4 GHz receiver · switches both motors fully on or off · coil antenna' },
  wires: { name: 'Wiring', part: 'wires', spec: 'Red +, black − from the battery · motor leads swap to reverse (routing illustrative)' },
};

export const COMP_ORDER = Object.keys(COMPS) as CompKey[];

export type AssemblyKey = 'frame' | 'suspension' | 'drive' | 'steering' | 'electrics';
export interface Assembly { name: string; comps: readonly CompKey[] }

/** Sets of components that work together. A component can be in more than one (the knuckles steer and hang). */
export const ASSEMBLIES: Record<AssemblyKey, Assembly> = {
  frame: { name: 'Body and frame', comps: ['body', 'lightBar', 'chassis', 'bumper', 'wing'] },
  suspension: { name: 'Suspension', comps: ['shocksF', 'shocksR', 'arms', 'knuckles', 'gearbox'] },
  drive: { name: 'Drivetrain', comps: ['motor', 'gears', 'gearbox', 'wheelsR'] },
  steering: { name: 'Steering', comps: ['steerMotor', 'rack', 'tieRods', 'knuckles', 'wheelsF'] },
  electrics: { name: 'Electrics', comps: ['battery', 'board', 'wires', 'lightBar'] },
};
export const ASSEMBLY_ORDER = Object.keys(ASSEMBLIES) as AssemblyKey[];
