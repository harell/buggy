import { PART_INFO } from '../core/catalog';
import { FOCUS, FOCUS_ORDER, isAllTogether, QUESTIONS, WALK_ORDER, WALKS, type FocusKey, type Question, type WalkKey, type WalkPos } from '../core/lesson';

/** Escape text for innerHTML. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CAR_NOTE = 'The model follows photos and measurements of the real DK087 (factory no. 3699-087). Parts nobody has photographed, such as the gear tooth counts, the steering box and the board layout, are drawn as illustrative examples.';

export interface NotesState {
  focus: FocusKey;
  question: Question | null;
  answer: boolean;
  whatIf: boolean;
  folded: boolean;
  /** In a walk the what-ifs are off. */
  noWhatIf?: boolean;
}

/** The grown-up's card: a gist the child may read, then ask / answer / try, the what-if and the next part. */
export function notesHTML(s: NotesState): string {
  const f = FOCUS[s.focus];
  const head = `<div class="head"><span>${esc(f.name)}</span><button data-act="fold">${s.folded ? '▸ notes <kbd>H</kbd>' : '▾ fold <kbd>H</kbd>'}</button></div>`;
  if (s.folded) return head;
  const i = FOCUS_ORDER.indexOf(s.focus), next = FOCUS_ORDER[i + 1];
  const more = f.part ? PART_INFO[f.part].adult : CAR_NOTE;
  return `${head}
    ${s.question ? `<div class="quote">“${esc(s.question.text)}”</div>` : ''}
    <div class="gist">${esc(s.question ? s.question.answer : f.gist)}</div>
    <div class="grp ask"><span class="k">Ask</span><p>${esc(f.ask)}</p></div>
    <div class="grp ans"><span class="k">Answer</span>${s.answer ? `<p>${esc(f.answer)}</p>` : '<button class="reveal" data-act="answer">Show the answer <kbd>A</kbd></button>'}</div>
    <div class="grp try"><span class="k">Try on the car</span><p>${esc(f.try)}</p></div>
    ${s.noWhatIf ? '' : `<button class="whatif" data-act="whatif" aria-pressed="${s.whatIf}">${s.whatIf ? 'Back to normal' : esc(f.whatIf.label)} <kbd>W</kbd></button>
    <p class="slot">${s.whatIf ? esc(f.whatIf.caption) : ''}</p>`}
    ${next ? `<button class="next" data-act="next">Next: ${esc(FOCUS[next].name)} →</button>` : ''}
    <details><summary>About the real car</summary>${esc(more)}</details>`;
}

export function questionsHTML(current: Question | null, seen: ReadonlySet<Question>): string {
  return QUESTIONS.map((q, i) => `<button data-q="${i}" class="${q === current ? 'cur' : ''}${seen.has(q) ? ' seen' : ''}">${esc(q.text)}</button>`).join('');
}

export function walksHTML(): string {
  return WALK_ORDER.map((k) => {
    const w = WALKS[k];
    return `<button data-walk="${k}"><b>${esc(w.name)}</b><span>${w.steps.map((s) => esc(FOCUS[s.focus].name)).join(' › ')} › all together</span></button>`;
  }).join('');
}

export function crumbsHTML(focus: FocusKey): string {
  return focus === 'car' ? '<span class="here">Whole car</span>' : `<button data-act="home">Whole car</button><span>›</span><span class="here">${esc(FOCUS[focus].name)}</span>`;
}

/** The walk's step bar; `lit` is how many steps are lit while the whole chain runs (-1 when not running). */
export function stepsHTML(k: WalkKey, p: WalkPos, offScript: boolean, lit: number): string {
  const w = WALKS[k], n = w.steps.length + 1;
  const names = [...w.steps.map((s) => FOCUS[s.focus].name), 'All together'];
  return names.map((name, j) => `${j ? `<span class="sep${j <= p.step ? ' done' : ''}"></span>` : ''}<button data-step="${j}" class="${j < p.step ? 'done' : ''}${lit >= j ? ' lit' : ''}"${j === p.step && !offScript ? ' aria-current="step"' : ''}>${esc(name)}</button>`).join('')
    + `<span class="count">${Math.min(p.step + 1, n)} / ${n}</span>`;
}

/** The walk's caption: the question, then the answer under it, or the all-together line. */
export function captionHTML(k: WalkKey, p: WalkPos, running: boolean, runLabel: string): string {
  const w = WALKS[k];
  const run = `<button class="walkrun" data-act="walkrun" aria-pressed="${running}">${running ? 'Stop' : esc(runLabel)} <kbd>B</kbd></button>`;
  if (isAllTogether(w, p)) {
    return `<div class="ln">${running ? 'Now all together: watch it go, part by part.' : 'Now all together. Press run.'}</div>${run}<small>Ask: ${esc(w.all.ask)}</small>`;
  }
  const s = w.steps[p.step];
  if (p.beat === 0) return `<div class="ln is-q">${esc(s.q)}</div>${run}<small>Next press: the answer</small>`;
  return `<div class="q">${esc(s.q)}</div><div class="ln">${esc(s.a)}</div>${run}`;
}

export function endHTML(k: WalkKey): string {
  const w = WALKS[k];
  return `<p>End of the ${esc(w.name)} walk</p><div class="row"><button class="run" data-act="nextwalk">Next walk: ${esc(WALKS[w.next].name)} ›</button><button class="mini" data-act="endwalk">Back to the car</button></div>`;
}

/** Child view: one large line, the question to think about. */
export function bigcapHTML(text: string, sub: string): string {
  return `<p>${esc(text)}</p><small>${esc(sub)}</small>`;
}
