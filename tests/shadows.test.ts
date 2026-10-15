import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyFocus, applyHighlight, GHOST, markWire, mk, quietShadows, setApart } from '../src/model/parts';

const grey = () => new THREE.MeshStandardMaterial({ color: 0x777777 });
const cube = (s: number) => new THREE.BoxGeometry(s, s, s);

describe('shadow casters', () => {
  it('keeps a mesh made with cast: false from casting once a highlight is cleared (decals, wires)', () => {
    const decal = mk(new THREE.PlaneGeometry(2, 1), grey, 'body', { cast: false });
    const panel = mk(cube(2), grey, 'body');
    applyHighlight('wheels');
    expect(panel.castShadow).toBe(false); // ghosted
    applyHighlight(null);
    expect(panel.castShadow).toBe(true);
    expect(decal.castShadow).toBe(false);
  });

  it('stops tiny meshes casting and leaves them off whatever is picked', () => {
    const screw = mk(new THREE.SphereGeometry(0.1), grey, 'wheels');
    const tyre = mk(new THREE.CylinderGeometry(3, 3, 2), grey, 'wheels');
    quietShadows(0.3, []);
    expect(screw.castShadow).toBe(false);
    expect(tyre.castShadow).toBe(true);
    for (const k of ['wheels', null] as const) {
      applyHighlight(k);
      expect(screw.castShadow, `${k}`).toBe(false);
      expect(tyre.castShadow, `${k}`).toBe(true);
    }
  });

  it('measures size in the world, so a small geometry scaled up still casts', () => {
    const rod = mk(cube(0.2), grey, 'steering');
    new THREE.Group().add(rod).scale.set(10, 10, 10);
    quietShadows(0.3, []);
    expect(rod.castShadow).toBe(true);
  });

  it('lets parts shut inside a housing cast only while the car is apart, and keeps the cover casting', () => {
    const housing = new THREE.Group();
    const gear = mk(new THREE.CylinderGeometry(1.5, 1.5, 0.3), grey, 'gears');
    const cover = mk(cube(4), grey, 'gears', { cutaway: 'gears' });
    housing.add(gear, cover);
    quietShadows(0.3, [housing]);
    expect(gear.castShadow).toBe(false);
    expect(cover.castShadow).toBe(true);
    setApart(true);
    expect(gear.castShadow).toBe(true);
    applyHighlight('wheels');
    expect(gear.castShadow).toBe(false); // ghosted
    applyHighlight('gears');
    expect(gear.castShadow).toBe(true);
    applyHighlight(null);
    expect(gear.castShadow).toBe(true); // still apart
    setApart(false);
    expect(gear.castShadow).toBe(false);
    expect(cover.castShadow).toBe(true);
  });

  it('takes the shadow off a cover while it is opened up, and gives the parts inside theirs (issue #10 housing)', () => {
    const housing = new THREE.Group();
    const gear = mk(new THREE.CylinderGeometry(1.5, 1.5, 0.3), grey, 'gears');
    const cover = mk(cube(4), grey, 'gears', { cutaway: ['gears', 'motor'] });
    housing.add(gear, cover);
    quietShadows(0.3, [housing]);
    applyHighlight(null);
    expect(cover.castShadow).toBe(true); // solid black: its shadow hides theirs
    expect(gear.castShadow).toBe(false);
    applyHighlight('gears'); // see-through now, so a full shadow would darken the gears it shows
    expect(cover.castShadow).toBe(false);
    expect(gear.castShadow).toBe(true);
    applyHighlight('motor'); // both ghosted
    expect(cover.castShadow).toBe(false);
    expect(gear.castShadow).toBe(false);
    applyHighlight(null);
    expect(cover.castShadow).toBe(true);
    expect(gear.castShadow).toBe(false);
  });
});

describe('focusing on a chain', () => {
  it('keeps a motor\u2019s loop solid: its battery and its own wires, not the other circuits', () => {
    const battery = mk(cube(2), grey, 'battery'), shell = mk(cube(2), grey, 'body'), motor = mk(cube(1), grey, 'motor');
    const batt = mk(new THREE.CylinderGeometry(0.06, 0.06, 5), grey, 'wires', { cast: false });
    const drive = mk(new THREE.CylinderGeometry(0.06, 0.06, 5), grey, 'wires', { cast: false });
    const steer = mk(new THREE.CylinderGeometry(0.06, 0.06, 5), grey, 'wires', { cast: false });
    markWire(batt, 'batt'); markWire(drive, 'drive'); markWire(steer, 'steer');
    applyFocus({ parts: ['motor', 'battery', 'wires'], circuits: ['batt', 'drive'], open: ['motor'] });
    for (const m of [battery, motor, batt, drive]) expect(m.material).toBe(m.userData.mat);
    expect(steer.material).toBe(GHOST);
    expect(shell.material).toBe(GHOST);
    applyFocus(null);
    for (const m of [battery, shell, motor, batt, drive, steer]) expect(m.material).toBe(m.userData.mat);
  });

  it('ghosts the rest faintly but readably', () => {
    expect(GHOST.opacity).toBeGreaterThanOrEqual(0.1);
    expect(GHOST.opacity).toBeLessThanOrEqual(0.2);
    expect(GHOST.depthWrite).toBe(false);
  });

  it('opens a cover only when the focus asks for it, even if its part is solid', () => {
    const can = mk(cube(2), grey, 'motor', { cutaway: ['motor', 'gears'] });
    applyFocus({ parts: ['motor', 'gears'], circuits: [], open: ['gears'] });
    expect(can.material).toBe(can.userData.mat);
    expect(can.userData.mat.transparent).toBe(true);
    applyFocus({ parts: ['motor'], circuits: [], open: [] });
    expect(can.userData.mat.transparent).toBe(false);
    expect(can.castShadow).toBe(true);
    applyFocus(null);
  });
});
