import { describe, expect, it } from 'vitest';
import { PART_ORDER } from '../src/core/catalog';
import {
  FOCUS, FOCUS_ORDER, focusOfPart, isAllTogether, QUESTIONS, stepFocus, WALK_ORDER, WALK_START, walkNext, walkPrev, WALKS, type WalkPos,
} from '../src/core/lesson';

const ELECTRIC = ['battery', 'board', 'wires'] as const;

describe('lesson focus catalogue', () => {
  it('has short talking points for every focus, safe to put in HTML', () => {
    for (const k of FOCUS_ORDER) {
      const f = FOCUS[k];
      expect(f.gist.length, k).toBeLessThanOrEqual(60); // shown large to the child
      expect(f.ask.length, k).toBeLessThanOrEqual(90);
      expect(f.answer.length, k).toBeLessThanOrEqual(160);
      expect(f.try.length, k).toBeLessThanOrEqual(90);
      expect(f.whatIf.caption.length, k).toBeLessThanOrEqual(160);
      expect(`${f.name}${f.gist}${f.ask}${f.answer}${f.try}${f.whatIf.label}${f.whatIf.caption}${f.run.label}`, k).not.toMatch(/[<&]/);
    }
  });

  it('keeps a motor’s source solid: battery, brain and the wires of its own circuit', () => {
    for (const [k, circuit] of [['motor', 'drive'], ['steer', 'steer']] as const) {
      const c = FOCUS[k].cast!;
      for (const p of ELECTRIC) expect(c.parts, `${k} ${p}`).toContain(p);
      expect(c.circuits, k).toEqual(expect.arrayContaining(['batt', circuit]));
    }
    expect(FOCUS.motor.cast!.circuits).not.toContain('steer');
    expect(FOCUS.steer.cast!.circuits).not.toContain('drive');
  });

  it('shows the mechanics on their own: no battery, brain or wires with the gears or the springs', () => {
    for (const k of ['gears', 'springs'] as const) {
      for (const p of ELECTRIC) expect(FOCUS[k].cast!.parts, `${k} ${p}`).not.toContain(p);
      expect(FOCUS[k].cast!.circuits, k).toEqual([]);
    }
    expect(FOCUS.springs.cast!.parts).not.toContain('motor');
  });

  it('frames and opens each part it focuses on', () => {
    for (const k of FOCUS_ORDER) {
      const f = FOCUS[k];
      if (k === 'car') { expect(f.part).toBeNull(); expect(f.cast).toBeNull(); continue; }
      expect(f.cast!.parts, k).toContain(f.part);
    }
    expect(FOCUS.motor.cast!.open).toContain('motor');
    expect(FOCUS.gears.cast!.open).toContain('gears');
  });

  it('leads every part tapped in 3D to a focus that shows it', () => {
    for (const p of PART_ORDER) {
      const f = FOCUS[focusOfPart(p)];
      expect(f.cast === null || f.cast.parts.includes(p), p).toBe(true);
    }
  });

  it('steps along the chain and stops at the ends', () => {
    expect(stepFocus('battery', 1)).toBe('brain');
    expect(stepFocus('motor', -1)).toBe('brain');
    expect(stepFocus('car', -1)).toBe('car');
    expect(stepFocus('springs', 1)).toBe('springs');
  });
});

describe('children’s questions', () => {
  it('each opens a real focus with a short answer', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(8);
    for (const q of QUESTIONS) {
      expect(FOCUS_ORDER, q.text).toContain(q.focus);
      expect(q.text.endsWith('?'), q.text).toBe(true);
      expect(q.answer.length, q.text).toBeLessThanOrEqual(110);
      expect(`${q.text}${q.answer}`).not.toMatch(/[<&]/);
    }
  });

  it('asks every what-if question with that focus’s what-if on', () => {
    const flat = QUESTIONS.find((q) => q.text === 'What if the battery is flat?')!;
    expect(flat.focus).toBe('battery');
    expect(flat.whatIf).toBe(true);
    for (const q of QUESTIONS.filter((x) => x.text.startsWith('What if'))) expect(q.whatIf, q.text).toBe(true);
  });
});

describe('guided walks', () => {
  const run = (k: 'go' | 'turn' | 'bounce') => {
    const w = WALKS[k], seen: WalkPos[] = [];
    let p: WalkPos | 'nextWalk' = WALK_START;
    while (p !== 'nextWalk') { seen.push(p); p = walkNext(w, p); }
    return seen;
  };

  it('asks before it answers at every step, then shows the chain all together, then ends', () => {
    for (const k of WALK_ORDER) {
      const w = WALKS[k], seen = run(k);
      expect(seen.length, k).toBe(w.steps.length * 2 + 2);
      for (let i = 0; i < w.steps.length; i++) {
        expect(seen[2 * i], k).toEqual({ step: i, beat: 0, end: false });
        expect(seen[2 * i + 1], k).toEqual({ step: i, beat: 1, end: false });
      }
      expect(isAllTogether(w, seen[seen.length - 2]), k).toBe(true);
      expect(seen[seen.length - 1].end, k).toBe(true);
    }
  });

  it('goes back the way it came, and stays put at the start', () => {
    for (const k of WALK_ORDER) {
      const w = WALKS[k], seen = run(k);
      for (let i = seen.length - 1; i > 0; i--) {
        const back = walkPrev(w, seen[i]);
        // from the all-together step, back lands on the last step's answer
        expect(back, `${k} ${i}`).toEqual(seen[i - 1]);
      }
      expect(walkPrev(w, WALK_START)).toEqual(WALK_START);
    }
  });

  it('chains the walks and only uses real focuses', () => {
    const order = [WALKS.go.next, WALKS.turn.next, WALKS.bounce.next];
    expect(new Set(order).size).toBe(3);
    for (const k of WALK_ORDER) for (const s of WALKS[k].steps) {
      expect(FOCUS_ORDER, s.q).toContain(s.focus);
      expect(s.q.endsWith('?'), s.q).toBe(true);
    }
    expect(WALKS.turn.all.run).toBe('left');
    expect(WALKS.bounce.steps.every((s) => s.focus === 'springs')).toBe(true);
  });
});
