/** The wires hang between the battery, board and motors, so they only show until the car is this far apart. */
const WIRES_HIDE_AT = 0.25;

/** Whether the wires are drawn at this (raw) explode amount. */
export const wiresShown = (explodeRaw: number): boolean => explodeRaw < WIRES_HIDE_AT;
