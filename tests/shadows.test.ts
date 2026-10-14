import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyHighlight, GHOST, GHOST_NEAR, markWireEnds, mk, quietShadows, setApart } from '../src/model/parts';

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

describe('ghosting while Wires is picked', () => {
  it('ghosts the parts the wires end at more lightly, so no wire ends in mid-air', () => {
    const battery = mk(cube(2), grey, 'battery'), shell = mk(cube(2), grey, 'body');
    const wire = mk(new THREE.CylinderGeometry(0.06, 0.06, 5), grey, 'wires', { cast: false });
    const ends = new THREE.Group(); ends.add(battery);
    markWireEnds([ends]);
    applyHighlight('wires');
    expect(wire.material).toBe(wire.userData.mat);
    expect(battery.material).toBe(GHOST_NEAR);
    expect(shell.material).toBe(GHOST);
    expect(GHOST_NEAR.opacity).toBeGreaterThanOrEqual(0.2);
    expect(GHOST_NEAR.opacity).toBeLessThanOrEqual(0.3);
    applyHighlight('board'); // any other part: the usual faint ghost
    expect(battery.material).toBe(GHOST);
    applyHighlight(null);
    expect(battery.material).toBe(battery.userData.mat);
  });

  it('ghosts a wire end that is also a cover lightly, and keeps the cover shut underneath', () => {
    const can = mk(cube(2), grey, 'motor', { cutaway: ['motor', 'gears'] });
    const ends = new THREE.Group(); ends.add(can);
    markWireEnds([ends]);
    applyHighlight('motor');
    expect(can.userData.mat.transparent).toBe(true);
    applyHighlight('wires');
    expect(can.material).toBe(GHOST_NEAR);
    expect(can.userData.mat.transparent).toBe(false);
    expect(can.userData.mat.opacity).toBe(1);
    applyHighlight(null);
    expect(can.material).toBe(can.userData.mat);
  });
});
