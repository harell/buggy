import type { Circuit, PartKey } from './catalog';

/*
 * The lesson layer: what a grown-up can point the car at while talking with a child, what to show for each, the
 * questions children ask, and the guided walks. Text here is for the adult (ask, answer, try) except the gist and the
 * question, which may be shown to the child.
 */

/** The things the adult can focus on: the whole car or one part of a chain. */
export type FocusKey = 'car' | 'battery' | 'brain' | 'motor' | 'gears' | 'steer' | 'springs';
/** In the order energy flows, so stepping through them follows the chain. Keys 1–7 pick them. */
export const FOCUS_ORDER: readonly FocusKey[] = ['car', 'battery', 'brain', 'motor', 'gears', 'steer', 'springs'];

/** What is drawn solid; everything else is see-through. `open` lists the parts whose covers open up. Null: all solid. */
export interface Cast { parts: readonly PartKey[]; circuits: readonly Circuit[]; open: readonly PartKey[] }

/** What holding the run button does: drive forward, reverse, or steer left. */
export type RunAction = 'fwd' | 'back' | 'left';

export type WhatIfId = 'apart' | 'switchOff' | 'remoteOff' | 'reverse' | 'slow' | 'fullLock' | 'lockSprings';
export interface WhatIf { id: WhatIfId; label: string; caption: string }

export interface Focus {
  name: string;
  /** The part the camera frames and the hotspot sits on; null for the whole car. */
  part: PartKey | null;
  cast: Cast | null;
  run: { label: string; action: RunAction };
  /** One line, safe to show the child. */
  gist: string;
  ask: string;
  answer: string;
  try: string;
  whatIf: WhatIf;
}

const LOOP_DRIVE: Cast = { parts: ['battery', 'board', 'wires', 'motor', 'gears', 'wheels'], circuits: ['batt', 'drive'], open: ['board', 'motor'] };
const LOOP_STEER: Cast = { parts: ['battery', 'board', 'wires', 'steering', 'wheels'], circuits: ['batt', 'steer'], open: ['board', 'steering'] };

export const FOCUS: Record<FocusKey, Focus> = {
  car: {
    name: 'Whole car', part: null, cast: null, run: { label: 'Drive on the bumps', action: 'fwd' },
    gist: 'One small battery moves almost everything.',
    ask: 'What do you think is inside, under the blue panels?',
    answer: 'A battery, a brain board, two motors, gears and four springs. Everything except the springs runs on the battery.',
    try: 'Turn your car over. What can you see from underneath?',
    whatIf: { id: 'apart', label: 'Take it apart', caption: 'Every piece slides away from the frame, so you can see what sits where.' },
  },
  battery: {
    name: 'Battery', part: 'battery', cast: { parts: ['battery', 'wires'], circuits: ['batt'], open: [] }, run: { label: 'Current on', action: 'fwd' },
    gist: 'The energy is stored here.',
    ask: 'Where does the energy go when we press the trigger?',
    answer: 'Out on the red wire to the brain, on to the motor, and back on the black wire. A loop.',
    try: 'Find the little door and the red switch under your car.',
    whatIf: { id: 'switchOff', label: 'Switch off', caption: 'The loop has a gap now. Nothing glows and nothing moves, whatever the remote says.' },
  },
  brain: {
    name: 'Brain', part: 'board', cast: { parts: ['board', 'battery', 'wires', 'lights'], circuits: ['batt', 'drive', 'steer', 'light'], open: ['board'] },
    run: { label: 'Remote says go', action: 'fwd' },
    gist: 'A tap that the remote opens.',
    ask: 'Does the remote push the car, or just send a message?',
    answer: 'Just a message, by radio. The car’s own battery does all the work.',
    try: 'Switch the remote off and press the trigger.',
    whatIf: { id: 'remoteOff', label: 'Remote off', caption: 'No message, so the tap stays shut. The battery is full, but nothing moves.' },
  },
  motor: {
    name: 'Motor', part: 'motor', cast: { parts: ['motor', 'gears', 'battery', 'board', 'wires'], circuits: ['batt', 'drive'], open: ['motor', 'board'] },
    run: { label: 'Power the motor', action: 'fwd' },
    gist: 'Electricity in, spin out.',
    ask: 'Why does it spin the other way when we go backwards?',
    answer: 'The brain swaps + and −. Every coil’s pull flips, so the spin flips too.',
    try: 'Lift the back wheels. Forward, then back. Watch them.',
    whatIf: { id: 'reverse', label: 'Run it backwards', caption: 'Same motor, + and − swapped: it spins the other way, and so do the wheels.' },
  },
  gears: {
    name: 'Gears', part: 'gears', cast: { parts: ['gears', 'motor', 'wheels'], circuits: [], open: ['gears'] }, run: { label: 'Turn the gears', action: 'fwd' },
    gist: 'Small gear, big gear: slower, but stronger.',
    ask: 'Which gear is spinning faster?',
    answer: 'The small one, about 3½ times faster than the white gear. The wheels end up about 10 times slower than the motor.',
    try: 'Switch off and roll the car by hand. Easy or stiff?',
    whatIf: { id: 'slow', label: 'Slow motion', caption: 'Slowed right down: count the teeth going past.' },
  },
  steer: {
    name: 'Steering', part: 'steering', cast: { parts: ['steering', 'wheels', 'battery', 'board', 'wires'], circuits: ['batt', 'steer'], open: ['steering', 'board'] },
    run: { label: 'Turn left', action: 'left' },
    gist: 'A second motor pushes a sliding bar.',
    ask: 'Why can’t it turn just a little bit?',
    answer: 'Its motor is only ever fully on or off, so the bar slides all the way, or back to the middle.',
    try: 'Turn the wheel all the way and hold it. Then let go.',
    whatIf: { id: 'fullLock', label: 'Hold full lock', caption: 'Stuck at full lock: electricity still flows but nothing moves, so it gets warm. Let go and a spring brings the wheels back.' },
  },
  springs: {
    name: 'Springs', part: 'suspension', cast: { parts: ['suspension', 'wheels'], circuits: [], open: [] }, run: { label: 'Drive on the bumps', action: 'fwd' },
    gist: 'The one thing the battery doesn’t drive.',
    ask: 'What would happen if the springs were solid?',
    answer: 'Every bump would shake the whole car, and the wheels would bounce off the ground.',
    try: 'Press down on one corner of your car and let go.',
    whatIf: { id: 'lockSprings', label: 'Lock the springs', caption: 'Springs locked: every bump goes straight into the frame.' },
  },
};

/** Which focus a part tapped in 3D leads to. */
const FOCUS_OF_PART: Record<PartKey, FocusKey> = {
  battery: 'battery', board: 'brain', wires: 'battery', lights: 'brain', motor: 'motor', gears: 'gears', wheels: 'gears',
  steering: 'steer', suspension: 'springs', chassis: 'car', body: 'car',
};
export const focusOfPart = (k: PartKey): FocusKey => FOCUS_OF_PART[k];

/** Questions children ask, in their words. Each sets up a view, and may switch on that focus's what-if. */
export interface Question { text: string; focus: FocusKey; whatIf: boolean; answer: string }
export const QUESTIONS: readonly Question[] = [
  { text: 'What makes it go?', focus: 'motor', whatIf: false, answer: 'The motor turns electricity into spin; the gears pass it to the back wheels.' },
  { text: 'Where does the energy come from?', focus: 'battery', whatIf: false, answer: 'One battery under the car. Red wire out, black wire back.' },
  { text: 'What if the battery is flat?', focus: 'battery', whatIf: true, answer: 'No energy, nothing moves, even though the remote still sends messages.' },
  { text: 'How does the remote talk to the car?', focus: 'brain', whatIf: false, answer: 'By radio. The remote sends a message; the brain opens the tap.' },
  { text: 'What if the remote is switched off?', focus: 'brain', whatIf: true, answer: 'The brain hears nothing, so the tap stays shut.' },
  { text: 'How does it go backwards?', focus: 'motor', whatIf: true, answer: 'The brain swaps + and −, and the motor spins the other way.' },
  { text: 'Why so many gears?', focus: 'gears', whatIf: false, answer: 'To trade speed for strength: the wheels turn slower but push harder.' },
  { text: 'How does it turn?', focus: 'steer', whatIf: false, answer: 'A second small motor slides a bar that swings the front wheels.' },
  { text: 'Why can’t it turn just a little?', focus: 'steer', whatIf: true, answer: 'The steering motor is all on or all off, so the wheels go all the way.' },
  { text: 'Why doesn’t it shake to bits?', focus: 'springs', whatIf: false, answer: 'Springs soak up the bumps. They’re the one part the battery doesn’t drive.' },
  { text: 'What if the springs were solid?', focus: 'springs', whatIf: true, answer: 'Every bump would go straight into the car.' },
  { text: 'What’s inside?', focus: 'car', whatIf: true, answer: 'Take it apart and see: battery, brain, two motors, gears, springs.' },
];

/* ---------------- guided walks ---------------- */

export type WalkKey = 'go' | 'turn' | 'bounce';
export interface WalkStep { focus: FocusKey; q: string; a: string }
export interface Walk {
  name: string;
  next: WalkKey;
  steps: readonly WalkStep[];
  /** The last step: the whole chain at once. */
  all: { cast: Cast | null; run: RunAction; ask: string };
}
export const WALK_ORDER: readonly WalkKey[] = ['go', 'turn', 'bounce'];
export const WALKS: Record<WalkKey, Walk> = {
  go: {
    name: 'Go', next: 'turn',
    steps: [
      { focus: 'battery', q: 'Where is the energy kept?', a: 'Here, in the battery under the car.' },
      { focus: 'brain', q: 'Does the remote push the car?', a: 'No. It sends a message, and the brain opens like a tap.' },
      { focus: 'motor', q: 'What turns electricity into movement?', a: 'The motor. Electricity in, spin out.' },
      { focus: 'gears', q: 'Which gear turns faster, the small or the big one?', a: 'The small one. After the big gear it’s slower, but stronger.' },
    ],
    all: { cast: LOOP_DRIVE, run: 'fwd', ask: 'Which part would stop everything if it broke?' },
  },
  turn: {
    name: 'Turn', next: 'bounce',
    steps: [
      { focus: 'battery', q: 'Does steering use the same battery as driving?', a: 'Yes. One battery feeds both motors.' },
      { focus: 'brain', q: 'How does the car know which way to turn?', a: 'The remote’s wheel sends a message; the brain sends electricity one way for left, the other for right.' },
      { focus: 'steer', q: 'Why can’t it turn just a little?', a: 'A small motor pushes a bar that slides all the way left or right. All or nothing.' },
    ],
    all: { cast: LOOP_STEER, run: 'left', ask: 'What brings the wheels back to straight when you let go?' },
  },
  bounce: {
    name: 'Bounce', next: 'go',
    steps: [
      { focus: 'springs', q: 'Is the battery doing this?', a: 'No. The bumps push the wheels up; the springs squeeze and push back.' },
    ],
    all: { cast: null, run: 'fwd', ask: 'Why doesn’t the car shake to bits?' },
  },
};

/** Where a walk is: a step (steps.length is the "all together" step), the question or answer beat, or past the end. */
export interface WalkPos { step: number; beat: 0 | 1; end: boolean }
export const WALK_START: WalkPos = { step: 0, beat: 0, end: false };

export const isAllTogether = (w: Walk, p: WalkPos): boolean => p.step >= w.steps.length;

/** One press of the clicker: question, then answer, then the next step; "all together" has one beat; then the end. */
export function walkNext(w: Walk, p: WalkPos): WalkPos | 'nextWalk' {
  if (p.end) return 'nextWalk';
  if (isAllTogether(w, p)) return { ...p, end: true };
  if (p.beat === 0) return { ...p, beat: 1 };
  return { step: p.step + 1, beat: 0, end: false };
}

export function walkPrev(w: Walk, p: WalkPos): WalkPos {
  if (p.end) return { ...p, end: false };
  if (!isAllTogether(w, p) && p.beat === 1) return { ...p, beat: 0 };
  if (p.step === 0) return p;
  return { step: p.step - 1, beat: 1, end: false };
}

/** The next focus along the chain, for stepping without a walk; it stops at either end. */
export function stepFocus(k: FocusKey, d: 1 | -1): FocusKey {
  const i = FOCUS_ORDER.indexOf(k);
  return FOCUS_ORDER[Math.max(0, Math.min(FOCUS_ORDER.length - 1, i + d))];
}
