import * as THREE from 'three';
import { mod, rng, TAU } from '../core/math';
import { GROUND, gridLines, groundHeight, TILE } from '../core/terrain';
import type { Pose } from '../core/vehicle';
import { canvasTex } from '../model/textures';

export interface Ground { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; rough: boolean; reshape(): void; follow(p: Pose): void }

const SIZE = 2 * GROUND.half;

/** Seamless dirt texture: blotches, grit and pebbles, all wrapped across the tile edges. */
function dirtTexture(): THREE.CanvasTexture {
  const t = canvasTex(512, 512, (g, S) => {
    const r = rng(7);
    g.fillStyle = '#c4b294'; g.fillRect(0, 0, S, S);
    const wrap = (x: number, y: number, rad: number, fn: (X: number, Y: number) => void) => {
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        if (x + dx + rad < 0 || x + dx - rad > S || y + dy + rad < 0 || y + dy - rad > S) continue;
        fn(x + dx, y + dy);
      }
    };
    for (let i = 0; i < 80; i++) {
      const x = r() * S, y = r() * S, rad = 30 + r() * 100, col = r() < 0.5 ? 'rgba(116,96,70,0.16)' : 'rgba(240,228,204,0.2)';
      wrap(x, y, rad, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2); });
    }
    for (let i = 0; i < 3200; i++) {
      const x = r() * S, y = r() * S, rad = 0.4 + r() * 1.5, dark = r() < 0.55;
      g.fillStyle = dark ? `rgba(88,70,50,${0.2 + r() * 0.35})` : `rgba(250,242,226,${0.18 + r() * 0.3})`;
      wrap(x, y, rad, (X, Y) => { g.beginPath(); g.arc(X, Y, rad, 0, TAU); g.fill(); });
    }
    for (let i = 0; i < 110; i++) {
      const x = r() * S, y = r() * S, rx = 2 + r() * 5, ry = 1.5 + r() * 3.5, a = r() * TAU, l = (150 + r() * 60) | 0;
      wrap(x, y, rx + 2, (X, Y) => {
        g.save(); g.translate(X, Y); g.rotate(a);
        g.fillStyle = 'rgba(60,48,36,.35)'; g.beginPath(); g.ellipse(1, 1.5, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = `rgb(${l},${l - 12},${l - 30})`; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(-rx * 0.3, -ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, TAU); g.fill();
        g.restore();
      });
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(SIZE / TILE, SIZE / TILE);
  return t;
}

/**
 * A flat grid on the given lines in x and z, facing up. UVs run 0..1 across it, as on a PlaneGeometry laid flat.
 * Fine near the car and coarse far away: about a quarter of the triangles of an even grid this fine.
 */
function gridGeometry(xs: readonly number[]): THREE.BufferGeometry {
  const n = xs.length, pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), idx: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = j * n + i;
    pos.set([xs[i], 0, xs[j]], v * 3);
    uv.set([(xs[i] + SIZE / 2) / SIZE, (SIZE / 2 - xs[j]) / SIZE], v * 2);
    if (i < n - 1 && j < n - 1) idx.push(v, v + n, v + 1, v + n, v + n + 1, v + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * A dirt track that slides under the car (the car stays at the origin). Its heights repeat every
 * TILE, so moving it by whole tiles keeps the bumps under the wheels matching what you see.
 */
export function createGround(scene: THREE.Scene): Ground {
  const geo = gridGeometry(gridLines(GROUND));
  const material = new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  const pivot = new THREE.Group(); pivot.add(mesh); scene.add(pivot);
  const g: Ground = {
    mesh, material, rough: false,
    reshape() {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i), g.rough));
      p.needsUpdate = true;
      geo.computeVertexNormals();
    },
    follow(pose) {
      pivot.rotation.y = -pose.h;
      mesh.position.set(-mod(pose.x, TILE), 0, -mod(pose.z, TILE));
    },
  };
  g.reshape();
  return g;
}
