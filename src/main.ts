import './styles.css';
import * as THREE from 'three';
import { PART_ORDER, SLOW_PARTS, type PartKey } from './core/catalog';
import { Controls, type Action } from './core/controls';
import { bodyHeightAt, createBody, stepSuspension, type CornerBumps } from './core/suspension';
import { CORNERS, TZ, XF } from './core/dims';
import { activeFlows } from './core/flow';
import { clamp, ease, frameStep, lerp } from './core/math';
import { RideMeter } from './core/ride';
import { groundHeight } from './core/terrain';
import { createDrive, stepDrive, wheelWorld } from './core/vehicle';
import { ANT_TIP, buildCar } from './model/car';
import { allMeshes, applyHighlight, GHOST, isShown, PARTS, pulseHighlight } from './model/parts';
import { poseCar } from './scene/carMotion';
import { createGround } from './scene/ground';
import { createRemote } from './scene/remote';
import { RingPool } from './scene/rings';
import { createStage, syncTheme, type Stage } from './scene/stage';
import { MotorSound } from './ui/audio';
import { $ } from './ui/dom';
import { FlowStrip } from './ui/flowStrip';
import { LabelLayer } from './ui/labels';
import { RideGraph } from './ui/rideGraph';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const bay = $('bay');
const carCanvas = $<HTMLCanvasElement>('car');
const remoteCanvas = $<HTMLCanvasElement>('remote');

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
const remote = createRemote(remoteCanvas);
const carRings = new RingPool(scene, 0x4f8cff, 2.4);
const remoteRings = new RingPool(remote.scene, 0x6aa0ff, 3.2);

/* ---------------- state ---------------- */
const input = new Controls();
const drive = createDrive();
const body = createBody();
const ride = new RideMeter();
const sound = new MotorSound();
const ui = { lights: true, slow: false, slowManual: false, locked: false, explodeT: 0, explode: 0, timeScale: 1, selected: null as PartKey | null, ringClock: 0 };

// Dev server only (stripped from production builds): lets scripted screenshots set the camera and state.
if (import.meta.env.DEV) Object.assign(window, { __app: { THREE, scene, camera, orbit, car, ui, input, drive } });

/* ---------------- selection & camera ---------------- */
let camTween: { t: number; dur: number; fT: THREE.Vector3; tT: THREE.Vector3; fP: THREE.Vector3; tP: THREE.Vector3 } | null = null;
orbit.addEventListener('start', () => { camTween = null; });
const tweenTo = (target: THREE.Vector3, pos: THREE.Vector3) => {
  camTween = { t: 0, dur: reduceMotion ? 0.01 : 0.9, fT: orbit.target.clone(), tT: target, fP: camera.position.clone(), tP: pos };
};
const viewDir = (minY: number, setY: number) => {
  const d = camera.position.clone().sub(orbit.target).normalize();
  if (d.y < minY) { d.y = setY; d.normalize(); }
  return d;
};
function focusHome(e: number) {
  const t = new THREE.Vector3(0, 4.6 + e * 6, 0);
  tweenTo(t, t.clone().addScaledVector(viewDir(0.2, 0.35), lerp(48, 70, e) * stage.fitK()));
}
function focusPart(k: PartKey) {
  car.root.updateMatrixWorld(true);
  const b = new THREE.Box3();
  for (const m of PARTS[k].meshes) if (m.visible) b.expandByObject(m);
  if (b.isEmpty()) return;
  const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length();
  tweenTo(c, c.clone().addScaledVector(viewDir(0.25, 0.4), clamp(size * 1.9, 14, 80) * stage.fitK()));
}

const labels = new LabelLayer($('labels'), (k) => select(k));
const flow = new FlowStrip($('flow'), (k) => select(k));
const rideGraph = new RideGraph($('ride'), $<HTMLCanvasElement>('ride-c'), $('ride-feel'));

function renderInfo() {
  const el = $('info'), k = ui.selected;
  if (!k) {
    el.innerHTML = `<h3>Shuttle 08 off-road buggy</h3><p class="kid">Hold <b>Forward</b> to drive. Turn the wheel to steer. Tap any part of the car to look closer.</p><ul class="facts"><li>1:16 scale</li><li>2WD rear drive</li><li>2.4 GHz radio</li><li>20 km/h</li><li>3.7 V battery</li><li>~45 min</li></ul><p class="adult"><b>For grown-ups</b>The outside is modelled on the seller's photos and size chart. Nobody publishes schematics for this toy, so the inside shows how these generic 1:16 buggies are normally built.</p>`;
    return;
  }
  const p = PARTS[k];
  el.innerHTML = `<h3>${p.title}</h3><p class="kid">${p.kid}</p><p class="adult"><b>For grown-ups</b>${p.adult}</p>`;
}

function select(k: PartKey | null) {
  ui.selected = k;
  for (const kk of PART_ORDER) $(`chip-${kk}`).setAttribute('aria-pressed', String(kk === k));
  $('chip-all').setAttribute('aria-pressed', String(!k));
  applyHighlight(k); renderInfo(); labels.setSelected(k);
  if (k && SLOW_PARTS.includes(k) && !ui.slowManual) setToggle('slow', true);
  if (!k && ui.explodeT < 0.05 && !ui.slowManual) setToggle('slow', false);
  if (k) focusPart(k); else focusHome(ui.explodeT);
}

/* ---------------- panel controls ---------------- */
type Toggle = 'cruise' | 'lights' | 'slow' | 'sound';
const TOGGLE_IDS: Record<Toggle, string> = { cruise: 't-cruise', lights: 't-lights', slow: 't-slow', sound: 't-sound' };
function setToggle(name: Toggle, val: boolean) {
  if (name === 'cruise') { input.cruise = val; if (val) sound.start(); syncHoldButtons(); }
  else if (name === 'sound') { sound.enabled = val; if (!val) sound.mute(); }
  else ui[name] = val;
  $(TOGGLE_IDS[name]).setAttribute('aria-pressed', String(val));
}
$('t-cruise').onclick = () => setToggle('cruise', !input.cruise);
$('t-lights').onclick = () => setToggle('lights', !ui.lights);
$('t-slow').onclick = () => { ui.slowManual = true; setToggle('slow', !ui.slow); };
$('t-sound').onclick = () => setToggle('sound', !sound.enabled);

const holdButtons = [...document.querySelectorAll<HTMLButtonElement>('.hold')];
function syncHoldButtons() {
  for (const b of holdButtons) { const a = b.dataset.act as Action; b.classList.toggle('on', input.isHeld(a) || (a === 'fwd' && input.cruise)); }
}
const press = (a: Action, src: string) => { sound.start(); input.press(a, src); syncHoldButtons(); };
const release = (a: Action, src: string) => { input.release(a, src); syncHoldButtons(); };
for (const b of holdButtons) {
  const a = b.dataset.act as Action;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); press(a, 'btn'); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => release(a, 'btn'));
  b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(a, 'btnkey'); } });
  b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') release(a, 'btnkey'); });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}
const KEYS: Record<string, Action> = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('input')) return;
  const a = KEYS[e.code];
  if (a) { e.preventDefault(); if (!e.repeat) press(a, `key:${e.code}`); }
  else if (e.code === 'KeyL' && !e.repeat) setToggle('lights', !ui.lights);
  else if (e.code === 'KeyE' && !e.repeat) setExplode(ui.explodeT > 0.5 ? 0 : 1);
});
addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) release(a, `key:${e.code}`); });
addEventListener('blur', () => { input.clear(); syncHoldButtons(); });

const slider = $<HTMLInputElement>('explode'), bExplode = $('b-explode');
function setExplode(t: number, fromSlider = false) {
  ui.explodeT = t;
  if (!fromSlider) slider.value = String(Math.round(t * 100));
  bExplode.setAttribute('aria-pressed', String(t > 0.5));
  bExplode.textContent = t > 0.5 ? 'Put it together' : 'Take it apart';
  if (t > 0.05 && !ui.slow && !ui.slowManual) setToggle('slow', true);
  if (t <= 0.05 && ui.slow && !ui.slowManual && !(ui.selected && SLOW_PARTS.includes(ui.selected))) setToggle('slow', false);
  if (!ui.selected) focusHome(t);
}
bExplode.onclick = () => setExplode(ui.explodeT > 0.5 ? 0 : 1);
slider.addEventListener('input', () => setExplode(Number(slider.value) / 100, true));

const chips = $('chips');
for (const k of PART_ORDER) {
  const b = document.createElement('button');
  b.className = 'chip'; b.id = `chip-${k}`; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = `<i style="--c:${PARTS[k].color}"></i><span>${PARTS[k].chip}</span>`;
  b.onclick = () => select(ui.selected === k ? null : k);
  chips.append(b);
}
{
  const b = document.createElement('button');
  b.className = 'chip'; b.id = 'chip-all'; b.setAttribute('aria-pressed', 'true');
  b.innerHTML = '<i style="--c:var(--ink)"></i><span>Whole car</span>';
  b.onclick = () => select(null);
  chips.append(b);
}
$('b-reset').onclick = () => { select(null); focusHome(ui.explodeT); };

const dRough = $('d-rough'), dLock = $('d-lock');
dRough.onclick = () => {
  ground.rough = !ground.rough;
  dRough.setAttribute('aria-pressed', String(ground.rough));
  ground.reshape();
  if (ground.rough) {
    sound.start();
    if (!input.cruise && !input.isHeld('fwd')) setToggle('cruise', true);
    if (ui.explodeT > 0.05) setExplode(0);
    if (!ui.selected) { const t = new THREE.Vector3(0, 4.2, 0); tweenTo(t, t.clone().add(new THREE.Vector3(6, 6, 40).multiplyScalar(stage.fitK()))); }
  }
};
dLock.onclick = () => {
  ui.locked = !ui.locked;
  dLock.setAttribute('aria-pressed', String(ui.locked));
  dLock.textContent = ui.locked ? 'Unlock the springs' : 'Lock the springs';
};

/* ---------------- picking parts in 3D ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hitsAt(cx: number, cy: number, canvas: HTMLCanvasElement, cam: THREE.Camera, list: THREE.Object3D[]) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  return ray.intersectObjects(list, false);
}
function pickPart(cx: number, cy: number): PartKey | null {
  const hits = hitsAt(cx, cy, carCanvas, camera, allMeshes.filter((m) => isShown(m)));
  const h = hits.find((x) => (x.object as THREE.Mesh).material !== GHOST) ?? hits[0];
  return h ? (h.object.userData.part as PartKey) : null;
}
let downAt: { x: number; y: number } | null = null;
carCanvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
carCanvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved < 6) { const k = pickPart(e.clientX, e.clientY); if (k) select(k === ui.selected ? null : k); }
});
carCanvas.addEventListener('pointermove', (e) => { if (!e.buttons) carCanvas.classList.toggle('picking', !!pickPart(e.clientX, e.clientY)); });

/* ---------------- the 3D remote: drag the wheel, hold the trigger ---------------- */
let wheelGrab: { cx: number; cy: number; a0: number } | null = null;
let triggerHeld = false;
const angleFrom = (g: { cx: number; cy: number }, x: number, y: number) => Math.atan2(-(y - g.cy), x - g.cx);
remoteCanvas.addEventListener('pointerdown', (e) => {
  const hit = hitsAt(e.clientX, e.clientY, remoteCanvas, remote.camera, remote.controls)[0];
  if (!hit) return;
  e.preventDefault(); remoteCanvas.setPointerCapture(e.pointerId); sound.start();
  if (hit.object.userData.ctrl === 'trigger') { triggerHeld = true; press('fwd', 'remote'); return; }
  const p = remote.wheel.getWorldPosition(new THREE.Vector3()).project(remote.camera), r = remoteCanvas.getBoundingClientRect();
  const c = { cx: r.left + ((p.x + 1) / 2) * r.width, cy: r.top + ((1 - p.y) / 2) * r.height };
  wheelGrab = { ...c, a0: angleFrom(c, e.clientX, e.clientY) };
  input.wheelDrag = 0;
});
remoteCanvas.addEventListener('pointermove', (e) => {
  if (wheelGrab) {
    let d = angleFrom(wheelGrab, e.clientX, e.clientY) - wheelGrab.a0;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    input.wheelDrag = clamp(d / 0.6, -1, 1);
    return;
  }
  const hit = hitsAt(e.clientX, e.clientY, remoteCanvas, remote.camera, remote.controls)[0];
  remoteCanvas.style.cursor = hit ? (hit.object.userData.ctrl === 'wheel' ? 'grab' : 'pointer') : 'default';
});
const remoteUp = () => {
  if (triggerHeld) { triggerHeld = false; release('fwd', 'remote'); }
  wheelGrab = null; input.wheelDrag = null;
};
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) remoteCanvas.addEventListener(ev, remoteUp);

/* ---------------- theme & size ---------------- */
const theme = () => syncTheme(scene, ground.material);
theme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const resize = () => { stage.resize(bay.clientWidth, bay.clientHeight); remote.resize(remoteCanvas.clientWidth, remoteCanvas.clientHeight); };
new ResizeObserver(resize).observe(bay);
new ResizeObserver(resize).observe(remoteCanvas);
resize();
camera.position.copy(stage.home.target).add(stage.home.pos.clone().sub(stage.home.target).multiplyScalar(stage.fitK()));
void car.decalsReady.then(() => applyHighlight(ui.selected));

/* ---------------- frame loop ---------------- */
const ledDot = $('led-dot'), gNum = $('g-num'), gNeedle = $('g-needle'), gArc = $('g-arc');
let last = performance.now();
function frame(now: number) {
  const rdt = frameStep(now, last);
  last = now;
  ui.timeScale = lerp(ui.timeScale, ui.slow ? 0.15 : 1, Math.min(1, rdt * 5));
  const dt = rdt * ui.timeScale;
  ui.explode += (ui.explodeT - ui.explode) * Math.min(1, rdt * (reduceMotion ? 30 : 3.2));
  const e = ease(clamp(ui.explode, 0, 1)), onStand = ui.explode > 0.02;

  const thr = input.throttleTarget(), steer = input.steerTarget();
  const { accel } = stepDrive(drive, thr, steer, dt, onStand);
  ground.follow(drive.pose);

  const bumps = {} as CornerBumps;
  for (const c of CORNERS) { const [wx, wz] = wheelWorld(drive.pose, c.x, c.z); bumps[c.key] = onStand ? 0 : groundHeight(wx, wz, ground.rough); }
  stepSuspension(body, bumps, { locked: ui.locked, accel, v: drive.v, steer: drive.steer, dt });
  ride.sample(dt, bumps.FL, bodyHeightAt(body, XF, -TZ), onStand);

  poseCar(car, { drive, body, bumps, explode: e, explodeRaw: ui.explode, onStand, lights: ui.lights, selected: ui.selected, dt });
  if (ui.selected) pulseHighlight(ui.selected, now / 1000);

  // radio rings from both antennas while a command is being sent
  const commanding = input.commanding();
  ui.ringClock += rdt;
  if (commanding && ui.ringClock > 0.32) {
    ui.ringClock = 0;
    car.root.updateMatrixWorld(true);
    if (!ui.selected || ui.selected === 'board') carRings.emit(ANT_TIP.clone().applyMatrix4(car.pieces.board.matrixWorld));
    remoteRings.emit(remote.antennaTip.getWorldPosition(new THREE.Vector3()));
  }
  carRings.update(rdt, camera);
  remoteRings.update(rdt, remote.camera);

  // the remote shows what the hands are doing
  remote.wheel.rotation.z = lerp(remote.wheel.rotation.z, steer * 0.6, Math.min(1, rdt * 14));
  remote.trigger.rotation.z = lerp(remote.trigger.rotation.z, thr > 0 ? -0.32 : thr < 0 ? 0.24 : 0, Math.min(1, rdt * 14));
  const blink = commanding ? (Math.sin((now / 1000) * Math.PI * 14) > 0 ? 2.6 : 0.3) : 1.6;
  remote.led.material.emissiveIntensity = blink;
  ledDot.style.opacity = String(commanding ? (blink > 1 ? 1 : 0.25) : 1);

  // speedometer shows real-size speed
  const kmh = Math.abs(drive.throttle) * 20;
  gNum.textContent = String(Math.round(kmh));
  gNeedle.setAttribute('transform', `rotate(${-90 + (kmh / 20) * 180} 60 60)`);
  gArc.setAttribute('stroke-dasharray', `${(kmh / 20) * 100} 100`);
  gArc.style.opacity = kmh > 0.3 ? '1' : '0';

  flow.tick(rdt, activeFlows(thr, steer));
  sound.update(drive.throttle, drive.steerVel, ui.timeScale);

  if (camTween) {
    camTween.t += rdt / camTween.dur;
    const k = ease(Math.min(1, camTween.t));
    orbit.target.lerpVectors(camTween.fT, camTween.tT, k);
    camera.position.lerpVectors(camTween.fP, camTween.tP, k);
    if (camTween.t >= 1) camTween = null;
  }
  orbit.update();
  stage.followTarget();

  car.root.updateMatrixWorld(true);
  labels.update(car, camera, bay.clientWidth, bay.clientHeight, ui.explode > 0.55, ui.selected, rdt);
  rideGraph.draw(ride, ground.rough || ui.locked);

  stage.renderer.render(scene, camera);
  remote.renderer.render(remote.scene, remote.camera);
  requestAnimationFrame(frame);
}
renderInfo();
requestAnimationFrame(frame);
