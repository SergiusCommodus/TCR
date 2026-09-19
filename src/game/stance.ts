import { rollCombat } from './combat';
import type { CombatOutcome } from './combat';

export type CombatStance = 'aggressive' | 'moderate' | 'defensive';

export const STANCES: CombatStance[] = ['aggressive', 'moderate', 'defensive'];

export const STANCE_LABEL: Record<CombatStance, string> = {
  aggressive: 'Aggressive',
  moderate: 'Moderate',
  defensive: 'Defensive',
};

export const STANCE_DESCRIPTION: Record<CombatStance, string> = {
  aggressive: 'Higher effective strength, same variance, heavier casualties on both sides.',
  moderate: 'The standard engagement: no modifier to strength, variance or casualties.',
  defensive:
    'Lower effective strength, tighter variance, lighter casualties. A loss retreats with ' +
    'partial losses instead of a last stand.',
};

interface StanceModifiers {
  /** Multiplies the stance holder's strength before the combat roll. */
  strengthMultiplier: number;
  /** Replaces the combat formula's default ±20% variance band. */
  variance: number;
  /** Multiplies both sides' loss fractions after the roll. */
  casualtyMultiplier: number;
}

/**
 * Aggressive trades heavier casualties for a stronger effective strength, at
 * the same variance. Moderate reproduces the original combat formula
 * exactly — the existing baseline, unaffected by this system. Defensive
 * trades effective strength for a tighter variance band and lighter
 * casualties, and (handled wherever this is resolved) never lets a loss
 * wipe the fleet outright — it retreats instead, the same behavior already
 * used for any other losing fleet with survivors.
 */
export const STANCE_MODIFIERS: Record<CombatStance, StanceModifiers> = {
  aggressive: { strengthMultiplier: 1.3, variance: 0.2, casualtyMultiplier: 1.4 },
  moderate: { strengthMultiplier: 1, variance: 0.2, casualtyMultiplier: 1 },
  defensive: { strengthMultiplier: 0.8, variance: 0.1, casualtyMultiplier: 0.6 },
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Estimated win chance shown before committing to a stance: the ratio of
 * the stance holder's stance-modified effective strength to the total
 * strength in play. A displayed estimate to inform the choice, not a
 * guaranteed outcome — actual resolution still rolls through rollCombat's
 * own variance via resolveStanceCombat below.
 */
export function estimateWinChance(
  stanceHolderStrength: number,
  opponentStrength: number,
  stance: CombatStance,
): number {
  const mod = STANCE_MODIFIERS[stance];
  const effective = stanceHolderStrength * mod.strengthMultiplier;
  const total = effective + opponentStrength;
  if (total <= 0) return 0;
  return Math.round(clamp01(effective / total) * 100);
}

/**
 * Resolves combat for whichever side is choosing the stance (passed first,
 * "the stance holder", matching rollCombat's attacker/defender slots) — the
 * exact same rollCombat formula and variance roll, with the stance's
 * strength multiplier applied to the stance holder beforehand and its
 * casualty multiplier applied to both sides' losses after. The opponent's
 * strength and side of the roll are untouched: only the player ever chooses
 * a stance, whichever side of the engagement they're on.
 */
export function resolveStanceCombat(
  stanceHolderStrength: number,
  opponentStrength: number,
  stance: CombatStance,
  rng: () => number = Math.random,
): CombatOutcome {
  const mod = STANCE_MODIFIERS[stance];
  const effective = stanceHolderStrength * mod.strengthMultiplier;
  const outcome = rollCombat(effective, opponentStrength, rng, mod.variance);
  return {
    ...outcome,
    attackerLossFraction: clamp01(outcome.attackerLossFraction * mod.casualtyMultiplier),
    defenderLossFraction: clamp01(outcome.defenderLossFraction * mod.casualtyMultiplier),
  };
}
