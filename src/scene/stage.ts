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
  /** Narrow screens need the camera further back. */
  fitK(): number;
  resize(w: number, h: number): void;
  /** Slide the picture left by this many pixels, so what the camera looks at sits clear of a panel on the right. */
  setShift(px: number): void;
  /** Keep the shadow-casting light over whatever the camera looks at. */
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
  controls.minDistance = 9; controls.maxDistance = 110;
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

  const fitK = () => Math.max(1, 1.35 / camera.aspect);
  let size = { w: 1, h: 1 }, shift = 0;
  const applyShift = () => {
    if (Math.abs(shift) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(size.w, size.h, shift, 0, size.w, size.h);
  };
  return {
    renderer, scene, camera, controls, sun, home, fitK,
    resize(w, h) { size = { w, h }; renderer.setSize(w, h, false); camera.aspect = w / h; applyShift(); camera.updateProjectionMatrix(); },
    setShift(px) { if (Math.abs(px - shift) < 0.25) return; shift = px; applyShift(); camera.updateProjectionMatrix(); },
    followTarget() {
      const t = controls.target;
      sun.position.set(t.x + 16, 34, t.z + 12); sun.target.position.set(t.x, 0, t.z);
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
