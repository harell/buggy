import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sun: THREE.DirectionalLight;
  home: { pos: THREE.Vector3; target: THREE.Vector3 };
  /** Narrow screens, and a short gap between panels at the top and bottom, need the camera further back. */
  fitK(): number;
  resize(w: number, h: number): void;
  /** Slide the picture right by this many pixels, so what the camera looks at sits clear of a panel on the left. */
  setShift(px: number): void;
  /** Pixels of the picture covered by panels at the top and bottom: the picture slides so what the camera looks at sits between them. */
  setInsets(top: number, bottom: number): void;
  /** Keep the shadow-casting light over whatever the camera looks at, and the fog beyond it however far back the camera stands. */
  followTarget(): void;
}

/** Renderer, camera, orbit controls and lighting for the car view. Throws if WebGL is unavailable. */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.Fog(0xdde5ee, 90, 230);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 800);
  const home = { pos: new THREE.Vector3(31, 17, 33), target: new THREE.Vector3(0, 4.6, 0) };
  camera.position.copy(home.pos);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(home.target);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 9; controls.maxDistance = 200; // a tall, narrow phone needs to stand far back to see the car side on
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xeaf1ff, 0x7a6c5a, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.3);
  sun.position.set(16, 34, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 110 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xc4d8ff, 0.7); rim.position.set(-22, 14, -20); scene.add(rim);

  let size = { w: 1, h: 1 }, shift = 0, inset = { t: 0, b: 0 };
  const fitK = () => Math.max(1, 1.35 / camera.aspect, size.h / Math.max(1, size.h - inset.t - inset.b));
  const applyShift = () => {
    const up = (inset.b - inset.t) / 2;
    if (Math.abs(shift) < 0.5 && Math.abs(up) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(size.w, size.h, -shift, up, size.w, size.h);
  };
  return {
    renderer, scene, camera, controls, sun, home, fitK,
    resize(w, h) { size = { w, h }; renderer.setSize(w, h, false); camera.aspect = w / h; applyShift(); camera.updateProjectionMatrix(); },
    setShift(px) { if (Math.abs(px - shift) < 0.25) return; shift = px; applyShift(); camera.updateProjectionMatrix(); },
    setInsets(t, b) {
      if (Math.abs(t - inset.t) < 0.25 && Math.abs(b - inset.b) < 0.25) return;
      inset = { t, b }; applyShift(); camera.updateProjectionMatrix();
    },
    followTarget() {
      const t = controls.target;
      sun.position.set(t.x + 16, 34, t.z + 12); sun.target.position.set(t.x, 0, t.z);
      const fog = scene.fog as THREE.Fog, back = Math.max(0, camera.position.distanceTo(t) - 40);
      fog.near = 90 + back; fog.far = 230 + back;
    },
  };
}

/** Match the 3D background and ground to the page's light/dark theme tokens. */
export function syncTheme(scene: THREE.Scene, groundMat: THREE.MeshStandardMaterial): void {
  const cs = getComputedStyle(document.documentElement);
  const bg = new THREE.Color(cs.getPropertyValue('--scene').trim() || '#dde5ee');
  scene.background = bg;
  if (scene.fog) scene.fog.color.copy(bg);
  groundMat.color.set(cs.getPropertyValue('--ground-tint').trim() || '#ffffff');
}
