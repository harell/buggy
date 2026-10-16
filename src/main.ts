import './styles.css';
import * as THREE from 'three';
import { COMPS, type CompKey } from './core/components';
import { canHide, FAMILIES, FAMILY_ORDER, litComps, stageOf, SYSTEM_ORDER, systemComps, systemFor, SYSTEMS, type Control, type Form, type SystemKey } from './core/systems';
import { bodyHeightAt, createBody, stepSuspension, type CornerBumps } from './core/suspension';
import { CORNERS, TZ, XF } from './core/dims';
import { clamp, ease, frameStep, lerp } from './core/math';
import { RideMeter } from './core/ride';
import { groundHeight } from './core/terrain';
import { createDrive, stepDrive, wheelWorld } from './core/vehicle';
import { buildCar } from './model/car';
import { allMeshes, applyView, compOf, compSolid, GHOST, isShown, quietShadows, type PartMesh } from './model/parts';
import { poseCar } from './scene/carMotion';
import { createGround } from './scene/ground';
import { createStage, syncTheme, type Stage } from './scene/stage';
import { $ } from './ui/dom';
import { LabelLayer } from './ui/labels';
import { RideGraph } from './ui/rideGraph';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** What pointing at something is called here: a tap on a touch screen, a click with a mouse. */
const TAP = matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click';
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
/** Motion state a system starts from: driving forward on rough ground with the lights on. */
const MOTION: Record<Control, boolean> = { go: true, reverse: false, weave: false, rough: true, locked: false, trace: false, lights: true };
const ui = {
  ...MOTION, slow: false, timeScale: 1, weaveClock: 0, shift: 0,
  /** The system on show (null: the whole car, solid), and the steps of its chain made see-through. */
  system: 'go' as SystemKey | null, hidden: new Set<number>(),
  spot: new Set<CompKey>(),
};

// Dev server only (stripped from production builds): lets scripted screenshots set the camera and state.
if (import.meta.env.DEV) Object.assign(window, { __app: { THREE, scene, camera, orbit, car, ui, drive, stage, show } });

/* ---------------- camera ---------------- */
let camTween: { t: number; dur: number; fT: THREE.Vector3; tT: THREE.Vector3; fP: THREE.Vector3; tP: THREE.Vector3 } | null = null;
orbit.addEventListener('start', () => { camTween = null; });
const tweenTo = (target: THREE.Vector3, pos: THREE.Vector3) => {
  camTween = { t: 0, dur: reduceMotion ? 0.01 : 0.9, fT: orbit.target.clone(), tT: target, fP: camera.position.clone(), tP: pos };
};
const HOME_VIEW = new THREE.Vector3(0.62, 0.38, 0.69).normalize();
/** Frame the system on show, all of its steps, from its own viewpoint (or the whole car from the 3/4 view). */
function frame() {
  if (!ui.system) {
    const t = new THREE.Vector3(0, 4.6, 0);
    tweenTo(t, t.clone().addScaledVector(HOME_VIEW, 40 * stage.fitK()));
    return;
  }
  car.root.updateMatrixWorld(true);
  const b = new THREE.Box3(), comps = new Set(systemComps(ui.system));
  for (const m of allMeshes) if (isShown(m) && compOf(m) !== 'wires' && comps.has(compOf(m))) b.expandByObject(m);
  const dir = new THREE.Vector3(...SYSTEMS[ui.system].view).normalize();
  const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length();
  tweenTo(c, c.clone().addScaledVector(dir, clamp(size * 1.35, 24, 60) * stage.fitK()));
}

/* ---------------- the system shelf ---------------- */
$('shelf-body').innerHTML = FAMILY_ORDER.map((f) =>
  `<section class="fam"><span class="kind ${f}">${FAMILIES[f]}</span>${SYSTEM_ORDER.filter((k) => SYSTEMS[k].family === f).map((k) =>
    `<button class="sys" data-sys="${k}" title="${SYSTEMS[k].question}"><b>${SYSTEMS[k].name}</b><span>${SYSTEMS[k].line}</span></button>`).join('')}</section>`).join('');
$('shelf').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-sys]');
  if (b) show(b.dataset.sys as SystemKey);
});
$('b-whole').onclick = () => show(null);
// on a phone the shelf gives way to one row of tabs, a family's colour on each, so switching never covers the car;
// "Whole car", the way back, stays put while the systems scroll
$('tabs').innerHTML = '<button class="tab whole" id="t-whole">Whole car</button><span class="sep" aria-hidden="true"></span><div class="tab-row" id="tab-row">'
  + FAMILY_ORDER.map((f, i) => (i ? '<span class="sep" aria-hidden="true"></span>' : '') + SYSTEM_ORDER.filter((k) => SYSTEMS[k].family === f).map((k) =>
    `<button class="tab ${f}" data-sys="${k}" title="${SYSTEMS[k].question}">${SYSTEMS[k].name}</button>`).join('')).join('') + '</div>';
$('tabs').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('button');
  if (b) show(b.id === 't-whole' ? null : b.dataset.sys as SystemKey);
});
/** Fade either end of a row that scrolls sideways while there is more of it to see that way. */
const edgeFade = (el: HTMLElement) => {
  const mark = () => {
    el.classList.toggle('more-l', el.scrollLeft > 2);
    el.classList.toggle('more-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };
  el.addEventListener('scroll', mark, { passive: true });
  new ResizeObserver(mark).observe(el);
  return mark;
};
const fadeTabs = edgeFade($('tab-row')), fadeChain = edgeFade($('chain'));
/** Scroll a row sideways so `item` sits in its middle. */
const centreIn = (row: HTMLElement, item: HTMLElement) =>
  row.scrollTo({ left: item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
$('b-shelf').onclick = () => {
  const open = $('shelf-body').hidden;
  $('shelf-body').hidden = !open; $('b-shelf').setAttribute('aria-expanded', String(open));
};

/** Show a system (or the whole car): every step solid, its own motion state and controls, its own viewpoint. Picking the one on show again re-frames it. */
function show(k: SystemKey | null) {
  if (k !== ui.system) {
    ui.system = k; ui.hidden.clear();
    Object.assign(ui, MOTION, k ? SYSTEMS[k].starts : {});
    ui.weaveClock = 0; ground.rough = ui.rough; ground.reshape();
    renderDock();
  }
  refresh();
  frame();
}

/* ---------------- the chain and its controls ---------------- */
const FORM: Record<Form, string> = { stored: 'stored', electric: 'electric', light: 'light', spin: 'electric → spin', movement: 'movement' };
const CONTROL_TIPS: Record<Control, string> = {
  go: 'Run the motors, or stop', reverse: 'Swap + and − so the motor turns the other way', weave: 'Steer full left and right in turn',
  rough: 'Rough ground or a smooth track', locked: 'Bolt the body to the wheels, as if there were no springs', trace: 'Graph one front wheel’s bumps against the body above it',
  lights: 'Switch the light bar on or off',
};
function renderDock() {
  const s = ui.system ? SYSTEMS[ui.system] : null;
  $('dock-head').innerHTML = s
    ? `<span class="kind ${s.family}">${FAMILIES[s.family]}</span><b>${s.name}</b><span class="hint">${TAP} a step, a part or its name tag to make it see-through</span><span class="hint-short">${TAP} a step or part to see through it</span>`
    : `<b>The whole car</b><span class="hint">Pick a system, or ${TAP.toLowerCase()} a part to see the system it works in</span><span class="hint-short">${TAP} a part to find its system</span>`;
  $('chain').innerHTML = s ? s.stages.map((st, i) =>
    `${i ? '<span class="arr" aria-hidden="true">›</span>' : ''}<button class="step" data-step="${i}" aria-pressed="true" title="Make the ${st.name.toLowerCase()} see-through"><b>${st.name}</b><i class="f-${st.form}">${FORM[st.form]}</i></button>`).join('')
    + '<button class="mini" id="b-all" hidden>Show all</button>' : '';
  const ctl = s ? s.controls : ([['go', 'Driving'], ['rough', 'Rough ground']] as const);
  $('controls').innerHTML = [...ctl, ['slow', 'Slow-mo'] as const].map(([key, label]) =>
    `<button class="tog" data-ctl="${key}" aria-pressed="${ui[key]}" title="${key === 'slow' ? 'Slow everything down' : CONTROL_TIPS[key]}">${label}</button>`).join('');
  $('chain').scrollLeft = 0; fadeChain();
}
$('chain').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('button');
  if (!b) return;
  if (b.id === 'b-all') { ui.hidden.clear(); refresh(); } else if (b.dataset.step) toggleStep(Number(b.dataset.step));
});
$('controls').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-ctl]');
  if (!b) return;
  const key = b.dataset.ctl as Control | 'slow';
  ui[key] = !ui[key]; b.setAttribute('aria-pressed', String(ui[key]));
  if (key === 'weave') ui.weaveClock = 0;
  if (key === 'rough') { ground.rough = ui.rough; ground.reshape(); }
});

/** Make a step of the chain see-through, or solid again. The camera stays put. */
function toggleStep(i: number) {
  if (!ui.system || !canHide(ui.system, ui.hidden, i)) return;
  if (ui.hidden.has(i)) ui.hidden.delete(i); else ui.hidden.add(i);
  refresh();
}
/** A click on a part or its tag: in the system on show, make its step see-through or solid; from the whole car, open its system. */
function pickPart(k: CompKey) {
  if (!ui.system) { const s = systemFor(k); if (s) show(s); return; }
  const i = stageOf(ui.system, k);
  if (i < 0) return;
  toggleStep(i);
  // bring its step into view, so a narrow chain shows what the tap changed
  const step = $('chain').querySelector<HTMLElement>(`[data-step="${i}"]`);
  if (step) centreIn($('chain'), step);
}

/** Bring the 3D view, the shelf and the chain in line with the state. */
function refresh() {
  ui.spot = new Set(ui.system ? litComps(ui.system, ui.hidden) : []);
  applyView({ spot: ui.spot, removed: new Set() });
  for (const b of document.querySelectorAll<HTMLElement>('[data-sys]')) b.setAttribute('aria-pressed', String(b.dataset.sys === ui.system));
  $('b-whole').toggleAttribute('disabled', !ui.system);
  $('t-whole').setAttribute('aria-pressed', String(!ui.system));
  const tab = $('tab-row').querySelector<HTMLElement>('[aria-pressed="true"]');
  if (tab && $('tabs').offsetParent) { centreIn($('tab-row'), tab); fadeTabs(); }
  if (!ui.system) return;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-step]')) {
    const i = Number(b.dataset.step), on = !ui.hidden.has(i);
    b.setAttribute('aria-pressed', String(on));
    b.disabled = !canHide(ui.system, ui.hidden, i);
    b.title = `Make the ${SYSTEMS[ui.system].stages[i].name.toLowerCase()} ${on ? 'see-through' : 'solid again'}`;
  }
  $('b-all').hidden = ui.hidden.size === 0;
}

/* ---------------- picking parts in 3D ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickComp(cx: number, cy: number): CompKey | null {
  const r = carCanvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(allMeshes.filter((m) => isShown(m)), false);
  // a part of the system on show wins over what is in front of it, so see-through steps can be clicked back; on the whole
  // car, a part that works in some system wins over the panels around it, so a tap on the car always opens something
  const mine = hits.find((x) => { const k = compOf(x.object as PartMesh); return ui.system ? stageOf(ui.system, k) >= 0 : !!systemFor(k); });
  const h = mine ?? hits.find((x) => (x.object as THREE.Mesh).material !== GHOST) ?? hits[0];
  return h ? compOf(h.object as PartMesh) : null;
}
const clickable = (k: CompKey | null): k is CompKey => !!k && (ui.system ? stageOf(ui.system, k) >= 0 : !!systemFor(k));
let downAt: { x: number; y: number } | null = null;
carCanvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
carCanvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved < 6) { const k = pickComp(e.clientX, e.clientY); if (clickable(k)) pickPart(k); }
});
let hoverAt = 0;
carCanvas.addEventListener('pointermove', (e) => {
  if (e.buttons || e.timeStamp - hoverAt < 80) return; // picking costs a raycast against every mesh: not every move
  hoverAt = e.timeStamp;
  const k = pickComp(e.clientX, e.clientY), ok = clickable(k);
  carCanvas.classList.toggle('picking', ok);
  carCanvas.title = ok ? COMPS[k].name : '';
});

const labels = new LabelLayer($('labels'), pickPart);
const rideGraph = new RideGraph($('ride'), $<HTMLCanvasElement>('ride-c'), $('ride-feel'));

/* ---------------- theme & size ---------------- */
renderDock(); // first, so the dock has its height when the camera is fitted between the panels
const theme = () => syncTheme(scene, ground.material);
theme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const resize = () => stage.resize(bay.clientWidth, bay.clientHeight);
new ResizeObserver(resize).observe(bay);
resize();
// turning a phone round changes the picture's shape a lot: once it settles, frame the system afresh
let aspectFramed = bay.clientWidth / bay.clientHeight, reframeAt = 0;
new ResizeObserver(() => {
  clearTimeout(reframeAt);
  reframeAt = window.setTimeout(() => {
    const a = bay.clientWidth / bay.clientHeight;
    if (Math.abs(Math.log(a / aspectFramed)) < 0.25) return;
    aspectFramed = a; inset = panelInsets(); stage.setInsets(inset.t, inset.b); frame();
  }, 250);
}).observe(bay);
// the panels are the app, not a page: a pinch on them should not zoom the page (Safari's own gesture event)
document.addEventListener('gesturestart', (e) => e.preventDefault());
/** On a phone, the picture height taken by the tabs (and a full-width ride trace under them) above the car, and the dock below it (none elsewhere). */
const tabs = $('tabs'), dock = $('dock'), rideBox = $('ride');
const panelInsets = () => {
  if (!tabs.offsetParent) return { t: 0, b: 0 };
  const over = rideBox.offsetParent && rideBox.offsetWidth > bay.clientWidth / 2 ? rideBox : tabs;
  return { t: over.offsetTop + over.offsetHeight, b: bay.clientHeight - dock.offsetTop };
};
let inset = panelInsets();
stage.setInsets(inset.t, inset.b);
camera.position.copy(stage.home.target).add(stage.home.pos.clone().sub(stage.home.target).multiplyScalar(stage.fitK()));
void car.decalsReady.then(refresh);

/* ---------------- frame loop ---------------- */
/** Weave: full left, straight, full right, straight, each for this long (s). */
const WEAVE_STEP = 1.6;
const unlit = (cs: readonly CompKey[]) => new Set(cs.filter((k) => !ui.spot.has(k)));
const shelf = $('shelf'), shelfBody = $('shelf-body');
let last = performance.now();
function tick(now: number) {
  const rdt = frameStep(now, last);
  last = now;
  ui.timeScale = lerp(ui.timeScale, ui.slow ? 0.15 : 1, Math.min(1, rdt * 5));
  const dt = rdt * ui.timeScale;

  // the car drives on by itself, and steers by itself while weaving (standing still, it still turns its wheels)
  ui.weaveClock += dt;
  const steer = ui.weave ? ([1, 0, -1, 0] as const)[Math.floor(ui.weaveClock / WEAVE_STEP) % 4] : 0;
  const { accel } = stepDrive(drive, ui.go ? (ui.reverse ? -1 : 1) : 0, steer, dt, false);
  ground.follow(drive.pose);

  const bumps = {} as CornerBumps;
  for (const c of CORNERS) { const [wx, wz] = wheelWorld(drive.pose, c.x, c.z); bumps[c.key] = groundHeight(wx, wz, ground.rough); }
  stepSuspension(body, bumps, { locked: ui.locked, accel, v: drive.v, steer: drive.steer, dt });
  ride.sample(dt, bumps.FL, bodyHeightAt(body, XF, -TZ), false);

  const springTint = ui.system !== null && (ui.spot.has('shocksF') || ui.spot.has('shocksR'));
  poseCar(car, { drive, body, bumps, explode: 0, explodeRaw: 0, onStand: false, lights: ui.lights, ledGlows: compSolid('lightBar'), steerHeld: steer, springTint, dt });

  if (camTween) {
    camTween.t += rdt / camTween.dur;
    const k = ease(Math.min(1, camTween.t));
    orbit.target.lerpVectors(camTween.fT, camTween.tT, k);
    camera.position.lerpVectors(camTween.fP, camTween.tP, k);
    if (camTween.t >= 1) camTween = null;
  }
  // keep what the camera looks at clear of the shelf on the left (on narrow screens the shelf folds over the car instead),
  // and on a phone, between the tabs above and the dock below
  const follow = Math.min(1, rdt * (reduceMotion ? 30 : 6)), want = panelInsets();
  // and on a phone on its side, left of the ride trace
  const wide = bay.clientWidth > 900 && !shelfBody.hidden && shelf.offsetParent !== null;
  const besideRide = tabs.offsetParent && rideBox.offsetParent && rideBox.offsetWidth < bay.clientWidth / 2;
  ui.shift = lerp(ui.shift, wide ? (shelf.offsetWidth + 14) / 2 : besideRide ? -(rideBox.offsetWidth + 8) / 2 : 0, follow);
  inset = { t: lerp(inset.t, want.t, follow), b: lerp(inset.b, want.b, follow) };
  stage.setShift(ui.shift);
  stage.setInsets(inset.t, inset.b);
  orbit.update();
  stage.followTarget();

  car.root.updateMatrixWorld(true);
  const sys = ui.system ? systemComps(ui.system) : [];
  labels.update(camera, bay.clientWidth, bay.clientHeight, sys, rdt, unlit(sys), want.t); // chain order, so hiding a step never reshuffles the tags
  rideGraph.draw(ride, ui.trace);

  stage.renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
refresh();
requestAnimationFrame(tick);
