import { OVERALL, R } from './dims';
import { DRIVE_TEETH, RATIO } from './gears';

export type PartKey = 'motor' | 'gears' | 'battery' | 'board' | 'steering' | 'suspension' | 'wheels' | 'lights' | 'wires' | 'chassis' | 'body';

export interface PartInfo { chip: string; title: string; color: string; kid: string; adult: string }

export const PART_ORDER: readonly PartKey[] = ['motor', 'gears', 'battery', 'board', 'steering', 'suspension', 'wheels', 'lights', 'wires', 'chassis', 'body'];

/** Parts that show their gears best in slow motion. */
export const SLOW_PARTS: readonly PartKey[] = ['motor', 'gears', 'steering'];

/** A size in cm as text: one decimal at most, no float noise. */
const cm = (v: number) => `${+v.toFixed(1)}`;
const T = DRIVE_TEETH;

/* Kid text is read aloud to a young child. Grown-up text says what is known about the real DK087 and what is drawn as an example. */
export const PART_INFO: Record<PartKey, PartInfo> = {
  motor: {
    chip: 'Engine', title: 'Motor (the engine)', color: '#c9ced6',
    kid: 'Electricity from the battery makes the motor spin super fast. Whirrr! It lies sideways between the back wheels, just behind the axle, and makes the car go.',
    adult: 'A small brushed DC can motor, 130 or 180 size (about 15–16 mm across; the exact type is not known). It lies across the car in the right-hand end of the rear gearbox, behind the rear axle, and slides out once the end cap is off. Inside the can are two magnets, and the commutator keeps switching current through the spinning coils so the rotor keeps turning. Swap + and − and it spins the other way. That is all reverse is.',
  },
  gears: {
    chip: 'Gears', title: 'Gearbox', color: '#efe6cf',
    kid: 'Gears are wheels with teeth. The tiny gear on the motor turns a big gear, and that turns the back wheels. Small gear: fast. Big gear: slow but strong.',
    adult: `The real gears sit inside the black rear gearbox and have never been photographed, so the tooth counts here are illustrative: ${T.pinion} → ${T.g1Big}, then ${T.g1Small} → ${T.final} on the axle, about ${+RATIO.toFixed(1)} : 1 (toy gearboxes are usually 10–30 : 1). Only the rear wheels are driven (2WD), on a solid axle; one buyer says there is no differential. The gearbox is drawn see-through so you can watch.`,
  },
  battery: {
    chip: 'Battery', title: 'Battery', color: '#2f7fd6',
    kid: "The battery is the car's lunchbox. It holds the energy. It lives in a little room under the car, and you fill it up again with the USB cable.",
    adult: 'One 14500 lithium-ion cell (3.7 V, 500 mAh, about the size of an AA) lying across the car in a bay underneath, behind a cover held by one screw. It connects with a small black 2-pin plug. To charge it you take it out and plug it into the USB lead. Buyers get 20–30 minutes of driving from a charge; the seller claims more.',
  },
  board: {
    chip: 'Brain', title: 'Receiver board (the brain)', color: '#2b8a4a',
    kid: "This is the car's brain. It listens for radio messages from the remote, then turns the motors on or off, forwards or backwards.",
    adult: "A green receiver board at the front of the electronics tub, under a black lid between the axles. It picks up the remote's 2.4 GHz signal; the copper coil along the tub's right wall is probably the antenna. It switches the drive motor and the steering motor fully on or off, either way round, with no speed control in between. No photo shows the chips clearly, so the chips, crystal and board layout drawn here are illustrative.",
  },
  steering: {
    chip: 'Steering', title: 'Steering', color: '#9aa4b2',
    kid: 'Turn the wheel on the remote, and a tiny motor turns the front wheels all the way left or right. Let go, and they point straight again.',
    adult: 'A plain motor, not a servo: the front wheels go full left, straight or full right, nothing in between. Two thin steel-wire tie rods hook into the knuckles, and a trim dial under the car sets where straight ahead is. The real steering box has never been photographed, so the motor, gears and rack drawn in the nose are illustrative. One buyer says it can slip a gear and not quite come back to centre.',
  },
  suspension: {
    chip: 'Springs', title: 'Shock absorbers', color: '#3a3d44',
    kid: 'Springs squish when the car drives over bumps, so it rolls smoothly instead of bouncing like a ball. Try the Bumpy road, then lock the springs and see the difference!',
    adult: "Four coil-over shocks: black plastic bodies and silver steel springs, with no oil inside (buyers say springs only). Each front wheel hangs on one wide lower arm, with no upper arm, and turns on a vertical screw at the arm's end. At the back is a live axle: the motor, gearbox and axle swing up and down together on the rear shocks. Spring stiffness and travel have not been measured, so the bounce here is an estimate.",
  },
  wheels: {
    chip: 'Wheels', title: 'Wheels and tyres', color: '#1d1e21',
    kid: 'Big bumpy tyres grab the ground on grass, sand and gravel. The motor only pushes the back wheels. The front wheels roll along and do the steering.',
    adult: `Rubber mud tyres ${cm(2 * R)} cm across with two staggered rows of hooked lugs, on black 5-spoke rims. Each wheel has a matte light-grey ring on its face (not chrome) and one centre screw. The wheels turn on plain plastic bushings, with no ball bearings. Rear-wheel drive (2WD): the rears are driven, the fronts roll free and steer. The tread is drawn close to the photos, not lug for lug.`,
  },
  lights: {
    chip: 'Lights', title: 'LED lights', color: '#ffe9a8',
    kid: 'Three bright lights on the roof, so you can drive in the dark! Press the + button on the remote to turn them on or off.',
    adult: 'Three cool-white LEDs in a black bar under the front edge of the roof, each behind a small domed lens. The receiver board powers them, and the + button on the remote switches them on and off. The real car has no rear lights.',
  },
  wires: {
    chip: 'Wires', title: 'Wires', color: '#d33b2f',
    kid: 'Wires are little roads for electricity. Watch the glow travel from the battery to the brain and out to the motors.',
    adult: 'Red is + and black is − from the battery, which plugs in under the car. The drive motor has two wires (yellow and blue here). To go backwards the board swaps which one is +, so watch the glow change direction when you press Back. The real tub shows red, blue, yellow, white and red/white leads, but which goes where is not known, so the routing is illustrative.',
  },
  chassis: {
    chip: 'Frame', title: 'Chassis (the frame)', color: '#2a2c31',
    kid: "The frame is the car's floor. The wheels, springs and motor are all fixed to it. The on/off switch is underneath.",
    adult: 'A black ABS plastic tub. Underneath are the battery bay with its one-screw cover, the red on/off slide switch (on the left, at the front edge of the cover) and the steering trim dial. On top sits the electronics tub with its lid. The front bumper, rear wing and shocks stay on the chassis when the body comes off.',
  },
  body: {
    chip: 'Body', title: 'Body panels and frame', color: '#1c5fe0',
    kid: 'Shiny blue metal panels on a black plastic frame. They keep the inside safe when the car crashes or flips over.',
    adult: `Thin painted sheet-metal panels (the hood, two side pods and the roof) screwed to a moulded black plastic frame. There is no one-piece shell and no metal roll cage. Take the screws out and the frame, panels and light bar lift off together. Measured from photos, the whole car is about ${cm(OVERALL.length)} × ${cm(OVERALL.width)} × ${cm(OVERALL.height)} cm (the seller says 24.5 × 14.5 × 9.5). Curves are approximate.`,
  },
};
