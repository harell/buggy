import * as THREE from 'three';
import type { PartKey } from '../core/catalog';
import { CORNERS, R, TZ, XR } from '../core/dims';
import { AXLE, driveAngles, rackTravel, steerGearAngles } from '../core/gears';
import type { Body, CornerBumps } from '../core/suspension';
import type { DriveState } from '../core/vehicle';
import { link, UP, V } from '../model/geometry';
import { exOf, PARTS } from '../model/parts';
import { FRONT_PIVOT, FRONT_SHOCK_TOP, PIVOT, RACK_END, REAR_SHOCK_LOW, REAR_SHOCK_TOP, type Car } from '../model/car';

export interface PoseInput {
  drive: DriveState;
  body: Body;
  bumps: CornerBumps;
  /** How far apart the car is, eased 0..1. */
  explode: number;
  /** Raw explode amount, for fades. */
  explodeRaw: number;
  onStand: boolean;
  lights: boolean;
  selected: PartKey | null;
  dt: number;
}

const invSprung = new THREE.Matrix4();
const toSprung = (p: THREE.Vector3) => p.clone().applyMatrix4(invSprung);

/** Place every moving part of the car for this frame. */
export function poseCar(car: Car, k: PoseInput): void {
  const { drive, body, bumps: B, explode: e } = k;

  car.root.position.y = e * 2.5;
  car.sprung.position.y = body.heave * (1 - e);
  car.sprung.rotation.z = body.pitch * (1 - e);
  car.sprung.rotation.x = body.roll * (1 - e);
  car.sprung.updateMatrix();
  invSprung.copy(car.sprung.matrix).invert();

  // pieces that only slide apart
  for (const p of Object.values(PARTS)) for (const pc of p.pieces) {
    if (!pc.userData.dynamic) pc.position.copy(pc.userData.base).addScaledVector(pc.userData.ex, e);
  }

  // wheels sit on the ground under each corner
  const wheelAngle = -drive.dist / R;
  for (const c of CORNERS) {
    const w = car.wheels[c.key];
    w.center.set(c.x, R + B[c.key], c.z);
    w.outer.position.copy(w.center).add(exOf(w.outer, e));
    w.outer.rotation.set(0, (c.side < 0 ? Math.PI : 0) + (c.front ? drive.steer : 0), 0);
    w.spin.rotation.z = wheelAngle * c.side;
  }

  // front corners: knuckles, A-arms, tie rods, shocks
  const rack = rackTravel(drive.steer);
  car.pieces.rack.position.set(0, 0, rack).add(exOf(car.pieces.rack, e));
  car.arms.forEach(({ side: s, lower, upper }, i) => {
    const kc = toSprung(car.wheels[s < 0 ? 'FL' : 'FR'].center).add(V(0, 0, -s * 0.95));
    const kn = car.knuckles[i];
    kn.position.copy(kc).add(exOf(kn, e));
    kn.rotation.set(0, drive.steer, 0);
    const lo = FRONT_PIVOT.lower(s), up = FRONT_PIVOT.upper(s);
    const kb = kc.clone().add(V(0, -0.62, -s * 0.1)), kt = kc.clone().add(V(0, 0.62, -s * 0.15));
    link(lower, lo.clone().add(exOf(lower, e)), kb.clone().add(exOf(lower, e)));
    link(upper, up.clone().add(exOf(upper, e)), kt.clone().add(exOf(upper, e)));
    const armEnd = V(-1.05, -0.15, -s * 0.38).applyAxisAngle(UP, drive.steer).add(kc);
    const tr = car.tieRods[i], tx = exOf(tr.group, e);
    link(tr.group, RACK_END(s, rack).add(tx), armEnd.add(tx));
    tr.end.position.set(0, 1, 0);
    tr.end.scale.set(1, 1 / Math.max(tr.group.scale.y, 0.01), 1);
    const lowMount = lo.clone().lerp(kb, 0.72).add(V(0.5, 0.22, 0)); lowMount.z = s * 3.85;
    const sh = car.shocks[s < 0 ? 'FL' : 'FR'], sx = exOf(sh.group, e);
    sh.update(FRONT_SHOCK_TOP(s).add(sx), lowMount.add(sx));
  });

  // the rear drive unit swings on its pivot to follow the rear wheels
  const rAvg = (B.RL + B.RR) / 2;
  const ac = toSprung(V(XR, R + rAvg, 0));
  const ang = Math.atan2(ac.y - PIVOT.y, ac.x - PIVOT.x) - Math.atan2(AXLE.y - PIVOT.y, AXLE.x - PIVOT.x);
  car.rearUnit.rotation.set(-(B.RR - B.RL) / (2 * TZ) - body.roll * (1 - e), 0, ang);
  car.rearUnit.updateMatrix(); car.ru.updateMatrix();
  for (const [key, s] of [['RL', -1], ['RR', 1]] as const) {
    const low = REAR_SHOCK_LOW(s).applyMatrix4(car.ru.matrix).applyMatrix4(car.rearUnit.matrix);
    const sh = car.shocks[key], sx = exOf(sh.group, e);
    sh.update(REAR_SHOCK_TOP(s).add(sx), low.add(sx));
  }

  // drive train and steering gears
  const a = driveAngles(wheelAngle);
  car.rotor.rotation.z = a.rotor;
  car.driveGears.g1a.rotation.z = a.g1;
  car.driveGears.g1b.rotation.z = a.g1Small;
  car.driveGears.fg.rotation.z = a.final;
  car.driveGears.axle.rotation.z = a.axle;
  const sg = steerGearAngles(rack);
  car.steerGears.pinion.rotation.y = sg.pinion;
  car.steerGears.big.rotation.y = sg.big;
  car.steerGears.motor.rotation.y = sg.motor;

  // wires: a glow travels along each wire carrying current
  const steerAct = Math.min(1, Math.abs(drive.steerVel) * 2), power = Math.abs(drive.throttle);
  for (const w of car.wires) {
    w.mesh.visible = k.explodeRaw < 0.25;
    let level = 0, speed = 0;
    if (w.circuit === 'batt') { level = Math.min(1, power + steerAct * 0.6 + (k.lights ? 0.15 : 0)); speed = level * w.dir; }
    else if (w.circuit === 'drive') { level = power; speed = Math.sign(drive.throttle) * power * w.dir; }
    else if (w.circuit === 'steer') { level = steerAct; speed = Math.sign(drive.steerVel) * steerAct * w.dir; }
    else { level = k.lights ? 0.5 : 0; speed = level; }
    w.tex.offset.x -= speed * k.dt * 6;
    if (k.selected === 'wires' && level < 0.35) level = 0.35; // keep them visible while looking at them
    w.mesh.userData.mat.emissiveIntensity = level * 1.8;
  }

  // lights
  for (const m of car.leds) m.userData.mat.emissiveIntensity = k.lights ? 2.2 : 0;
  for (const s of car.ledGlows) s.visible = k.lights && !(k.selected && k.selected !== 'lights');
  car.headlight.intensity = k.lights && !k.onStand ? 3.2 : 0;
}
