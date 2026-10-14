/*
 * The real car is a DK087 (factory no. 3699-087). Sizes were measured from photos of real cars, scaled from a
 * cutting-mat photo; see research/measurements.csv for each value's source and uncertainty.
 * Everything is in centimetres. +x is forward, +y up, +z the car's right; the ground is y = 0.
 */

/* ---- Wheels and axles ---- */
export const R = 3.0; // tyre radius (60 mm tyres)
export const TYRE_W = 2.3; // tread width, shoulder to shoulder
export const RING_R = 1.65; // light-grey ring on the wheel face (33 mm across)
export const XF = 7.325; // front axle
export const XR = -7.325; // rear axle
export const WB = XF - XR; // wheelbase, 146.5 mm
export const TZF = 5.85; // front half track (wheel centre to car centre line)
export const TZR = 5.95; // rear half track
export const TZ = (TZF + TZR) / 2; // mean half track, for body roll

export type Corner = 'FL' | 'FR' | 'RL' | 'RR';
export const CORNERS: readonly { key: Corner; x: number; z: number; front: boolean; side: -1 | 1 }[] = [
  { key: 'FL', x: XF, z: -TZF, front: true, side: -1 },
  { key: 'FR', x: XF, z: TZF, front: true, side: 1 },
  { key: 'RL', x: XR, z: -TZR, front: false, side: -1 },
  { key: 'RR', x: XR, z: TZR, front: false, side: 1 },
];

/* ---- Body: painted metal panels on a moulded black frame ---- */
/** Flat black plate on the chassis nose, with a wider tubular hoop behind it. */
export const BUMPER = { faceX: XF + 4.15, plateW: 4.4, top: 5.4, bottom: 3.4, hoopW: 6.6 } as const;
/** Single blue panel from the cockpit to the nose, narrowing between the front shocks. */
export const HOOD = { tipX: XF + 2.87, wAtFrontAxle: 4.0, topAtFrontAxle: 5.65, rearX: 1.6 } as const;
/**
 * Blue side panels: 78 mm across the cockpit, widest (84.5 mm) about 42 mm ahead of the rear axle. The front edge
 * (just behind the front tyre) is read off side photos 12, 21 and 22, not measured. The top is nearly level, rising
 * only to `rearTop` at the rear edge: the 78 mm once read there was the black upper body above the blue panel.
 */
export const SIDE_POD = { frontX: 4.0, rearX: XF - 12.0, wCockpit: 7.8, wMax: 8.45, wMaxX: XR + 4.25, top: 6.7, rearTop: 6.95 } as const;
/**
 * Blue roof plate on the frame, with a U-notch at the front for the light bar. Its rear edge is a photo estimate from
 * the side views (12, 22), to be confirmed by caliper (issue #5).
 */
export const ROOF = { top: 9.2, w: 4.2, frontX: 1.3, rearX: -3.8 } as const;
/** Three white LEDs in a black bar under the roof's front edge. */
export const LIGHT_BAR = { x: 1.05, w: 3.0, h: 1.0, pitch: 0.93, lensR: 0.25, leds: 3 } as const;
/**
 * Black wing on a short lattice above the gearbox. `trailY` is the deck's top at its trailing edge; the deck tilts down
 * toward the front and its tall endplates rise above it, their tops the car's highest point.
 */
export const WING = { span: 9.0, chord: 3.3, top: 9.3, trailX: XR - 4.1, trailY: 8.55 } as const;

/* ---- Chassis, suspension, battery ---- */
export const CHASSIS = { clearance: 2.5 } as const; // underside of the tub at mid-wheelbase
/** Four spring-only coil-overs (no oil). `extended` is eye to eye at full droop. */
export const SHOCK = { coils: 9, extended: 3.6, bodyR: 0.28, springR: 0.55 } as const;
/** One 14500 Li-ion cell lying across the car in an underside bay under a one-screw cover. */
export const BATTERY = { r: 0.7, len: 5.1, bayW: 5.6, bayL: 6.5, bayX: -1.4 } as const;

export const OVERALL = {
  length: BUMPER.faceX - WING.trailX,
  width: 2 * TZR + TYRE_W,
  height: WING.top,
} as const;
