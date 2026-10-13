// Real car: 24.5 x 14.5 x 9.5 cm. Everything is modelled in centimetres; +x is forward, +y up, +z the car's right.
export const R = 3.6; // wheel radius
export const XF = 7.5; // front axle
export const XR = -7.5; // rear axle
export const TZ = 5.7; // half track (wheel centre to car centre line)
export const WB = XF - XR; // wheelbase

export type Corner = 'FL' | 'FR' | 'RL' | 'RR';
export const CORNERS: readonly { key: Corner; x: number; z: number; front: boolean; side: -1 | 1 }[] = [
  { key: 'FL', x: XF, z: -TZ, front: true, side: -1 },
  { key: 'FR', x: XF, z: TZ, front: true, side: 1 },
  { key: 'RL', x: XR, z: -TZ, front: false, side: -1 },
  { key: 'RR', x: XR, z: TZ, front: false, side: 1 },
];
