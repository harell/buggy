import './styles.css';
import * as THREE from 'three';
import { ASSEMBLIES, ASSEMBLY_ORDER, COMP_ORDER, COMPS, type AssemblyKey, type CompKey } from './core/components';
import { bodyHeightAt, createBody, stepSuspension, type CornerBumps } from './core/suspension';
import { CORNERS, TZ, XF } from './core/dims';
import { clamp, ease, frameStep, lerp } from './core/math';
import { RideMeter } from './core/ride';
import { groundHeight } from './core/terrain';
import { createDrive, stepDrive, wheelWorld } from './core/vehicle';
import { buildCar } from './model/car';
import { allMeshes, applyView, compOf, compRemoved, compSolid, GHOST, isShown, quietShadows, setApart } from './model/parts';
import { poseCar } from './scene/carMotion';
import { createGround } from './scene/ground';
import { createStage, syncTheme, type Stage } from './scene/stage';
import { $ } from './ui/dom';
import { LabelLayer } from './ui/labels';
import { RideGraph } from './ui/rideGraph';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const bay = $('bay');
const carCanvas = $<HTMLCanvasElement>('car');

let stage: Stage;
try {
  stage = createStage(carCanvas);
} catch (err) {
  bay.insertAdjacentHTML('beforeend', '<div class="nogl">This browser could not start 3D graphics (WebGL). Try another browser or turn on hardware acceleration.</div>');
  throw err;
}
const { scene, camera, controls: orbit } = stage;
const ground = createGround(scene);
const car = buildCar(scene);
// shadows nobody would see: tiny parts, and what is shut inside the gearbox, the motor can, the steering box and the tub
quietShadows(0.3, [car.pieces.gear1, car.driveGears.fg, car.driveGears.axle, car.pieces.motor, car.pieces.steerBox, car.pieces.board, car.pieces.battery]);

/* ---------------- state ---------------- */
const drive = createDrive();
const body = createBody();
const ride = new RideMeter();
const ui = {
  /** The car drives forward on its own; nobody has to hold anything. */
  go: true, weave: false, rough: true, locked: false, slow: false, trace: false,
  explodeT: 0, explode: 0, timeScale: 1, weaveClock: 0, shift: 0,
  spot: new Set<CompKey>(), removed: new Set<CompKey>(),
};
ground.rough = ui.rough; ground.reshape();

// Dev server only (stripped from production builds): lets scripted screenshots set the camera and state.
if (import.meta.env.DEV) Object.assign(window, { __app: { THREE, scene, camera, orbit, car, ui, drive, stage, refresh: () => refresh(true) } });

/* ---------------- camera ---------------- */
type ViewKey = 'threeq' | 'side' | 'front' | 'rear' | 'top';
/** Directions the camera looks from, toward what it is framing. Side is low, at wheel height, for the suspension. */
const VIEWS: Record<ViewKey, THREE.Vector3> = {
  threeq: new THREE.Vector3(0.62, 0.38, 0.69), side: new THREE.Vector3(0, 0.05, 1), front: new THREE.Vector3(1, 0.22, 0.05),
  rear: new THREE.Vector3(-1, 0.3, 0.05), top: new THREE.Vector3(0.02, 1, 0.01),
};
let camTween: { t: number; dur: number; fT: THREE.Vector3; tT: THREE.Vector3; fP: THREE.Vector3; tP: THREE.Vector3 } | null = null;
orbit.addEventListener('start', () => { camTween = null; });
const tweenTo = (target: THREE.Vector3, pos: THREE.Vector3) => {
  camTween = { t: 0, dur: reduceMotion ? 0.01 : 0.9, fT: orbit.target.clone(), tT: target, fP: camera.position.clone(), tP: pos };
};
const lookDir = () => camera.position.clone().sub(orbit.target).normalize();
/** Frame what is lit up (or the whole car), from `dir`. */
function frame(dir = lookDir()) {
  car.root.updateMatrixWorld(true);
  const b = new THREE.Box3();
  for (const m of allMeshes) if (isShown(m) && m.material !== GHOST && compOf(m) !== 'wires' && (ui.spot.size === 0 || ui.spot.has(compOf(m)))) b.expandByObject(m);
  if (b.isEmpty() || ui.spot.size === 0) {
    const t = new THREE.Vector3(0, 4.6 + ui.explodeT * 5, 0);
    tweenTo(t, t.clone().addScaledVector(dir, lerp(46, 64, ui.explodeT) * stage.fitK()));
    return;
  }
  const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length();
  tweenTo(c, c.clone().addScaledVector(dir, clamp(size * 1.8, 16, 80) * stage.fitK()));
}
function setView(k: ViewKey) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === k));
  frame(VIEWS[k].clone().normalize());
}
document.querySelector('.views')!.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-view]');
  if (b) setView(b.dataset.view as ViewKey);
});

/* ---------------- the component tree ---------------- */
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="slash" d="M4 4l16 16"/></svg>';
const row = (k: CompKey) =>
  `<li><button class="nm" data-spot="${k}" title="${COMPS[k].spec}">${COMPS[k].name}</button><button class="eye" data-rm="${k}" aria-label="Take ${COMPS[k].name} off the car">${EYE}</button></li>`;
$('assemblies').innerHTML = ASSEMBLY_ORDER.map((a) =>
  `<section class="asm"><div class="asm-head"><button class="nm" data-spot-asm="${a}">${ASSEMBLIES[a].name}</button><button class="eye" data-rm-asm="${a}" aria-label="Take the whole ${ASSEMBLIES[a].name.toLowerCase()} off the car">${EYE}</button></div><ul>${ASSEMBLIES[a].comps.map(row).join('')}</ul></section>`).join('');

const every = (a: AssemblyKey, s: Set<CompKey>) => ASSEMBLIES[a].comps.every((k) => s.has(k));
/** Toggle one or a set: if all of them are in, take them out; otherwise put them all in. */
function toggle(s: Set<CompKey>, ks: readonly CompKey[]) {
  const all = ks.every((k) => s.has(k));
  for (const k of ks) if (all) s.delete(k); else s.add(k);
}
function spot(ks: readonly CompKey[]) {
  toggle(ui.spot, ks);
  for (const k of ks) if (ui.spot.has(k)) ui.removed.delete(k); // lighting up something taken off puts it back
  refresh(true);
}
function remove(ks: readonly CompKey[]) {
  toggle(ui.removed, ks);
  for (const k of ks) if (ui.removed.has(k)) ui.spot.delete(k);
  refresh(true);
}
$('tree').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('button');
  const d = b?.dataset;
  if (!d) return;
  if (d.spot) spot([d.spot as CompKey]);
  else if (d.spotAsm) spot(ASSEMBLIES[d.spotAsm as AssemblyKey].comps);
  else if (d.rm) remove([d.rm as CompKey]);
  else if (d.rmAsm) remove(ASSEMBLIES[d.rmAsm as AssemblyKey].comps);
});
$('b-reset').onclick = () => { ui.spot.clear(); ui.removed.clear(); refresh(true); };
// on a phone the tree starts folded, so the car is what you see first
if (innerWidth < 700) { $('tree-body').hidden = true; $('b-tree').setAttribute('aria-expanded', 'false'); }
$('b-tree').onclick = () => {
  const open = $('tree-body').hidden;
  $('tree-body').hidden = !open; $('b-tree').setAttribute('aria-expanded', String(open));
};

/** Bring the 3D view and the tree in line with the state. */
function refresh(reframe: boolean) {
  applyView({ spot: ui.spot, removed: ui.removed });
  for (const b of document.querySelectorAll<HTMLElement>('[data-spot]')) b.setAttribute('aria-pressed', String(ui.spot.has(b.dataset.spot as CompKey)));
  for (const b of document.querySelectorAll<HTMLElement>('[data-rm]')) {
    const off = ui.removed.has(b.dataset.rm as CompKey);
    b.setAttribute('aria-pressed', String(off)); b.closest('li')!.classList.toggle('off', off);
  }
  for (const a of ASSEMBLY_ORDER) {
    document.querySelector(`[data-spot-asm="${a}"]`)!.setAttribute('aria-pressed', String(every(a, ui.spot)));
    const off = every(a, ui.removed);
    document.querySelector(`[data-rm-asm="${a}"]`)!.setAttribute('aria-pressed', String(off));
  }
  $('b-reset').toggleAttribute('disabled', ui.spot.size === 0 && ui.removed.size === 0);
  if (reframe) frame();
}

/* ---------------- motion and teardown ---------------- */
function tog(id: string, key: 'go' | 'weave' | 'rough' | 'locked' | 'slow' | 'trace', after?: () => void) {
  const b = $(id);
  b.onclick = () => { ui[key] = !ui[key]; b.setAttribute('aria-pressed', String(ui[key])); after?.(); };
}
tog('b-go', 'go');
tog('b-weave', 'weave', () => { ui.weaveClock = 0; });
tog('b-rough', 'rough', () => { ground.rough = ui.rough; ground.reshape(); });
tog('b-lock', 'locked');
tog('b-slow', 'slow');
tog('b-trace', 'trace');
const slider = $<HTMLInputElement>('explode');
slider.addEventListener('input', () => { ui.explodeT = Number(slider.value) / 100; });
slider.addEventListener('change', () => frame()); // reframe once the slider is let go

/* ---------------- picking parts in 3D ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickComp(cx: number, cy: number): CompKey | null {
  const r = carCanvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(allMeshes.filter((m) => isShown(m)), false);
  const h = hits.find((x) => (x.object as THREE.Mesh).material !== GHOST) ?? hits[0];
  return h ? compOf(h.object as (typeof allMeshes)[number]) : null;
}
let downAt: { x: number; y: number } | null = null;
carCanvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
carCanvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved < 6) { const k = pickComp(e.clientX, e.clientY); if (k) spot([k]); }
});
let hoverAt = 0;
carCanvas.addEventListener('pointermove', (e) => {
  if (e.buttons || e.timeStamp - hoverAt < 80) return; // picking costs a raycast against every mesh: not every move
  hoverAt = e.timeStamp;
  const k = pickComp(e.clientX, e.clientY);
  carCanvas.classList.toggle('picking', !!k);
  carCanvas.title = k ? COMPS[k].name : '';
});

const labels = new LabelLayer($('labels'), (k) => spot([k]));
const rideGraph = new RideGraph($('ride'), $<HTMLCanvasElement>('ride-c'), $('ride-feel'));

/* ---------------- theme & size ---------------- */
const theme = () => syncTheme(scene, ground.material);
theme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const resize = () => stage.resize(bay.clientWidth, bay.clientHeight);
new ResizeObserver(resize).observe(bay);
resize();
camera.position.copy(stage.home.target).add(stage.home.pos.clone().sub(stage.home.target).multiplyScalar(stage.fitK()));
void car.decalsReady.then(() => refresh(false));

/* ---------------- frame loop ---------------- */
/** Weave: full left, straight, full right, straight, each for this long (s). */
const WEAVE_STEP = 1.6;
const tree = $('tree'), treeBody = $('tree-body');
let last = performance.now();
function tick(now: number) {
  const rdt = frameStep(now, last);
  last = now;
  ui.timeScale = lerp(ui.timeScale, ui.slow ? 0.15 : 1, Math.min(1, rdt * 5));
  const dt = rdt * ui.timeScale;
  ui.explode += (ui.explodeT - ui.explode) * Math.min(1, rdt * (reduceMotion ? 30 : 3.2));
  const e = ease(clamp(ui.explode, 0, 1)), onStand = ui.explode > 0.02;
  setApart(onStand);

  // the car drives on by itself; on the stand the wheels and gears keep turning while it stays put
  ui.weaveClock += dt;
  const steer = ui.weave && ui.go ? ([1, 0, -1, 0] as const)[Math.floor(ui.weaveClock / WEAVE_STEP) % 4] : 0;
  const { accel } = stepDrive(drive, ui.go ? 1 : 0, steer, dt, onStand);
  ground.follow(drive.pose);

  const bumps = {} as CornerBumps;
  for (const c of CORNERS) { const [wx, wz] = wheelWorld(drive.pose, c.x, c.z); bumps[c.key] = onStand ? 0 : groundHeight(wx, wz, ground.rough); }
  stepSuspension(body, bumps, { locked: ui.locked, accel, v: drive.v, steer: drive.steer, dt });
  ride.sample(dt, bumps.FL, bodyHeightAt(body, XF, -TZ), onStand);

  const lights = !compRemoved('lightBar');
  poseCar(car, { drive, body, bumps, explode: e, explodeRaw: ui.explode, onStand, lights, ledGlows: compSolid('lightBar'), steerHeld: steer, springTint: compSolid('shocksF') || compSolid('shocksR'), dt });

  if (camTween) {
    camTween.t += rdt / camTween.dur;
    const k = ease(Math.min(1, camTween.t));
    orbit.target.lerpVectors(camTween.fT, camTween.tT, k);
    camera.position.lerpVectors(camTween.fP, camTween.tP, k);
    if (camTween.t >= 1) camTween = null;
  }
  // keep what the camera looks at clear of the tree on the left (on narrow screens the tree folds over the car instead)
  const wide = bay.clientWidth > 900 && !treeBody.hidden;
  ui.shift = lerp(ui.shift, wide ? (tree.offsetWidth + 14) / 2 : 0, Math.min(1, rdt * (reduceMotion ? 30 : 6)));
  stage.setShift(ui.shift);
  orbit.update();
  stage.followTarget();

  car.root.updateMatrixWorld(true);
  labels.update(camera, bay.clientWidth, bay.clientHeight, COMP_ORDER.filter((k) => ui.spot.has(k)), rdt);
  rideGraph.draw(ride, ui.trace);

  stage.renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
refresh(false);
requestAnimationFrame(tick);
