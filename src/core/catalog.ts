export type PartKey = 'motor' | 'gears' | 'battery' | 'board' | 'steering' | 'suspension' | 'wheels' | 'lights' | 'wires' | 'chassis' | 'body';

export interface PartInfo { chip: string; title: string; color: string; kid: string; adult: string }

export const PART_ORDER: readonly PartKey[] = ['motor', 'gears', 'battery', 'board', 'steering', 'suspension', 'wheels', 'lights', 'wires', 'chassis', 'body'];

/** Parts that show their gears best in slow motion. */
export const SLOW_PARTS: readonly PartKey[] = ['motor', 'gears', 'steering'];

export const PART_INFO: Record<PartKey, PartInfo> = {
  motor: {
    chip: 'Engine', title: 'Motor (the engine)', color: '#c9ced6',
    kid: 'Electricity from the battery makes the motor spin super fast. Whirrr! The motor is what makes the car go.',
    adult: 'A small brushed DC motor, the 130-size kind used in most toy cars. Two magnets sit inside the can. The coils on the spinning rotor turn into magnets when current flows, and the copper commutator keeps switching them so the rotor never stops chasing the magnets. Swap + and − and it spins the other way. That is all "reverse" is.',
  },
  gears: {
    chip: 'Gears', title: 'Gearbox', color: '#efe6cf',
    kid: 'Gears are wheels with teeth. The tiny gear on the motor turns a big gear, and that turns the back wheels. Small gear: fast. Big gear: slow but strong.',
    adult: 'Two-step reduction in this model: 8-tooth pinion → 28 teeth, then 10 → 30 on the axle, about 10.5 : 1 (toy gearboxes are usually 10–30 : 1). Only the rear wheels are driven (2WD), on a solid axle with no differential. The gearbox cover is drawn see-through so you can watch.',
  },
  battery: {
    chip: 'Battery', title: 'Battery', color: '#2f7fd6',
    kid: "The battery is the car's lunchbox. It holds the energy, and the wires carry it to the brain and the motors.",
    adult: 'One 3.7 V rechargeable lithium-ion cell with a small 2-pin (SM-2P) plug. It charges from the USB cable in the box. The seller claims about 45 minutes of play.',
  },
  board: {
    chip: 'Brain', title: 'Receiver board (the brain)', color: '#2b8a4a',
    kid: "This is the car's brain. It listens for radio messages from the remote, then turns the motors on, off, forwards or backwards.",
    adult: 'A 2.4 GHz receiver chip plus motor drivers. A set of MOSFET switches (an H-bridge) runs the drive motor both ways, and a smaller driver chip runs the steering motor. The wire running up the roll cage is the antenna. Layout follows a published teardown of a near-identical 1:16 toy.',
  },
  steering: {
    chip: 'Steering', title: 'Steering', color: '#9aa4b2',
    kid: 'Turn the wheel on the remote, and a tiny motor turns a gear. The gear slides a bar with teeth left or right, and the bar pulls the front wheels so they turn.',
    adult: 'Toy-grade steering: a small DC motor and gear train drive a rack and pinion, and tie rods push the steering knuckles. A spring centres the wheels when you let go. Cheap cars like this usually have no servo, so steering is full-left, straight or full-right.',
  },
  suspension: {
    chip: 'Springs', title: 'Shock absorbers', color: '#3a3d44',
    kid: 'Springs squish when the car drives over bumps, so it rolls smoothly instead of bouncing like a ball. Try the Bumpy road, then lock the springs and see the difference!',
    adult: 'Four independent coil-over shocks, the "high-strength shock absorber" from the listing. The front wheels hang on A-arms. At the back, the motor, gearbox and axle swing up and down together. Toy shocks have real springs but usually little or no oil damping.',
  },
  wheels: {
    chip: 'Wheels', title: 'Wheels and tyres', color: '#1d1e21',
    kid: 'Big bumpy tyres grab the ground on grass, sand, gravel and road. The motor only pushes the back wheels. The front wheels roll along and do the steering.',
    adult: 'Soft knobby rubber tyres on plastic rims with a chrome-look ring, about 7 cm across. Rear-wheel drive (2WD): the rears are driven, the fronts roll free and steer.',
  },
  lights: {
    chip: 'Lights', title: 'LED lights', color: '#ffe9a8',
    kid: 'Three bright lights on the roof, so you can drive in the dark!',
    adult: 'Three white LEDs in the roof light pod, powered by the receiver board.',
  },
  wires: {
    chip: 'Wires', title: 'Wires', color: '#d33b2f',
    kid: 'Wires are little roads for electricity. Watch the glow travel from the battery to the brain and out to the motors.',
    adult: 'Red is + and black is − from the battery. The drive motor has two wires (yellow and blue here). To go backwards the brain swaps which one is +, so watch the glow change direction when you press Back.',
  },
  chassis: {
    chip: 'Frame', title: 'Chassis (the frame)', color: '#2a2c31',
    kid: "The frame is the car's floor. Every other part is screwed onto it.",
    adult: 'A moulded plastic tub with the battery bay in the middle, the steering box at the front and the pivot for the rear drive unit.',
  },
  body: {
    chip: 'Body', title: 'Metal body and roll cage', color: '#1c5fe0',
    kid: 'The shiny blue metal shell and the black roll cage keep the inside safe when the car crashes or flips over.',
    adult: 'An alloy (sheet metal) shell with SHUTTLE 08 decals, a plastic roll cage, front bumper and WILD ROAD rear wing. The real car is about 24.5 × 14.5 × 9.5 cm.',
  },
};
