import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CompKey } from '../src/core/components';
import { applyView, mk, piece, quietShadows, setApart, type PartMesh } from '../src/model/parts';

const grey = () => new THREE.MeshStandardMaterial({ color: 0x777777 });
const cube = (s: number) => new THREE.BoxGeometry(s, s, s);
/** Put meshes on a piece of a component, as the car does. */
const on = (comp: CompKey, ...ms: PartMesh[]) => { const p = piece(comp, new THREE.Group(), new THREE.Vector3()); p.add(...ms); return p; };
const view = (spot: CompKey[] = [], removed: CompKey[] = []) => applyView({ spot: new Set(spot), removed: new Set(removed) });

describe('shadow casters', () => {
  it('keeps a mesh made with cast: false from casting once a spotlight is cleared (decals, wires)', () => {
    const decal = mk(new THREE.PlaneGeometry(2, 1), grey, 'body', { cast: false });
    const panel = mk(cube(2), grey, 'body');
    on('body', decal, panel);
    view(['wheelsF']);
    expect(panel.castShadow).toBe(false); // ghosted
    view();
    expect(panel.castShadow).toBe(true);
    expect(decal.castShadow).toBe(false);
  });

  it('stops tiny meshes casting and leaves them off whatever is lit up', () => {
    const screw = mk(new THREE.SphereGeometry(0.1), grey, 'wheels');
    const tyre = mk(new THREE.CylinderGeometry(3, 3, 2), grey, 'wheels');
    on('wheelsR', screw, tyre);
    quietShadows(0.3, []);
    expect(screw.castShadow).toBe(false);
    expect(tyre.castShadow).toBe(true);
    for (const s of [['wheelsR'], []] as CompKey[][]) {
      view(s);
      expect(screw.castShadow, `${s}`).toBe(false);
      expect(tyre.castShadow, `${s}`).toBe(true);
    }
  });

  it('measures size in the world, so a small geometry scaled up still casts', () => {
    const rod = mk(cube(0.2), grey, 'steering');
    on('tieRods', rod).scale.set(10, 10, 10);
    quietShadows(0.3, []);
    expect(rod.castShadow).toBe(true);
  });

  it('casts nothing from a component taken off the car', () => {
    const tub = mk(cube(3), grey, 'chassis');
    on('chassis', tub);
    view([], ['chassis']);
    expect(tub.castShadow).toBe(false);
    view();
    expect(tub.castShadow).toBe(true);
  });

  it('lets parts shut inside a housing cast only while the car is apart, and keeps the cover casting', () => {
    const gear = mk(new THREE.CylinderGeometry(1.5, 1.5, 0.3), grey, 'gears');
    const cover = mk(cube(4), grey, 'gears', { cutaway: 'gears' });
    const housing = new THREE.Group().add(on('gears', gear), on('gearbox', cover));
    quietShadows(0.3, [housing]);
    view();
    expect(gear.castShadow).toBe(false);
    expect(cover.castShadow).toBe(true);
    setApart(true);
    expect(gear.castShadow).toBe(true);
    view(['wheelsR']);
    expect(gear.castShadow).toBe(false); // ghosted
    view(['gears']);
    expect(gear.castShadow).toBe(true);
    view();
    expect(gear.castShadow).toBe(true); // still apart
    setApart(false);
    expect(gear.castShadow).toBe(false);
    expect(cover.castShadow).toBe(true);
  });

  it('takes the shadow off a cover while it is opened up, and gives the parts inside theirs (issue #10 housing)', () => {
    const gear = mk(new THREE.CylinderGeometry(1.5, 1.5, 0.3), grey, 'gears');
    const cover = mk(cube(4), grey, 'gears', { cutaway: ['gears', 'motor'] });
    const housing = new THREE.Group().add(on('gears', gear), on('gearbox', cover));
    quietShadows(0.3, [housing]);
    view();
    expect(cover.castShadow).toBe(true); // solid black: its shadow hides theirs
    expect(gear.castShadow).toBe(false);
    view(['gears', 'gearbox']); // open, so a full shadow would darken the gears it shows
    expect(cover.castShadow).toBe(false);
    expect(gear.castShadow).toBe(true);
    view(['motor']); // both ghosted
    expect(cover.castShadow).toBe(false);
    expect(gear.castShadow).toBe(false);
    view();
    expect(cover.castShadow).toBe(true);
    expect(gear.castShadow).toBe(false);
  });
});
