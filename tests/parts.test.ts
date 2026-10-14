import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyHighlight, mk } from '../src/model/parts';

const solid = () => new THREE.MeshStandardMaterial({ color: 0x111111 });

describe('cutaways', () => {
  it('opens a cover for its own part only, and closes it again', () => {
    const lid = mk(new THREE.BoxGeometry(), solid, 'board', { cutaway: 'board' });
    applyHighlight('board');
    expect(lid.userData.mat.transparent).toBe(true);
    expect(lid.userData.mat.opacity).toBeLessThan(0.5);
    applyHighlight(null);
    expect(lid.userData.mat.transparent).toBe(false);
    expect(lid.userData.mat.opacity).toBe(1);
  });

  it('opens a cover for any of several parts: the gearbox housing for the motor and the gears (issue #10)', () => {
    const housing = mk(new THREE.BoxGeometry(), solid, 'gears', { cutaway: ['gears', 'motor'] });
    const mat = housing.userData.mat;
    for (const k of [null, 'wheels', 'body'] as const) {
      applyHighlight(k);
      expect(mat.transparent, `${k}`).toBe(false); // solid black, as on the real car
      expect(mat.opacity).toBe(1);
    }
    for (const k of ['gears', 'motor'] as const) {
      applyHighlight(k);
      expect(mat.transparent, k).toBe(true);
      expect(mat.opacity).toBeLessThan(0.5);
      expect(mat.depthWrite).toBe(false);
    }
    applyHighlight(null);
    expect(mat.transparent).toBe(false);
    expect(mat.depthWrite).toBe(true);
  });
});
