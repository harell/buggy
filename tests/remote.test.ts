import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildRemote, ctrlOf, WHEEL_TURN, type RemoteCtrl } from '../src/scene/remote';

const remote = buildRemote();
remote.root.updateMatrixWorld(true);
const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

/** What a click from the right side (where the card's camera is) at this remote-space point would grab. */
function clickFromRight(p: THREE.Vector3): RemoteCtrl | null {
  const ray = new THREE.Raycaster(p.clone().add(new THREE.Vector3(0, 0, 30)), new THREE.Vector3(0, 0, -1));
  return ctrlOf(ray.intersectObjects(remote.meshes, false));
}

describe('the DK087 transmitter (version B)', () => {
  it('has the measured size: 13.4 tall, 11.7 long, standing on the table', () => {
    const b = new THREE.Box3().setFromObject(remote.root);
    expect(b.min.y).toBeCloseTo(0, 1);
    expect(b.max.y).toBeCloseTo(13.4, 1);
    expect(b.max.x - b.min.x).toBeCloseTo(11.7, 1);
  });

  it('has a 4.3 cm steering wheel and a C-ring trigger 2 cm behind the head front', () => {
    const w = size(remote.wheel);
    expect(w.x).toBeCloseTo(4.3, 1);
    expect(w.y).toBeCloseTo(4.3, 1);
    const head = new THREE.Box3().setFromObject(remote.root).max.x;
    const trig = new THREE.Box3().setFromObject(remote.trigger);
    expect(head - trig.max.x).toBeCloseTo(2.0, 1);
    expect(trig.max.x - trig.min.x).toBeGreaterThan(1.9);
    expect(trig.max.x - trig.min.x).toBeLessThan(2.4);
  });

  it('is 4.7 tall at the head front, fins included, so the 4.3 wheel fills it', () => {
    const down = new THREE.Raycaster(new THREE.Vector3(5.4, 20, 1.7), new THREE.Vector3(0, -1, 0)); // onto the top fin, over the wheel's front
    const top = down.intersectObjects(remote.meshes, false)[0].point.y;
    const up = new THREE.Raycaster(new THREE.Vector3(4.6, 0, 0), new THREE.Vector3(0, 1, 0)); // in front of the trigger and the foot
    const chin = up.intersectObjects(remote.meshes, false)[0].point.y;
    expect(top - chin).toBeGreaterThan(4.55);
    expect(top - chin).toBeLessThan(4.85);
    expect(size(remote.wheel).y / (top - chin)).toBeGreaterThan(0.9);
  });

  it('fills the head\'s front with the wheel: its front edge within about 0.8 of the head front', () => {
    const head = new THREE.Box3().setFromObject(remote.root).max.x, wheel = new THREE.Box3().setFromObject(remote.wheel);
    expect(head - wheel.max.x).toBeLessThan(0.85);
    expect(head - wheel.max.x).toBeGreaterThan(0.4);
  });

  it('turns the wheel only a little at full lock, because steering is on/off', () => {
    expect(WHEEL_TURN).toBeCloseTo(0.45, 2);
  });

  it('tells which control a click lands on, and the case blocks clicks', () => {
    expect(clickFromRight(world(remote.button))).toBe('lights');
    expect(clickFromRight(world(remote.wheel).add(new THREE.Vector3(0, 1.9, 0)))).toBe('wheel');
    const ring = new THREE.Box3().setFromObject(remote.trigger);
    expect(clickFromRight(new THREE.Vector3(ring.min.x + 0.15, (ring.min.y + ring.max.y) / 2 - 0.2, 0))).toBe('trigger'); // the ring's back
    expect(clickFromRight(new THREE.Vector3(-2, 6, 0))).toBeNull(); // the grip
    expect(clickFromRight(new THREE.Vector3(0, 25, 0))).toBeNull(); // thin air
  });

  it('keeps the radio point inside the top of the head (there is no antenna stub)', () => {
    const p = world(remote.antennaTip);
    expect(p.y).toBeGreaterThan(11.5);
    expect(p.y).toBeLessThan(13.4);
    expect(Math.abs(p.z)).toBeLessThan(0.5);
  });
});
