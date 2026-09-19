import { SHIP_TYPES } from './ships';
import type { BuildOrder, Fleet, ShipComposition, ShipType } from './types';

/** Whole days remaining before an absolute day is reached. Shared by fleet
 *  transit and ship construction, which both schedule against an absolute
 *  day rather than a countdown. */
export function daysUntil(day: number, daysElapsed: number): number {
  return Math.max(0, Math.ceil(day - daysElapsed));
}

/** Whole days remaining before an in transit fleet reaches its destination. */
export function daysOut(fleet: Fleet, daysElapsed: number): number {
  return daysUntil(fleet.arrivalDay, daysElapsed);
}

/** Whole days remaining before a ship under construction completes. */
export function buildDaysOut(order: BuildOrder, daysElapsed: number): number {
  return daysUntil(order.completesOnDay, daysElapsed);
}

const ORDINAL_WORDS = [
  '',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
];

/** "Second Fleet", "Thirteenth Fleet", falling back to a numeral past the
 *  spelled out list rather than ever throwing. */
export function ordinalFleetName(n: number): string {
  const word = ORDINAL_WORDS[n];
  return `${word || `${n}th`} Fleet`;
}

/**
 * The name and next counter value for a newly formed fleet, starting from
 * `from` and skipping any ordinal already in use by an existing fleet — so a
 * new fleet never collides with First Fleet or Third Fleet, the two the game
 * starts with outside this sequence.
 */
export function nextFleetName(fleets: Fleet[], from: number): { name: string; next: number } {
  let n = from;
  while (fleets.some((fleet) => fleet.name === ordinalFleetName(n))) n++;
  return { name: ordinalFleetName(n), next: n + 1 };
}

export function emptyComposition(): ShipComposition {
  return { escort: 0, cruiser: 0, transport: 0 };
}

export function totalShips(composition: ShipComposition): number {
  return (Object.keys(SHIP_TYPES) as ShipType[]).reduce(
    (total, type) => total + composition[type],
    0,
  );
}

export function sumComposition(fleets: Fleet[]): ShipComposition {
  return fleets.reduce((total, fleet) => {
    const sum = { ...total };
    for (const type of Object.keys(SHIP_TYPES) as ShipType[]) {
      sum[type] = total[type] + fleet.composition[type];
    }
    return sum;
  }, emptyComposition());
}

/** "2 Escorts, 1 Cruiser", or "no ships" for an empty composition. */
export function describeComposition(composition: ShipComposition): string {
  const parts = (Object.keys(SHIP_TYPES) as ShipType[])
    .filter((type) => composition[type] > 0)
    .map((type) => {
      const count = composition[type];
      const def = SHIP_TYPES[type];
      return `${count} ${count === 1 ? def.name : def.pluralName}`;
    });
  return parts.length ? parts.join(', ') : 'no ships';
}

/** "First Fleet: 2 Escorts, 1 Cruiser" */
export function fleetLabel(fleet: Fleet): string {
  return `${fleet.name}: ${describeComposition(fleet.composition)}`;
}

/** A fleet's total combat strength: the sum of each ship's count times its
 *  type's strength. */
export function fleetStrength(composition: ShipComposition): number {
  return (Object.keys(SHIP_TYPES) as ShipType[]).reduce(
    (total, type) => total + composition[type] * SHIP_TYPES[type].strength,
    0,
  );
}

/** How many ground troops a fleet's Transports can carry in total — the
 *  ceiling Load Troops fills up to, not how many are actually aboard right
 *  now (that's the fleet's own groundTroops). */
export function groundTroopCapacity(composition: ShipComposition): number {
  return composition.transport * SHIP_TYPES.transport.groundTroopCapacity;
}

/** Reduces a plain count by a loss fraction (0 = untouched, 1 = wiped out),
 *  rounded to a whole number and never negative. Shared by ship counts,
 *  garrison and ground defense strength, and ground troops — anything
 *  expressed as a single number that takes proportional combat losses. */
export function applySurvivingShare(value: number, lossFraction: number): number {
  const survivingShare = Math.max(0, Math.min(1, 1 - lossFraction));
  return Math.max(0, Math.round(value * survivingShare));
}

/** Reduces a composition by a loss fraction (0 = untouched, 1 = wiped out),
 *  applying the same fraction to every ship type and rounding to whole ships. */
export function applyCompositionLosses(
  composition: ShipComposition,
  lossFraction: number,
): ShipComposition {
  const result = { ...composition };
  for (const type of Object.keys(SHIP_TYPES) as ShipType[]) {
    result[type] = applySurvivingShare(composition[type], lossFraction);
  }
  return result;
}
