import type { CompKey } from './components';

/*
 * The lesson view: the car as six systems, each a set of components that work together, sorted by what happens to
 * the energy in them. Picking a system lights up its components; each step of its chain can then be made see-through.
 */

/** Electrical: electricity in, no movement out. Both: electricity becomes movement. Mechanical: works with the battery out. */
export type Family = 'elec' | 'both' | 'mech';
export const FAMILIES: Record<Family, string> = { elec: 'Electrical', both: 'Electrical + mechanical', mech: 'Mechanical' };
export const FAMILY_ORDER: readonly Family[] = ['elec', 'both', 'mech'];

/** The form the energy is in at a step: stored, electric, light, or movement (with "spin" where the motor makes it). */
export type Form = 'stored' | 'electric' | 'light' | 'spin' | 'movement';

/** One step along a system's chain: what you would point at and name, made of one or more components. */
export interface Stage { name: string; comps: readonly CompKey[]; form: Form }

/** A motion control a system offers, by the state it toggles. */
export type Control = 'go' | 'reverse' | 'weave' | 'rough' | 'locked' | 'trace' | 'lights';

export type SystemKey = 'power' | 'lights' | 'go' | 'turn' | 'roll' | 'bounce';
export interface System {
  name: string;
  family: Family;
  /** One line under the name in the shelf. */
  line: string;
  /** The question a child would ask that this system answers. */
  question: string;
  stages: readonly Stage[];
  /** Where the camera looks from (toward the system), before it is normalised. */
  view: readonly [number, number, number];
  /** Its motion controls, with the label each one has here. */
  controls: readonly (readonly [Control, string])[];
  /** Motion state it starts with, over the defaults (driving forward on rough ground, lights on, nothing else). */
  starts?: Partial<Record<Control, boolean>>;
}

const battery: Stage = { name: 'Battery', comps: ['battery'], form: 'stored' };
const wires: Stage = { name: 'Wires', comps: ['wires'], form: 'electric' };
const brain: Stage = { name: 'Brain', comps: ['board'], form: 'electric' };

export const SYSTEMS: Record<SystemKey, System> = {
  power: {
    name: 'Power', family: 'elec', line: 'Where the energy starts', question: 'Where does the energy come from?',
    stages: [battery, wires, brain], view: [0.45, 0.85, 0.5], controls: [['go', 'Motors running']],
  },
  lights: {
    name: 'Lights', family: 'elec', line: 'Electricity becomes light', question: 'How do the lights come on?',
    stages: [battery, wires, brain, { name: 'Light bar', comps: ['lightBar'], form: 'light' }],
    view: [0.7, 0.6, 0.55], controls: [['lights', 'Lights on']], starts: { go: false },
  },
  go: {
    name: 'Go', family: 'both', line: 'Electricity becomes movement', question: 'What makes it go?',
    stages: [battery, wires, brain, { name: 'Drive motor', comps: ['motor'], form: 'spin' }, { name: 'Gears', comps: ['gears'], form: 'movement' },
      { name: 'Axle', comps: ['gearbox'], form: 'movement' }, { name: 'Back wheels', comps: ['wheelsR'], form: 'movement' }],
    view: [-0.55, 0.55, 0.65], controls: [['go', 'Driving'], ['reverse', 'Reverse']],
  },
  turn: {
    name: 'Turn', family: 'both', line: 'A motor slides the rack', question: 'How does it turn?',
    stages: [battery, wires, brain, { name: 'Steering motor', comps: ['steerMotor'], form: 'spin' }, { name: 'Rack', comps: ['rack'], form: 'movement' },
      { name: 'Tie rods', comps: ['tieRods'], form: 'movement' }, { name: 'Knuckles', comps: ['knuckles'], form: 'movement' },
      { name: 'Front wheels', comps: ['wheelsF'], form: 'movement' }],
    view: [0.75, 0.6, 0.45], controls: [['weave', 'Left and right'], ['go', 'Driving']], starts: { weave: true },
  },
  roll: {
    name: 'Roll', family: 'mech', line: 'Works with the battery out', question: 'Does it roll with the battery out?',
    stages: [{ name: 'Back wheels', comps: ['wheelsR'], form: 'movement' }, { name: 'Axle', comps: ['gearbox'], form: 'movement' },
      { name: 'Gears', comps: ['gears'], form: 'movement' }, { name: 'Motor', comps: ['motor'], form: 'movement' },
      { name: 'Front wheels', comps: ['wheelsF'], form: 'movement' }],
    view: [-0.5, 0.45, 0.75], controls: [['go', 'Push it']],
  },
  bounce: {
    name: 'Bounce', family: 'mech', line: 'Springs soak up bumps', question: 'What soaks up the bumps?',
    stages: [{ name: 'Wheels', comps: ['wheelsF', 'wheelsR'], form: 'movement' }, { name: 'Front arms', comps: ['arms'], form: 'movement' },
      { name: 'Knuckles', comps: ['knuckles'], form: 'movement' }, { name: 'Rear axle', comps: ['gearbox'], form: 'movement' },
      { name: 'Springs', comps: ['shocksF', 'shocksR'], form: 'stored' }],
    view: [0.05, 0.12, 1], controls: [['rough', 'Rough ground'], ['locked', 'Lock the springs'], ['trace', 'Ride trace']],
  },
};
export const SYSTEM_ORDER = Object.keys(SYSTEMS) as SystemKey[];

/** Every component a system lights up. */
export const systemComps = (s: SystemKey): CompKey[] => SYSTEMS[s].stages.flatMap((st) => st.comps);

/** The step of a system a component belongs to (its index), or -1 if it is not in the system. */
export const stageOf = (s: SystemKey, c: CompKey): number => SYSTEMS[s].stages.findIndex((st) => st.comps.includes(c));

/** The system a click on a part opens from the whole car: the first, in this order, that has it. */
const OPEN_ORDER: readonly SystemKey[] = ['go', 'turn', 'bounce', 'lights', 'roll', 'power'];
export const systemFor = (c: CompKey): SystemKey | null => OPEN_ORDER.find((s) => stageOf(s, c) >= 0) ?? null;

/**
 * What is lit up: the system's components less the steps made see-through. The last step showing can't be made
 * see-through (with nothing lit, the bench would show the whole car solid), so `canHide` says no to it.
 */
export function litComps(s: SystemKey, hidden: ReadonlySet<number>): CompKey[] {
  return SYSTEMS[s].stages.flatMap((st, i) => (hidden.has(i) ? [] : st.comps));
}
export const canHide = (s: SystemKey, hidden: ReadonlySet<number>, i: number): boolean =>
  hidden.has(i) || SYSTEMS[s].stages.some((_, j) => j !== i && !hidden.has(j));
