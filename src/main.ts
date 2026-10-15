import './styles.css';
import * as THREE from 'three';
import { SLOW_PARTS, type PartKey } from './core/catalog';
import { Controls, type Action } from './core/controls';
import { createBody, stepSuspension, type CornerBumps } from './core/suspension';
import { CORNERS } from './core/dims';
import {
  FOCUS, FOCUS_ORDER, focusOfPart, isAllTogether, QUESTIONS, stepFocus, WALK_START, walkNext, walkPrev, WALKS,
  type Cast, type FocusKey, type Question, type RunAction, type WalkKey, type WalkPos, type WhatIfId,
} from './core/lesson';
import { clamp, ease, frameStep, lerp } from './core/math';
import { groundHeight } from './core/terrain';
import { createDrive, stepDrive, wheelWorld } from './core/vehicle';
import { ANT_TIP, buildCar } from './model/car';
import { allMeshes, applyFocus, GHOST, isShown, PARTS, pulseHighlight, quietShadows, setApart } from './model/parts';
import { poseCar } from './scene/carMotion';
import { createGround } from './scene/ground';
import { createRemote, ctrlOf, WHEEL_TURN } from './scene/remote';
import { RingPool } from './scene/rings';
import { createStage, syncTheme, type Stage } from './scene/stage';
import { MotorSound } from './ui/audio';
import { $ } from './ui/dom';
import { LabelLayer } from './ui/labels';
import { bigcapHTML, captionHTML, crumbsHTML, endHTML, notesHTML, questionsHTML, stepsHTML, walksHTML } from './ui/lessonView';

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
ground.rough = true; ground.reshape(); // the bumpy track is always the backdrop
const car = buildCar(scene);
// shadows nobody would see: tiny parts, and what is shut inside the gearbox, the motor can, the steering box and the tub
quietShadows(0.3, [car.pieces.gear1, car.driveGears.fg, car.driveGears.axle, car.pieces.motor, car.pieces.steerBox, car.pieces.board, car.pieces.battery]);
const remote = createRemote(remoteCanvas);
const carRings = new RingPool(scene, 0x4f8cff, 2.4);
const remoteRings = new RingPool(remote.scene, 0x6aa0ff, 3.2);

/* ---------------- state ---------------- */
const input = new Controls();
const drive = createDrive();
const body = createBody();
const sound = new MotorSound();
const ui = {
  lights: true, slow: false, slowManual: false, locked: false, explodeT: 0, explode: 0, timeScale: 1, ringClock: 0,
  /** What the grown-up is pointing at, and how the notes look. */
  focus: 'car' as FocusKey, question: null as Question | null, answer: false, whatIf: false, folded: false, child: false,
  panel: null as 'questions' | 'walks' | 'keys' | null,
  /** A guided walk, where each walk is up to, a part looked at off the walk, and whether the walk is running its part. */
  walk: null as WalkKey | null, walkPos: { go: WALK_START, turn: WALK_START, bounce: WALK_START } as Record<WalkKey, WalkPos>,
  offScript: null as FocusKey | null, walkRun: false, runClock: 0,
  seen: new Set<FocusKey>(['car']), seenQ: new Set<Question>(),
  shift: 0,
};

// Dev server only (stripped from production builds): lets scripted screenshots set the camera and state.
if (import.meta.env.DEV) Object.assign(window, { __app: { THREE, scene, camera, orbit, car, ui, input, drive, stage, remote } });

/* ---------------- what is on screen ---------------- */
/** The focus the 3D view shows: the walk's step, a part looked at off the walk, or the free focus. 'all' is the walk's last step. */
function viewFocus(): FocusKey | 'all' {
  if (ui.walk && !ui.offScript) {
    const w = WALKS[ui.walk], p = ui.walkPos[ui.walk];
    return isAllTogether(w, p) ? 'all' : w.steps[p.step].focus;
  }
  return ui.offScript ?? ui.focus;
}
const castOf = (v: FocusKey | 'all'): Cast | null => (v === 'all' ? WALKS[ui.walk!].all.cast : FOCUS[v].cast);
/** The what-if in effect: only the free focus has one switched on. */
const activeWhatIf = () => (!ui.walk && ui.whatIf ? FOCUS[ui.focus].whatIf.id : null);
/** Switched off or with the remote off, nothing the remote or the run button asks for reaches the motors. */
const blocked = () => { const w = activeWhatIf(); return w === 'switchOff' || w === 'remoteOff'; };
function runAction(): { action: RunAction; label: string } {
  const v = viewFocus();
  if (v === 'all') return { action: WALKS[ui.walk!].all.run, label: 'Run it all' };
  return FOCUS[v].run;
}

/* ---------------- camera ---------------- */
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
/** Frame some parts: the box round their visible meshes, seen from about where the camera already is. */
function frameParts(keys: readonly PartKey[], tight = 1.9) {
  car.root.updateMatrixWorld(true);
  const b = new THREE.Box3();
  for (const k of keys) for (const m of PARTS[k].meshes) if (m.visible && isShown(m)) b.expandByObject(m);
  if (b.isEmpty()) return;
  const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length();
  tweenTo(c, c.clone().addScaledVector(viewDir(0.25, 0.4), clamp(size * tight, 14, 80) * stage.fitK()));
}
function frameView() {
  const v = viewFocus();
  if (v === 'all') { const c = castOf(v); if (c) frameParts(c.parts.filter((k) => k !== 'wires'), 2.2); else focusHome(ui.explodeT); return; }
  const part = FOCUS[v].part;
  if (part) frameParts([part]); else focusHome(ui.explodeT);
}

/* ---------------- the what-ifs ---------------- */
let whatIfHeld: Action | null = null, lastWhatIf: WhatIfId | null = null;
/** Put the active what-if into effect, and undo the last one. */
function applyWhatIf() {
  const w = activeWhatIf();
  if (whatIfHeld) { input.release(whatIfHeld, 'whatif'); whatIfHeld = null; }
  const hold = w === 'reverse' ? 'back' : w === 'fullLock' ? 'left' : null;
  if (hold) { sound.start(); input.press(hold, 'whatif'); whatIfHeld = hold; }
  ui.locked = w === 'lockSprings';
  if (w === 'apart') setExplode(1);
  else if (lastWhatIf === 'apart') setExplode(0);
  lastWhatIf = w;
  autoSlow();
}
function autoSlow() {
  if (ui.slowManual) return;
  const v = viewFocus(), part = v === 'all' ? null : FOCUS[v].part;
  ui.slow = activeWhatIf() === 'slow' || ui.explodeT > 0.05 || (!!part && SLOW_PARTS.includes(part));
}

/* ---------------- changing what we look at ---------------- */
function setFocus(k: FocusKey, q: Question | null = null) {
  if (ui.walk) { ui.offScript = k === viewFocus() ? null : k; refresh(true); return; }
  const changed = k !== ui.focus;
  ui.focus = k; ui.question = q; ui.answer = false;
  ui.whatIf = q ? q.whatIf : changed ? false : ui.whatIf;
  ui.seen.add(k); if (q) ui.seenQ.add(q);
  if (ui.panel === 'questions' && q) ui.panel = null;
  applyWhatIf();
  refresh(true);
}
function startWalk(k: WalkKey) {
  if (ui.whatIf) { ui.whatIf = false; applyWhatIf(); }
  if (ui.walkPos[k].end) ui.walkPos[k] = WALK_START;
  ui.walk = k; ui.offScript = null; ui.panel = null; setWalkRun(false);
  if (ui.explodeT > 0.05) setExplode(0);
  refresh(true);
}
function endWalk() { setWalkRun(false); ui.walk = null; ui.offScript = null; ui.focus = 'car'; ui.question = null; refresh(true); }
function walkStep(d: 1 | -1) {
  const k = ui.walk!;
  if (ui.offScript) { ui.offScript = null; refresh(true); return; }
  const w = WALKS[k], before = ui.walkPos[k];
  const next = d > 0 ? walkNext(w, before) : walkPrev(w, before);
  if (next === 'nextWalk') { ui.walkPos[k] = WALK_START; startWalk(w.next); return; }
  ui.walkPos[k] = next;
  const moved = next.step !== before.step;
  if (moved) setWalkRun(false);
  refresh(moved);
}
function setWalkRun(on: boolean) {
  for (const a of ['fwd', 'back', 'left'] as const) input.release(a, 'walk');
  ui.walkRun = on; ui.runClock = 0;
  if (on) { sound.start(); input.press(runAction().action, 'walk'); }
}

/** Bring the 3D view, the panels and the notes in line with the state. */
function refresh(reframe: boolean) {
  const v = viewFocus();
  applyFocus(castOf(v));
  autoSlow();
  if (reframe) frameView();
  bay.classList.toggle('child', ui.child);
  // top left
  $('b-questions').setAttribute('aria-expanded', String(ui.panel === 'questions'));
  $('b-walk').setAttribute('aria-expanded', String(ui.panel === 'walks'));
  $('b-keys').setAttribute('aria-expanded', String(ui.panel === 'keys'));
  $('questions').hidden = ui.panel !== 'questions';
  $('walks').hidden = ui.panel !== 'walks';
  $('keys').hidden = ui.panel !== 'keys';
  if (ui.panel === 'questions') $('questions').innerHTML = questionsHTML(ui.question, ui.seenQ);
  const back = $('backchip');
  back.innerHTML = ui.walk ? `<button class="backchip" data-act="${ui.offScript ? 'backtowalk' : 'endwalk'}">${ui.offScript ? `↩ Back to the ${WALKS[ui.walk].name} walk <kbd>⌫</kbd>` : `✕ Leave the ${WALKS[ui.walk].name} walk <kbd>Esc</kbd>`}</button>` : '';
  // top centre
  const walking = !!ui.walk;
  $('crumbs').hidden = walking;
  $('steps').hidden = !walking;
  if (walking) $('steps').innerHTML = stepsHTML(ui.walk!, ui.walkPos[ui.walk!], !!ui.offScript, litSteps());
  else $('crumbs').innerHTML = crumbsHTML(ui.focus);
  // notes: the free focus, or the part looked at off the walk; a walk speaks through its caption
  const notesFocus = walking ? ui.offScript : ui.focus;
  const notes = $('notes');
  notes.hidden = ui.child || !notesFocus;
  notes.classList.toggle('folded', ui.folded);
  if (notesFocus) notes.innerHTML = notesHTML({ focus: notesFocus, question: walking ? null : ui.question, answer: ui.answer, whatIf: !walking && ui.whatIf, folded: ui.folded, noWhatIf: walking });
  // child view: one big line, the question to think about
  $('bigcap').hidden = !ui.child || (walking && !ui.offScript);
  if (ui.child) { const f = FOCUS[notesFocus ?? 'car']; $('bigcap').innerHTML = bigcapHTML(!walking && ui.question ? ui.question.text : f.ask, f.name); }
  // the walk's caption and its end
  const p = walking ? ui.walkPos[ui.walk!] : null;
  $('caption').hidden = !walking || !!ui.offScript || !!p?.end;
  $('endcard').hidden = !walking || !p?.end;
  if (walking && p && !ui.offScript && !p.end) $('caption').innerHTML = captionHTML(ui.walk!, p, ui.walkRun, runAction().label);
  if (walking && p?.end) $('endcard').innerHTML = endHTML(ui.walk!);
  // run button and the 3D tags
  $('b-run').textContent = `Hold · ${runAction().label}`;
  const part = v === 'all' ? null : FOCUS[v].part;
  labels.setSelected(part, new Set([...ui.seen].map((k) => FOCUS[k].part).filter((x): x is PartKey => !!x)));
}
const litSteps = () => (ui.walk && ui.walkRun && isAllTogether(WALKS[ui.walk], ui.walkPos[ui.walk]) ? Math.floor(ui.runClock * 1.6) % (WALKS[ui.walk].steps.length + 2) : -1);

const HOT_PARTS = new Set<PartKey>(FOCUS_ORDER.map((k) => FOCUS[k].part).filter((x): x is PartKey => !!x));
const labels = new LabelLayer($('labels'), (k) => { sound.start(); setFocus(focusOfPart(k)); });

/* ---------------- panel and notes clicks ---------------- */
const togglePanel = (p: 'questions' | 'walks' | 'keys') => { ui.panel = ui.panel === p ? null : p; refresh(false); };
$('b-questions').onclick = () => togglePanel('questions');
$('b-walk').onclick = () => togglePanel('walks');
$('b-keys').onclick = () => togglePanel('keys');
$('walks').innerHTML = walksHTML();
$('walks').addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLElement>('[data-walk]'); if (b) startWalk(b.dataset.walk as WalkKey); });
$('questions').addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLElement>('[data-q]'); if (b) { const q = QUESTIONS[Number(b.dataset.q)]; setFocus(q.focus, q); } });
const toggleWhatIf = () => { if (ui.walk) return; ui.whatIf = !ui.whatIf; applyWhatIf(); refresh(false); };
const toggleChild = () => { ui.child = !ui.child; $('b-child').setAttribute('aria-pressed', String(ui.child)); refresh(false); };
bay.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-act]');
  if (!b) return;
  switch (b.dataset.act) {
    case 'fold': ui.folded = !ui.folded; break;
    case 'answer': ui.answer = true; break;
    case 'whatif': toggleWhatIf(); return;
    case 'next': setFocus(stepFocus(ui.offScript ?? ui.focus, 1)); return;
    case 'home': setFocus('car'); return;
    case 'backtowalk': ui.offScript = null; refresh(true); return;
    case 'endwalk': endWalk(); return;
    case 'nextwalk': walkStep(1); return;
    case 'walkrun': setWalkRun(!ui.walkRun); break;
    default: return;
  }
  refresh(false);
});
$('steps').addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-step]');
  if (!b || !ui.walk) return;
  ui.offScript = null; ui.walkPos[ui.walk] = { step: Number(b.dataset.step), beat: 0, end: false }; setWalkRun(false); refresh(true);
});
$('b-child').onclick = toggleChild;
$('b-sound').onclick = () => { sound.enabled = !sound.enabled; if (!sound.enabled) sound.mute(); $('b-sound').setAttribute('aria-pressed', String(sound.enabled)); };

/* ---------------- driving: the remote, the run button, the keys ---------------- */
const press = (a: Action, src: string) => { sound.start(); input.press(a, src); };
const release = (a: Action, src: string) => { input.release(a, src); };
const runBtn = $<HTMLButtonElement>('b-run');
let runHeld: Action | null = null;
const runDown = () => { if (runHeld) return; runHeld = runAction().action; press(runHeld, 'run'); runBtn.setAttribute('aria-pressed', 'true'); };
const runUp = () => { if (runHeld) release(runHeld, 'run'); runHeld = null; runBtn.setAttribute('aria-pressed', 'false'); };
runBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); runBtn.setPointerCapture(e.pointerId); runDown(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) runBtn.addEventListener(ev, runUp);
runBtn.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); runDown(); } });
runBtn.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); runUp(); } });

function setLights(on: boolean) { ui.lights = on; pressLightsButton(); }
const DRIVE_KEYS: Record<string, Action> = { ArrowUp: 'fwd', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right' };
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof Element && e.target.closest('input, textarea'))) return;
  const k = e.key.toLowerCase();
  // a walk takes ← → and the clicker's keys; otherwise PageUp/PageDown step along the chain
  if (ui.walk && (e.key === 'ArrowRight' || e.key === 'PageDown')) walkStep(1);
  else if (ui.walk && (e.key === 'ArrowLeft' || e.key === 'PageUp')) walkStep(-1);
  else if (e.key === 'PageDown' || e.key === 'PageUp') setFocus(stepFocus(ui.offScript ?? ui.focus, e.key === 'PageDown' ? 1 : -1));
  else if (DRIVE_KEYS[e.key]) { if (!e.repeat) press(DRIVE_KEYS[e.key], `key:${e.key}`); }
  else if (e.key === ' ') { if (!e.repeat && (e.target as Element)?.tagName !== 'BUTTON') runDown(); else return; }
  else if (/^[1-7]$/.test(e.key)) setFocus(FOCUS_ORDER[Number(e.key) - 1]);
  else if (e.key === 'Escape') {
    if (ui.panel) { ui.panel = null; refresh(false); } else if (ui.offScript) { ui.offScript = null; refresh(true); } else if (ui.walk) endWalk(); else setFocus('car');
  }
  else if (e.key === 'Backspace' && ui.offScript) { ui.offScript = null; refresh(true); }
  else if (ui.walk && (k === 'b' || e.key === '.')) { setWalkRun(!ui.walkRun); refresh(false); }
  else if (k === 'q') togglePanel('questions');
  else if (k === 'g') togglePanel('walks');
  else if (k === 'w') toggleWhatIf();
  else if (k === 'a') { ui.answer = !ui.answer; refresh(false); }
  else if (k === 'h') { ui.folded = !ui.folded; refresh(false); }
  else if (k === 'n') toggleChild();
  else if (k === 'l' && !e.repeat) setLights(!ui.lights);
  else if (k === 'e' && !e.repeat) { const t = ui.explodeT > 0.5 ? 0 : 1; ui.whatIf = false; applyWhatIf(); setExplode(t); refresh(false); }
  else return;
  e.preventDefault();
});
addEventListener('keyup', (e) => {
  const a = DRIVE_KEYS[e.key];
  if (a && !(ui.walk && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) release(a, `key:${e.key}`);
  if (e.key === ' ') runUp();
});
addEventListener('blur', () => { input.clear(); runUp(); if (whatIfHeld) input.press(whatIfHeld, 'whatif'); if (ui.walkRun) input.press(runAction().action, 'walk'); });

function setExplode(t: number) {
  ui.explodeT = t;
  autoSlow();
  if (viewFocus() === 'car') focusHome(t);
}

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
  if (moved < 6) { const k = pickPart(e.clientX, e.clientY); if (k) { sound.start(); const f = focusOfPart(k); setFocus(f === viewFocus() ? 'car' : f); } }
});
carCanvas.addEventListener('pointermove', (e) => { if (!e.buttons) carCanvas.classList.toggle('picking', !!pickPart(e.clientX, e.clientY)); });

/* ---------------- the 3D remote: drag the wheel, hold the trigger, press '+' for the lights ---------------- */
let wheelGrab: { cx: number; cy: number; a0: number } | null = null;
// pull toward the grip (or just hold) = forward; push it away, toward the head front, = reverse
let triggerGrab: { x: number; y: number; fx: number; fy: number; act: Action } | null = null;
let buttonHeld = false, buttonPulse = 0;
function pressLightsButton() { buttonPulse = 0.18; ui.ringClock = 1; } // a short press, and a radio ring goes out
const angleFrom = (g: { cx: number; cy: number }, x: number, y: number) => Math.atan2(-(y - g.cy), x - g.cx);
function remoteScreen(v: THREE.Vector3) {
  const p = v.project(remote.camera), r = remoteCanvas.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}
const remoteCtrlAt = (e: PointerEvent) => ctrlOf(hitsAt(e.clientX, e.clientY, remoteCanvas, remote.camera, remote.meshes));
remoteCanvas.addEventListener('pointerdown', (e) => {
  const ctrl = remoteCtrlAt(e);
  if (!ctrl) return;
  e.preventDefault(); remoteCanvas.setPointerCapture(e.pointerId); sound.start();
  if (ctrl === 'lights') { buttonHeld = true; setLights(!ui.lights); return; }
  if (ctrl === 'trigger') {
    const a = remoteScreen(remote.trigger.getWorldPosition(new THREE.Vector3())), b = remoteScreen(remote.trigger.localToWorld(new THREE.Vector3(1, 0, 0)));
    const n = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    triggerGrab = { x: e.clientX, y: e.clientY, fx: (b.x - a.x) / n, fy: (b.y - a.y) / n, act: 'fwd' };
    press('fwd', 'remote'); return;
  }
  const c = remoteScreen(remote.wheel.getWorldPosition(new THREE.Vector3()));
  wheelGrab = { cx: c.x, cy: c.y, a0: angleFrom({ cx: c.x, cy: c.y }, e.clientX, e.clientY) };
  input.wheelDrag = 0;
});
remoteCanvas.addEventListener('pointermove', (e) => {
  if (wheelGrab) {
    let d = angleFrom(wheelGrab, e.clientX, e.clientY) - wheelGrab.a0;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    input.wheelDrag = clamp(d / WHEEL_TURN, -1, 1); // the wheel follows the finger until it hits its stop
    return;
  }
  if (triggerGrab) {
    const act: Action = (e.clientX - triggerGrab.x) * triggerGrab.fx + (e.clientY - triggerGrab.y) * triggerGrab.fy > 12 ? 'back' : 'fwd';
    if (act !== triggerGrab.act) { release(triggerGrab.act, 'remote'); press(act, 'remote'); triggerGrab.act = act; }
    return;
  }
  const ctrl = remoteCtrlAt(e);
  remoteCanvas.style.cursor = ctrl === 'wheel' ? 'grab' : ctrl ? 'pointer' : 'default';
});
const remoteUp = () => {
  if (triggerGrab) { release(triggerGrab.act, 'remote'); triggerGrab = null; }
  wheelGrab = null; input.wheelDrag = null; buttonHeld = false;
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
void car.decalsReady.then(() => applyFocus(castOf(viewFocus())));

/** How far to slide the picture so the part in focus sits clear of the notes card on the right. */
function targetShift() {
  const notes = $('notes');
  if (notes.hidden || ui.folded || viewFocus() === 'car') return 0;
  return (notes.offsetWidth + 14) / 2;
}

/* ---------------- frame loop ---------------- */
let last = performance.now();
function frame(now: number) {
  const rdt = frameStep(now, last);
  last = now;
  ui.timeScale = lerp(ui.timeScale, ui.slow ? 0.15 : 1, Math.min(1, rdt * 5));
  const dt = rdt * ui.timeScale;
  ui.explode += (ui.explodeT - ui.explode) * Math.min(1, rdt * (reduceMotion ? 30 : 3.2));
  const e = ease(clamp(ui.explode, 0, 1)), onStand = ui.explode > 0.02;
  setApart(onStand);

  const off = blocked();
  const thr = off ? 0 : input.throttleTarget(), steer = off ? 0 : input.steerTarget();
  const { accel } = stepDrive(drive, thr, steer, dt, onStand);
  ground.follow(drive.pose);

  const bumps = {} as CornerBumps;
  for (const c of CORNERS) { const [wx, wz] = wheelWorld(drive.pose, c.x, c.z); bumps[c.key] = onStand ? 0 : groundHeight(wx, wz, ground.rough); }
  stepSuspension(body, bumps, { locked: ui.locked, accel, v: drive.v, steer: drive.steer, dt });

  const cast = castOf(viewFocus());
  const lightsOn = ui.lights && activeWhatIf() !== 'switchOff';
  poseCar(car, { drive, body, bumps, explode: e, explodeRaw: ui.explode, onStand, lights: lightsOn, ledGlows: !cast || cast.parts.includes('lights'), steerHeld: steer, dt });
  const v = viewFocus(), part = v === 'all' ? null : FOCUS[v].part;
  if (part && part !== 'wires') pulseHighlight(part, now / 1000);

  // radio rings from the remote and at the car's antenna while a command is being sent (not with the remote off)
  const commanding = (input.commanding() || buttonPulse > 0) && activeWhatIf() !== 'remoteOff';
  ui.ringClock += rdt;
  if (commanding && ui.ringClock > 0.32) {
    ui.ringClock = 0;
    car.root.updateMatrixWorld(true);
    if (!cast || cast.parts.includes('board')) carRings.emit(ANT_TIP.clone().applyMatrix4(car.pieces.board.matrixWorld));
    remoteRings.emit(remote.antennaTip.getWorldPosition(new THREE.Vector3()));
  }
  carRings.update(rdt, camera);
  remoteRings.update(rdt, remote.camera);

  // the remote shows what the hands are doing
  const rThr = input.throttleTarget(), rSteer = input.steerTarget();
  remote.wheel.rotation.z = lerp(remote.wheel.rotation.z, (input.wheelDrag ?? rSteer) * WHEEL_TURN, Math.min(1, rdt * 14));
  remote.trigger.rotation.z = lerp(remote.trigger.rotation.z, rThr > 0 ? -0.32 : rThr < 0 ? 0.24 : 0, Math.min(1, rdt * 14));
  buttonPulse = Math.max(0, buttonPulse - rdt);
  remote.button.position.z = lerp(remote.button.position.z, buttonHeld || buttonPulse > 0 ? -0.12 : 0, Math.min(1, rdt * 30));
  remote.led.material.emissiveIntensity = commanding ? (Math.sin((now / 1000) * Math.PI * 14) > 0 ? 2.6 : 0.3) : 1.6;

  sound.update(drive.throttle, drive.steerVel, ui.timeScale);

  // the "all together" step lights the walk's steps in turn
  if (ui.walkRun) {
    const before = litSteps(); ui.runClock += rdt;
    if (litSteps() !== before && ui.walk) $('steps').innerHTML = stepsHTML(ui.walk, ui.walkPos[ui.walk], !!ui.offScript, litSteps());
  }

  if (camTween) {
    camTween.t += rdt / camTween.dur;
    const k = ease(Math.min(1, camTween.t));
    orbit.target.lerpVectors(camTween.fT, camTween.tT, k);
    camera.position.lerpVectors(camTween.fP, camTween.tP, k);
    if (camTween.t >= 1) camTween = null;
  }
  ui.shift = lerp(ui.shift, targetShift(), Math.min(1, rdt * (reduceMotion ? 30 : 6)));
  stage.setShift(ui.shift);
  orbit.update();
  stage.followTarget();

  car.root.updateMatrixWorld(true);
  const apart = ui.explode > 0.55, hot = !ui.walk && viewFocus() === 'car';
  labels.update(car, camera, bay.clientWidth, bay.clientHeight, (k) => apart || (hot && HOT_PARTS.has(k)), part, rdt);

  stage.renderer.render(scene, camera);
  remote.renderer.render(remote.scene, remote.camera);
  requestAnimationFrame(frame);
}
refresh(false);
requestAnimationFrame(frame);
