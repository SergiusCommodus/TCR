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
  return { escort: 0, cruiser: 0 };
}

export function totalShips(composition: ShipComposition): number {
  return composition.escort + composition.cruiser;
}

export function sumComposition(fleets: Fleet[]): ShipComposition {
  return fleets.reduce(
    (total, fleet) => ({
      escort: total.escort + fleet.composition.escort,
      cruiser: total.cruiser + fleet.composition.cruiser,
    }),
    emptyComposition(),
  );
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

/** Reduces a composition by a loss fraction (0 = untouched, 1 = wiped out),
 *  applying the same fraction to every ship type and rounding to whole ships. */
export function applyCompositionLosses(
  composition: ShipComposition,
  lossFraction: number,
): ShipComposition {
  const survivingShare = Math.max(0, Math.min(1, 1 - lossFraction));
  return {
    escort: Math.round(composition.escort * survivingShare),
    cruiser: Math.round(composition.cruiser * survivingShare),
  };
}
