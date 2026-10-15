/** The car's parts by what they are made of and do: each mesh belongs to one (see components.ts for the bench's view). */
export type PartKey = 'motor' | 'gears' | 'battery' | 'board' | 'steering' | 'suspension' | 'wheels' | 'lights' | 'wires' | 'chassis' | 'body';

/** The wire runs in the car: battery leads, drive motor, steering motor, light bar. */
export type Circuit = 'batt' | 'drive' | 'steer' | 'light';

export const PART_ORDER: readonly PartKey[] = ['motor', 'gears', 'battery', 'board', 'steering', 'suspension', 'wheels', 'lights', 'wires', 'chassis', 'body'];
