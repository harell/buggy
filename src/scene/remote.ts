import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TAU } from '../core/math';
import { box, put, type P2 } from '../model/geometry';
import { fontsReady, textTex } from '../model/textures';

export type RemoteCtrl = 'wheel' | 'trigger';
export interface Remote {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  wheel: THREE.Group;
  trigger: THREE.Group;
  led: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  antennaTip: THREE.Object3D;
  /** Meshes you can grab, tagged with userData.ctrl. */
  controls: THREE.Mesh[];
  resize(w: number, h: number): void;
}

const mat = {
  body: () => new THREE.MeshPhysicalMaterial({ color: 0x1b1d22, roughness: 0.5, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.5 }),
  base: () => new THREE.MeshStandardMaterial({ color: 0x24272d, roughness: 0.6 }),
  face: () => new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.45, metalness: 0.2 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9 }),
  silver: () => new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.25 }),
};

/** Smooth side-profile outline (x forward, y up) extruded to a given thickness. */
function rounded(pts: P2[], depth: number, bevel: number, material: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape(); s.moveTo(...pts[0]);
  s.splineThru(pts.slice(1).concat([pts[0]]).map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 80 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, material);
}

/** The pistol-grip 2.4 GHz transmitter, seen from a fixed camera. */
export function createRemote(canvas: HTMLCanvasElement): Remote {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xeef3ff, 0x40444c, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(8, 14, 16); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc2ff, 1.2); rim.position.set(-10, 8, -6); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(26, 1, 1, 200);

  const remote = new THREE.Group(); remote.rotation.y = -0.5; scene.add(remote);
  remote.add(rounded([[-4.6, 14.4], [-2.6, 15.3], [0.8, 15.5], [3.3, 14.9], [4.7, 13.4], [5.0, 11.6], [4.6, 10.2], [3.4, 9.5], [1.0, 9.2], [-1.0, 8.7], [-3.6, 8.7], [-4.9, 10.2], [-5.3, 12.4]], 4.4, 0.45, mat.body())); // head
  remote.add(rounded([[-3.9, 9.6], [-1.0, 9.6], [-0.35, 7.4], [-0.4, 4.6], [0.5, 2.7], [-3.4, 2.5], [-3.75, 4.6], [-3.6, 7.2]], 3.0, 0.45, mat.body())); // grip
  remote.add(rounded([[-6.0, 2.6], [1.4, 2.8], [2.4, 2.0], [2.2, 0.4], [1.2, 0.05], [-5.6, 0.05], [-6.4, 0.6], [-6.6, 1.8]], 4.8, 0.4, mat.base())); // base
  remote.add(put(new THREE.Mesh(box(2.2, 4.2, 0.12), mat.rubber()), -2.05, 5.4, 1.98, 0, 0, -0.08)); // grip strip

  const wheel = new THREE.Group(); wheel.position.set(-0.3, 12.15, 2.95); remote.add(wheel);
  const face = new THREE.LatheGeometry([[0, -0.4], [2.6, -0.4], [2.6, 0.3], [2.55, 0.5], [2.0, 0.5], [1.95, 0.68], [1.3, 0.68], [1.25, 0.55], [0.6, 0.55], [0.55, 0.75], [0, 0.75]].map(([r, h]) => new THREE.Vector2(r, h)), 64).rotateX(Math.PI / 2);
  wheel.add(new THREE.Mesh(face, mat.face()));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.36, 14, 64), mat.rubber()));
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; wheel.add(put(new THREE.Mesh(box(0.18, 0.32, 0.62), mat.rubber()), Math.cos(a) * 3.05, Math.sin(a) * 3.05, 0, 0, 0, a)); }
  wheel.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 24).rotateX(Math.PI / 2), mat.silver()), 0, 0, 0.85));
  wheel.add(put(new THREE.Mesh(box(0.3, 0.9, 0.1), new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.4, emissive: 0xff6a00, emissiveIntensity: 0.35 })), 0, 2.0, 0.72)); // marker so turning shows

  const trigger = new THREE.Group(); trigger.position.set(2.3, 9.35, 0); remote.add(trigger);
  trigger.add(rounded([[0, 0], [0.9, -0.25], [1.35, -1.25], [1.25, -2.5], [0.55, -3.05], [-0.15, -2.8], [0.2, -2.05], [0.3, -1.2], [-0.1, -0.45]], 1.3, 0.18, mat.body()));

  remote.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.4, 14), mat.body()), -3.9, 16.6, -0.7, 0, 0, 0.12)); // antenna
  const antennaTip = put(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), mat.body()), -4.1, 18.3, -0.7); remote.add(antennaTip);
  const led = put(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff4136, emissive: 0xff2010, emissiveIntensity: 2 })), 5.3, 12.6, 0.8);
  remote.add(led);
  remote.add(put(new THREE.Mesh(box(0.3, 1.1, 0.8), mat.face()), 5.2, 11.3, -0.5, 0, 0, -0.12)); // power switch
  remote.add(put(new THREE.Mesh(box(0.2, 0.45, 0.4), mat.silver()), 5.36, 11.55, -0.5, 0, 0, -0.12));
  void fontsReady.then(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: textTex('2.4 GHz', { size: 84, color: '#8fb3ff' }), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
    remote.add(put(m, -2.15, 1.4, 2.81));
  });

  const controls: THREE.Mesh[] = [];
  wheel.traverse((o) => { if (o instanceof THREE.Mesh) { o.userData.ctrl = 'wheel'; controls.push(o); } });
  trigger.traverse((o) => { if (o instanceof THREE.Mesh) { o.userData.ctrl = 'trigger'; controls.push(o); } });

  return {
    renderer, scene, camera, wheel, trigger, led, antennaTip, controls,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = Math.max(21 / (2 * half), 17 / (2 * half * camera.aspect));
      camera.position.set(4, 9.6, dist); camera.lookAt(0, 9.3, 0); camera.updateProjectionMatrix();
    },
  };
}
