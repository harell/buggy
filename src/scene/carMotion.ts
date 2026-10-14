import * as THREE from 'three';
import type { PartKey } from '../core/catalog';
import { CORNERS, R, TZ, TZR, XR } from '../core/dims';
import { driveAngles, rackTravel, steerGearAngles } from '../core/gears';
import type { Body, CornerBumps } from '../core/suspension';
import type { DriveState } from '../core/vehicle';
import { link, UP, V } from '../model/geometry';
import { exOf, PARTS } from '../model/parts';
import type { Car } from '../model/car';
import { FRONT_PIVOT, FRONT_SHOCK_LOW, FRONT_SHOCK_TOP, KNUCKLE_INSET, kingpinSwing, RACK_END, REAR_SHOCK_LOW, REAR_SHOCK_TOP, STEER_ARM_END, swingFor } from '../model/mounts';

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

  // the rear drive unit swings on its pivot so the axle reaches the rear wheels' height (it moves a little in x as it does)
  const rAvg = (B.RL + B.RR) / 2;
  car.rearUnit.rotation.set(-(B.RR - B.RL) / (2 * TZ) - body.roll * (1 - e), 0, swingFor(toSprung(V(XR, R + rAvg, 0)).y));
  car.rearUnit.updateMatrix(); car.ru.updateMatrix();
  const toRoot = (p: THREE.Vector3) => p.applyMatrix4(car.ru.matrix).applyMatrix4(car.rearUnit.matrix).applyMatrix4(car.sprung.matrix);
  for (const [key, s] of [['RL', -1], ['RR', 1]] as const) {
    const low = REAR_SHOCK_LOW(s).applyMatrix4(car.ru.matrix).applyMatrix4(car.rearUnit.matrix);
    const sh = car.shocks[key], sx = exOf(sh.group, e);
    sh.update(REAR_SHOCK_TOP(s).add(sx), low.add(sx));
  }

  // wheels: the fronts under their corners, swung round the kingpins when steered; the rears on the axle's ends
  const wheelAngle = -drive.dist / R;
  for (const c of CORNERS) {
    const w = car.wheels[c.key];
    if (c.front) w.center.set(c.x, R + B[c.key], c.z); // unsteered: the kingpin is found from it
    else w.center.copy(toRoot(V(XR, R, c.side * TZR)));
    w.outer.position.copy(w.center).add(exOf(w.outer, e));
    if (c.front) w.outer.position.add(kingpinSwing(c.side, drive.steer));
    w.outer.rotation.set(0, (c.side < 0 ? Math.PI : 0) + (c.front ? drive.steer : 0), 0);
    w.spin.rotation.z = wheelAngle * c.side;
  }

  // front corners: knuckles on their kingpins, one lower arm each, tie rods, shocks
  const rack = rackTravel(drive.steer);
  car.pieces.rack.position.set(0, 0, rack).add(exOf(car.pieces.rack, e));
  car.arms.forEach(({ side: s, lower }, i) => {
    const kc = toSprung(car.wheels[s < 0 ? 'FL' : 'FR'].center).add(V(0, 0, -s * KNUCKLE_INSET)); // the kingpin
    const kn = car.knuckles[i];
    kn.position.copy(kc).add(exOf(kn, e));
    kn.rotation.set(0, drive.steer, 0);
    const lx = exOf(lower, e);
    link(lower, FRONT_PIVOT(s).add(lx), kc.clone().add(V(0, -0.38, 0)).add(lx));
    const armEnd = STEER_ARM_END(s).applyAxisAngle(UP, drive.steer).add(kc);
    const tr = car.tieRods[i], tx = exOf(tr.group, e);
    link(tr.group, RACK_END(s, rack).add(tx), armEnd.add(tx));
    for (const m of tr.ends) m.scale.y = 1 / Math.max(tr.group.scale.y, 0.01); // keep the bent ends short (scale.z mirrors them)
    const lowMount = FRONT_SHOCK_LOW(kc, s); // flanged screw at the arm's outer end
    const sh = car.shocks[s < 0 ? 'FL' : 'FR'], sx = exOf(sh.group, e);
    sh.update(FRONT_SHOCK_TOP(s).add(sx), lowMount.add(sx));
  });

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
