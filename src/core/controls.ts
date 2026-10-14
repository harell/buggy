export type Action = 'fwd' | 'back' | 'left' | 'right';

/**
 * What the driver is asking for. Several sources (buttons, keys, the 3D remote) can hold the same
 * action at once; it stays held until every source lets go.
 */
export class Controls {
  private held = new Set<string>();
  /** "Keep going": drive forward without holding anything. */
  cruise = false;
  /** Steering from dragging the remote's wheel, -1..1, or null when not dragging. */
  wheelDrag: number | null = null;

  press(action: Action, source: string): void { this.held.add(`${action}:${source}`); }
  release(action: Action, source: string): void { this.held.delete(`${action}:${source}`); }
  isHeld(action: Action): boolean {
    for (const t of this.held) if (t.startsWith(`${action}:`)) return true;
    return false;
  }
  clear(): void { this.held.clear(); this.wheelDrag = null; }

  /** -1 reverse, 0 coast, 1 forward. Reverse wins so a child can always back out. */
  throttleTarget(): -1 | 0 | 1 {
    if (this.isHeld('back')) return -1;
    return this.isHeld('fwd') || this.cruise ? 1 : 0;
  }

  /** Positive is left. */
  steerTarget(): number {
    if (this.wheelDrag !== null) return this.wheelDrag;
    return (this.isHeld('left') ? 1 : 0) - (this.isHeld('right') ? 1 : 0);
  }

  commanding(): boolean { return this.throttleTarget() !== 0 || this.steerTarget() !== 0; }
}
