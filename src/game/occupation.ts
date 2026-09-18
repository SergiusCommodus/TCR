import type { EventDef, Effects } from './types';

export type OccupationChoiceId = 'bombard' | 'enslave-deport' | 'exterminate' | 'occupy';

export interface OccupationChoiceDef {
  id: OccupationChoiceId;
  label: string;
  /** Population and approval deltas, applied to the national totals — there
   *  is no per-system population tracked, so the consequence is narrated as
   *  falling on the taken system while mechanically landing on the same
   *  aggregate numbers every other choice in the game already uses. */
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
 * political price for atrocity even in wartime. All placeholder magnitudes,
 * plain data, easy to retune.
 */
export const OCCUPATION_CHOICES: OccupationChoiceDef[] = [
  {
    id: 'bombard',
    label: 'Bombard the system into submission',
    effects: { population: -140, approval: -18 },
    resultText: (name) =>
      `Orbital batteries reduce ${name}'s cities to rubble. Resistance ends within the day; ` +
      `so does most of what resistance would have depended on. The fleet reports the system ` +
      'pacified.',
    flipsControl: false,
  },
  {
    id: 'enslave-deport',
    label: 'Enslave and deport the population',
    effects: { population: -90, approval: -22 },
    resultText: (name) =>
      `Ground crews round up ${name}'s survivors for deportation and forced labor. Transports ` +
      'leave overcrowded holds where farmland and hospitals stood. Word of it reaches Sol ' +
      'within the week.',
    flipsControl: false,
  },
  {
    id: 'exterminate',
    label: 'Exterminate the population',
    effects: { population: -160, approval: -28 },
    resultText: (name) =>
      `Orders go out and are carried out. ${name} is emptied of the living. The fleet's own ` +
      'log entries grow terse, and then stop.',
    flipsControl: false,
  },
  {
    id: 'occupy',
    label: 'Occupy and govern',
    effects: { population: -15, approval: 12 },
    resultText: (name) =>
      `Republic marines secure ${name}'s capital and post the flag over the old planetary ` +
      'government. Civil administration begins under martial law, imperfect and improvised, ' +
      'but a government rather than a grave.',
    flipsControl: true,
  },
];

/**
 * A synthetic EventDef-shaped wrapper around OCCUPATION_CHOICES so the
 * existing DecisionCard component (title, body text, choices with
 * label/effects/resultText) can render this without a second card
 * component. Never enters EVENTS or firedEventIds — it exists only at
 * render time, keyed to whichever system's occupation is pending.
 */
export function occupationEventFor(systemName: string): EventDef {
  return {
    id: `occupation-${systemName}`,
    dayTrigger: 'random',
    title: 'Occupation Decision',
    text:
      `${systemName}'s ground defense has been overrun. Republic forces hold the system; ` +
      'Congress and the fleet await word on what becomes of it.',
    choices: OCCUPATION_CHOICES.map((choice) => ({
      label: choice.label,
      effects: choice.effects,
      resultText: choice.resultText(systemName),
    })),
  };
}
