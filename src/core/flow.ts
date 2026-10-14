import type { PartKey } from './catalog';

export type FlowKey = 'drive' | 'steer';
export interface FlowStep { label: string; part: PartKey | null }

/** The path a command takes, shown under the car while it is happening. */
export const FLOWS: Record<FlowKey, { tag: string; steps: FlowStep[] }> = {
  drive: { tag: 'Drive', steps: [
    { label: 'Remote', part: null }, { label: 'Radio', part: 'board' }, { label: 'Brain', part: 'board' }, { label: 'Battery', part: 'battery' },
    { label: 'Motor', part: 'motor' }, { label: 'Gears', part: 'gears' }, { label: 'Back wheels', part: 'wheels' },
  ] },
  steer: { tag: 'Steer', steps: [
    { label: 'Remote', part: null }, { label: 'Radio', part: 'board' }, { label: 'Brain', part: 'board' },
    { label: 'Steering motor', part: 'steering' }, { label: 'Rack', part: 'steering' }, { label: 'Front wheels', part: 'wheels' },
  ] },
};

export function activeFlows(throttleTarget: number, steerTarget: number): FlowKey[] {
  const out: FlowKey[] = [];
  if (throttleTarget !== 0) out.push('drive');
  if (steerTarget !== 0) out.push('steer');
  return out;
}

/** How many steps are lit after `clock` seconds: one more every 1/7 s. */
export const litCount = (clock: number, n: number): number => Math.min(n, Math.floor(clock * 7) + 1);
