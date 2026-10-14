import type { PartKey } from './catalog';

/** The wires hang between the battery, board and motors, so they only show until the car is this far apart. */
const WIRES_HIDE_AT = 0.25;

/** Whether the wires are drawn at this (raw) explode amount. */
export const wiresShown = (explodeRaw: number): boolean => explodeRaw < WIRES_HIDE_AT;

/** How far apart the car should be after picking a part: picking the wires puts it back together so they can be seen. */
export const explodeAfterPick = (k: PartKey | null, explodeT: number): number => (k === 'wires' ? 0 : explodeT);

/** What stays picked once the car is taken apart to explodeT: the wires are let go of once that hides them. */
export const pickAfterExplode = (k: PartKey | null, explodeT: number): PartKey | null => (k === 'wires' && !wiresShown(explodeT) ? null : k);
