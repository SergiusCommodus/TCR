import type { EventDef, Effects } from './types';

export type OccupationChoiceId = 'bombard' | 'enslave-deport' | 'exterminate' | 'occupy';

export interface OccupationChoiceDef {
  id: OccupationChoiceId;
  label: string;
  /** Approval delta only, applied to the national total. Population's own
   *  toll is computed per system from that system's actual population (see
   *  occupationCasualtyToll below) — a flat number could never scale
   *  sensibly across a 3M-person colony and a 2.8B-person core world, the
   *  same reason garrison strength and ground defense are sized per system
   *  rather than shared across all of them. */
  effects: Effects;
  /** Takes the system's name so the consequence reads naturally. */
  resultText: (systemName: string) => string;
  /** Only Occupy and Govern flips the system to Republic control. The other
   *  three leave it un-flipped: population devastated but not administered,
   *  a hook for a later "install a government" step. */
  flipsControl: boolean;
}

/**
 * The four choices after a successful invasion. Exterminate and Bombard are
 * the most severe on population, Enslave and Deport falls between, Occupy
 * and Govern is the least severe — and the only one that costs the Republic
 * nothing in domestic standing; the other three cost approval in proportion
 * to their severity, on the read that a nominally democratic Republic pays a
 * political price for atrocity even in wartime.
 */
export const OCCUPATION_CHOICES: OccupationChoiceDef[] = [
  {
    id: 'bombard',
    label: 'Bombard the system into submission',
    effects: { approval: -18 },
    resultText: (name) =>
      `Orbital batteries reduce ${name}'s cities to rubble. Resistance ends within the day; ` +
      `so does most of what resistance would have depended on. The fleet reports the system ` +
      'pacified.',
    flipsControl: false,
  },
  {
    id: 'enslave-deport',
    label: 'Enslave and deport the population',
    effects: { approval: -22 },
    resultText: (name) =>
      `Ground crews round up ${name}'s survivors for deportation and forced labor. Transports ` +
      'leave overcrowded holds where farmland and hospitals stood. Word of it reaches Sol ' +
      'within the week.',
    flipsControl: false,
  },
  {
    id: 'exterminate',
    label: 'Exterminate the population',
    effects: { approval: -28 },
    resultText: (name) =>
      `Orders go out and are carried out. ${name} is emptied of the living. The fleet's own ` +
      'log entries grow terse, and then stop.',
    flipsControl: false,
  },
  {
    id: 'occupy',
    label: 'Occupy and govern',
    effects: { approval: 12 },
    resultText: (name) =>
      `Republic marines secure ${name}'s capital and post the flag over the old planetary ` +
      'government. Civil administration begins under martial law, imperfect and improvised, ' +
      'but a government rather than a grave.',
    flipsControl: true,
  },
];

/**
 * Civilian toll profile per occupation choice. `immediateRate` is the share
 * of the target system's population killed the moment the choice lands;
 * `aftermathRate` is a further, smaller share lost over the following days —
 * exposure, disease, reprisal — reported and applied when it comes due
 * rather than folded into the immediate toll (see occupationCasualtyToll and
 * its use as a delayed QueuedEffects entry in state.ts). Occupy and Govern
 * is the outlier: its toll is incidental to the invasion fighting itself
 * rather than a matter of policy, so both rates are small.
 */
interface OccupationCasualtyProfile {
  immediateRate: number;
  aftermathRate: number;
  aftermathDays: number;
}

const OCCUPATION_CASUALTY_PROFILES: Record<OccupationChoiceId, OccupationCasualtyProfile> = {
  bombard: { immediateRate: 0.1, aftermathRate: 0.03, aftermathDays: 5 },
  'enslave-deport': { immediateRate: 0.04, aftermathRate: 0.02, aftermathDays: 6 },
  exterminate: { immediateRate: 0.75, aftermathRate: 0.1, aftermathDays: 4 },
  occupy: { immediateRate: 0.003, aftermathRate: 0.001, aftermathDays: 6 },
};

export interface OccupationCasualtyToll {
  /** Civilians dead the moment the choice resolves. */
  immediate: number;
  /** Further civilians dead in the days after, reported once the aftermath
   *  notice comes due. */
  aftermath: number;
  /** Days after the choice before the aftermath toll lands and is reported. */
  aftermathDays: number;
}

/**
 * The civilian toll a given occupation choice takes on a system's actual
 * population, split into an immediate figure and a smaller aftermath figure
 * that lands later — realistically scaled from that population, rather than
 * the flat, system-independent numbers this used before the rescale.
 */
export function occupationCasualtyToll(
  systemPopulation: number,
  choiceId: OccupationChoiceId,
): OccupationCasualtyToll {
  const profile = OCCUPATION_CASUALTY_PROFILES[choiceId];
  const population = Math.max(0, systemPopulation);
  return {
    immediate: Math.round(population * profile.immediateRate),
    aftermath: Math.round(population * profile.aftermathRate),
    aftermathDays: profile.aftermathDays,
  };
}

/**
 * A synthetic EventDef-shaped wrapper around OCCUPATION_CHOICES so the
 * existing DecisionCard component (title, body text, choices with
 * label/effects/resultText) can render this without a second card
 * component. Never enters EVENTS or firedEventIds — it exists only at
 * render time, keyed to whichever system's occupation is pending. Each
 * choice's previewed population effect is the immediate civilian toll
 * computed for this specific system (see occupationCasualtyToll); the
 * aftermath toll isn't previewed here, since it isn't known until the
 * choice is actually made.
 */
export function occupationEventFor(systemName: string, systemPopulation: number): EventDef {
  return {
    id: `occupation-${systemName}`,
    dayTrigger: 'random',
    title: 'Occupation Decision',
    text:
      `${systemName}'s ground defense has been overrun. Republic forces hold the system; ` +
      'Congress and the fleet await word on what becomes of it.',
    choices: OCCUPATION_CHOICES.map((choice) => {
      const toll = occupationCasualtyToll(systemPopulation, choice.id);
      return {
        label: choice.label,
        effects: { ...choice.effects, population: -toll.immediate },
        resultText: choice.resultText(systemName),
      };
    }),
  };
}
