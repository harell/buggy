import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CompKey } from '../src/core/components';
import { applyView, compOf, compRemoved, compSolid, GHOST, mk, piece, PARTS, type PartMesh } from '../src/model/parts';

const solid = () => new THREE.MeshStandardMaterial({ color: 0x111111 });
const cube = () => new THREE.BoxGeometry();
const on = (comp: CompKey, ...ms: PartMesh[]) => { const p = piece(comp, new THREE.Group(), new THREE.Vector3()); p.add(...ms); return p; };
const view = (spot: CompKey[] = [], removed: CompKey[] = []) => applyView({ spot: new Set(spot), removed: new Set(removed) });

describe('components', () => {
  it('finds a mesh’s component through its piece, however deep, unless the mesh names its own', () => {
    const shaft = mk(cube(), solid, 'motor'), pinion = mk(cube(), solid, 'gears', { comp: 'gears' });
    const rotor = new THREE.Group().add(shaft, pinion);
    const p = on('motor'); p.add(rotor);
    expect(compOf(shaft)).toBe('motor');
    expect(compOf(pinion)).toBe('gears');
    expect(PARTS.motor.pieces).toContain(p); // a piece is filed under its component's part
  });

  it('ghosts what is not lit up, and draws everything solid when nothing is', () => {
    const tub = mk(cube(), solid, 'chassis'), shock = mk(cube(), solid, 'suspension');
    on('chassis', tub); on('shocksF', shock);
    view(['shocksF']);
    expect(shock.material).toBe(shock.userData.mat);
    expect(tub.material).toBe(GHOST);
    expect(compSolid('shocksF')).toBe(true);
    expect(compSolid('chassis')).toBe(false);
    view();
    expect(tub.material).toBe(tub.userData.mat);
    expect(compSolid('chassis')).toBe(true);
  });

  it('takes a removed component off the car, and puts it back', () => {
    const panel = mk(cube(), solid, 'body');
    on('body', panel);
    view([], ['body']);
    expect(panel.visible).toBe(false);
    expect(compRemoved('body')).toBe(true);
    expect(compSolid('body')).toBe(false);
    view();
    expect(panel.visible).toBe(true);
  });

  it('ghosts the rest faintly but readably', () => {
    expect(GHOST.opacity).toBeGreaterThanOrEqual(0.1);
    expect(GHOST.opacity).toBeLessThanOrEqual(0.2);
    expect(GHOST.depthWrite).toBe(false);
  });
});

describe('cutaways', () => {
  it('opens a cover for what it covers, and closes it again', () => {
    const lid = mk(cube(), solid, 'board', { cutaway: 'board', comp: 'chassis' });
    on('board', lid);
    view(['board']);
    expect(lid.userData.mat.transparent).toBe(true);
    expect(lid.userData.mat.opacity).toBeLessThan(0.5);
    view(['chassis']); // the tub lit up: its lid stays shut
    expect(lid.userData.mat.transparent).toBe(false);
    view();
    expect(lid.userData.mat.transparent).toBe(false);
    expect(lid.userData.mat.opacity).toBe(1);
  });

  it('opens the gearbox for the motor and the gears, but not when the housing itself is what is lit up (issue #10)', () => {
    const housing = mk(cube(), solid, 'gears', { cutaway: ['gears', 'motor'] });
    on('gearbox', housing);
    const mat = housing.userData.mat;
    for (const s of [[], ['wheelsR'], ['body'], ['gearbox']] as CompKey[][]) {
      view(s);
      expect(mat.transparent, `${s}`).toBe(false); // solid black, as on the real car
      expect(mat.opacity).toBe(1);
    }
    for (const s of [['gears'], ['motor'], ['gearbox', 'gears']] as CompKey[][]) {
      view(s);
      expect(mat.transparent, `${s}`).toBe(true);
      expect(mat.opacity).toBeLessThan(0.5);
      expect(mat.depthWrite).toBe(false);
    }
    view();
    expect(mat.transparent).toBe(false);
    expect(mat.depthWrite).toBe(true);
  });
});

// last: the orphan it makes stays in the registry, where every later view would trip over it
describe('a mesh on no piece', () => {
  it('is refused rather than guessed at', () => {
    expect(() => compOf(mk(cube(), solid, 'body'))).toThrow(/not on any piece/);
  });
});
