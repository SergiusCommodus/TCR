import { OCCUPATION_CHOICES } from './occupation';
import { fleetStrength } from './fleets';
import { SYSTEMS, currentController } from './systems';
import { travelDays } from './travel';
import type { Controller } from './systems';
import type { OccupationChoiceId } from './occupation';
import type { Effects, Fleet } from './types';

/** The Directorate's three campaign traits, fixed for the whole game — there
 *  is no difficulty setting or economy panel that changes them mid campaign. */
export interface DirectorateTraits {
  /** How readily it commits to an attack once eligible. */
  aggression: number;
  /** How much it holds back, damping aggression's eagerness to act. */
  patience: number;
  /** How severe its occupation choice tends to be after a won attack. */
  brutality: number;
}

export const DIRECTORATE_TRAITS: DirectorateTraits = {
  aggression: 0.6,
  patience: 0.4,
  brutality: 0.7,
};

/** The system the Directorate stages attacks from — the one it already
 *  holds at campaign start. */
export const DIRECTORATE_HOME_SYSTEM_ID = 'new-virginia';

/** Starting abstract fleet strength, roughly what it took to seize New
 *  Virginia in the first place. */
export const DIRECTORATE_INITIAL_FLEET_STRENGTH = 8;

/** Passive daily growth of the Directorate's abstract fleet strength —
 *  unseen production, the same way materiel accrues for the Republic. The
 *  player never sees this number directly, only an alert once it acts on it. */
export const DIRECTORATE_FLEET_GROWTH_PER_DAY = 0.6;

/** Minimum fleet strength before an attack is even considered eligible. */
export const DIRECTORATE_ATTACK_THRESHOLD = 20;

/** Periodic evaluation interval, in whole in game days, inclusive. */
export const DIRECTORATE_CHECK_INTERVAL_MIN = 5;
export const DIRECTORATE_CHECK_INTERVAL_MAX = 7;

/** Alert-to-arrival window, in whole in game days, inclusive. */
export const DIRECTORATE_ARRIVAL_MIN = 3;
export const DIRECTORATE_ARRIVAL_MAX = 7;

/** Share of committed fleet strength that fights the naval battle; the rest
 *  rides along as ground troops for the automatic occupation that follows a
 *  win — the same naval/ground split a player Transport creates. */
export const DIRECTORATE_NAVAL_SHARE = 0.7;

/** Defensive strength assumed for a Republic system with no fleet stationed
 *  there: a small local garrison, not the naval-scale numbers Directorate
 *  systems carry. */
export const DIRECTORATE_BASELINE_DEFENSE = 2;

/** Generic source label for the arrival alert. The agency's proper name is
 *  intentionally still undecided, so this stays generic rather than
 *  inventing an acronym. */
export const NAVAL_INTELLIGENCE = 'Naval Intelligence';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function rollIntInRange(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Days until the next periodic check, 5 to 7 inclusive. */
export function rollDirectorateCheckInterval(rng: () => number = Math.random): number {
  return rollIntInRange(DIRECTORATE_CHECK_INTERVAL_MIN, DIRECTORATE_CHECK_INTERVAL_MAX, rng);
}

/** Days from alert to arrival, 3 to 7 inclusive. */
export function rollDirectorateArrivalDays(rng: () => number = Math.random): number {
  return rollIntInRange(DIRECTORATE_ARRIVAL_MIN, DIRECTORATE_ARRIVAL_MAX, rng);
}

/**
 * Whether the Directorate commits to an attack on this periodic check.
 * Below the threshold it never acts — a hard gate. Above it, the chance
 * climbs with aggression and with how far past the threshold fleetStrength
 * has grown, damped by patience, plus random noise: unpredictable turn to
 * turn, trending toward action as strength and aggression compound.
 */
export function directorateWantsToAttack(
  currentFleetStrength: number,
  traits: DirectorateTraits,
  threshold: number = DIRECTORATE_ATTACK_THRESHOLD,
  rng: () => number = Math.random,
): boolean {
  if (currentFleetStrength < threshold) return false;
  const surplus = Math.min(1, (currentFleetStrength - threshold) / threshold);
  const eagerness = traits.aggression * (0.5 + 0.5 * surplus) * (1 - 0.5 * traits.patience);
  const noise = (rng() - 0.5) * 0.3;
  const chance = clamp01(eagerness + noise);
  return rng() < chance;
}

/** Current defending strength at a system: the summed strength of every
 *  Republic fleet stationed there. Zero if none is. */
export function defendingStrengthAt(systemId: string, fleets: Fleet[]): number {
  return fleets
    .filter((fleet) => fleet.location === systemId)
    .reduce((sum, fleet) => sum + fleetStrength(fleet.composition), 0);
}

/**
 * Picks an attack target among Republic controlled systems, weighted toward
 * ones nearer the Directorate's home system and toward weaker or undefended
 * ones — both make a system more likely to be picked, neither is required.
 * Returns null only if the Republic holds no systems at all.
 */
export function pickDirectorateTarget(
  controllerOverrides: Record<string, Controller>,
  fleets: Fleet[],
  rng: () => number = Math.random,
): string | null {
  const candidates = SYSTEMS.filter(
    (system) => currentController(system, controllerOverrides) === 'republic',
  );
  if (candidates.length === 0) return null;

  const weights = candidates.map((system) => {
    const distance = travelDays(DIRECTORATE_HOME_SYSTEM_ID, system.id);
    const defense = defendingStrengthAt(system.id, fleets);
    // Nearer and weaker both push the weight up; +1 on each keeps a
    // zero-distance or zero-defense system from producing an infinite weight.
    return 1 / ((distance + 1) * (defense + 1));
  });
  const total = weights.reduce((a, b) => a + b, 0);

  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i].id;
  }
  return candidates[candidates.length - 1].id;
}

/** One automatic occupation outcome: the same id, effects and flipsControl
 *  as the matching player facing OCCUPATION_CHOICES entry, narrated from
 *  the Directorate's side as the invader rather than the Republic's own
 *  invasion flow. */
export interface DirectorateOutcome {
  id: OccupationChoiceId;
  label: string;
  effects: Effects;
  resultText: (systemName: string) => string;
  flipsControl: boolean;
}

const DIRECTORATE_OUTCOME_TEXT: Record<OccupationChoiceId, (name: string) => string> = {
  bombard: (name) =>
    `Directorate orbital batteries reduce ${name}'s cities to rubble before a single soldier lands. ` +
    'Resistance ends within the day.',
  'enslave-deport': (name) =>
    `Directorate transports round up ${name}'s survivors for deportation and forced labor. ` +
    'What word reaches Sol comes weeks late, and worse than feared.',
  exterminate: (name) =>
    `Directorate orders go out and are carried out without exception. ${name} is emptied of the living.`,
  occupy: (name) =>
    `A Directorate garrison lands and raises its own flag over ${name}'s capital. Civil administration ` +
    'continues under occupation, spared the worst this time.',
};

/** OCCUPATION_CHOICES, re-narrated for the Directorate as the invader — same
 *  ids, same effects, same flipsControl, in the same order, per the rule
 *  that a Directorate win applies the same population and approval effects
 *  already built for the player's own occupation choices. */
export const DIRECTORATE_OUTCOMES: DirectorateOutcome[] = OCCUPATION_CHOICES.map((choice) => ({
  id: choice.id,
  label: choice.label,
  effects: choice.effects,
  resultText: DIRECTORATE_OUTCOME_TEXT[choice.id],
  flipsControl: choice.flipsControl,
}));

function outcomeById(id: OccupationChoiceId): DirectorateOutcome {
  const found = DIRECTORATE_OUTCOMES.find((outcome) => outcome.id === id);
  if (!found) throw new Error(`Unknown Directorate occupation outcome id: ${id}`);
  return found;
}

/**
 * Rolls which occupation outcome follows a won Directorate attack, weighted
 * by brutality: higher brutality skews toward Bombard and Exterminate
 * (split evenly between the two) over Enslave and Deport, and away from
 * Occupy and Govern. At brutality 0.7 this lands at roughly 55% / 30% / 15%.
 */
export function rollDirectorateOccupationOutcome(
  brutality: number,
  rng: () => number = Math.random,
): DirectorateOutcome {
  const severe = clamp01(0.2 + 0.5 * brutality); // Bombard + Exterminate combined
  const mild = clamp01(0.5 - 0.5 * brutality); // Occupy and Govern
  const mid = Math.max(0, 1 - severe - mild); // Enslave and Deport
  const roll = rng();

  if (roll < severe / 2) return outcomeById('bombard');
  if (roll < severe) return outcomeById('exterminate');
  if (roll < severe + mid) return outcomeById('enslave-deport');
  return outcomeById('occupy');
}
