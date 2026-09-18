import { SYSTEMS } from './systems';

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * Flat travel time in days between each pair of systems. Placeholder values —
 * they track roughly how far apart the systems feel on the map, not real
 * distance — kept here as simple data so they are easy to retune later.
 *
 * Built from explicit [a, b, days] tuples rather than hand written `pairKey`
 * strings, so a transposed pair can't silently miss the table and fall back
 * to the default.
 */
const TRAVEL_PAIRS: [string, string, number][] = [
  ['anchorage', 'sol', 3],
  ['shiloh', 'sol', 5],
  ['new-virginia', 'sol', 6],
  ['new-virginia', 'shiloh', 7],
  ['anchorage', 'new-virginia', 9],
  ['anchorage', 'shiloh', 10],
];

const TRAVEL_TABLE: Record<string, number> = Object.fromEntries(
  TRAVEL_PAIRS.map(([a, b, days]) => [pairKey(a, b), days]),
);

/** Used only if a pair is missing from the table, e.g. a system added later. */
const DEFAULT_TRAVEL_DAYS = 6;

/** Days to travel between two systems, in either direction. */
export function travelDays(a: string, b: string): number {
  return TRAVEL_TABLE[pairKey(a, b)] ?? DEFAULT_TRAVEL_DAYS;
}

/** Every unordered pair of known systems, for drawing a lane between each. */
export function systemPairs(): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < SYSTEMS.length; i++) {
    for (let j = i + 1; j < SYSTEMS.length; j++) {
      pairs.push([SYSTEMS[i].id, SYSTEMS[j].id]);
    }
  }
  return pairs;
}

// Catches a system added to SYSTEMS without a matching travel time, as soon
// as the module loads rather than as a silent default-day fallback later.
// Cheap: this is a handful of pairs, checked once at import time.
for (const [a, b] of systemPairs()) {
  if (!(pairKey(a, b) in TRAVEL_TABLE)) {
    console.warn(`No travel time entry for ${a} <-> ${b}; using the ${DEFAULT_TRAVEL_DAYS}d default.`);
  }
}

/** The closest other system by travel time, for a defeated fleet's retreat.
 *  Falls back to `fromId` itself only if no other system exists. */
export function nearestOtherSystem(fromId: string): string {
  let best: string | null = null;
  let bestDays = Infinity;
  for (const system of SYSTEMS) {
    if (system.id === fromId) continue;
    const days = travelDays(fromId, system.id);
    if (days < bestDays) {
      bestDays = days;
      best = system.id;
    }
  }
  return best ?? fromId;
}
