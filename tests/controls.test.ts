import { beforeEach, describe, expect, it } from 'vitest';
import { Controls } from '../src/core/controls';

describe('Controls', () => {
  let c: Controls;
  beforeEach(() => { c = new Controls(); });

  it('is idle with nothing pressed', () => {
    expect(c.throttleTarget()).toBe(0);
    expect(c.steerTarget()).toBe(0);
  });

  it('drives forward while forward is held, and stops on release', () => {
    c.press('fwd', 'btn');
    expect(c.throttleTarget()).toBe(1);
    c.release('fwd', 'btn');
    expect(c.throttleTarget()).toBe(0);
  });

  it('lets reverse win over forward and over cruise', () => {
    c.press('fwd', 'btn'); c.press('back', 'key');
    expect(c.throttleTarget()).toBe(-1);
    c.release('fwd', 'btn');
    c.cruise = true;
    expect(c.throttleTarget()).toBe(-1);
    c.release('back', 'key');
    expect(c.throttleTarget()).toBe(1);
  });

  it('keeps driving while any source still holds the action', () => {
    c.press('fwd', 'btn'); c.press('fwd', 'remote');
    c.release('fwd', 'btn');
    expect(c.isHeld('fwd')).toBe(true);
    c.release('fwd', 'remote');
    expect(c.isHeld('fwd')).toBe(false);
  });

  it('steers left positive, right negative, both cancel', () => {
    c.press('left', 'btn');
    expect(c.steerTarget()).toBe(1);
    c.press('right', 'key');
    expect(c.steerTarget()).toBe(0);
    c.release('left', 'btn');
    expect(c.steerTarget()).toBe(-1);
  });

  it('uses the dragged remote wheel over the buttons', () => {
    c.press('left', 'btn');
    c.wheelDrag = -0.4;
    expect(c.steerTarget()).toBe(-0.4);
    c.wheelDrag = null;
    expect(c.steerTarget()).toBe(1);
  });

  it('clears every hold, e.g. when the window loses focus', () => {
    c.press('fwd', 'btn'); c.press('left', 'key'); c.wheelDrag = 0.5;
    c.clear();
    expect(c.throttleTarget()).toBe(0);
    expect(c.steerTarget()).toBe(0);
  });

  it('reports whether a command is being sent', () => {
    expect(c.commanding()).toBe(false);
    c.press('right', 'btn');
    expect(c.commanding()).toBe(true);
  });
});
