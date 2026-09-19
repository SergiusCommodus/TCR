/**
 * Combat resolution: two sides roll their strength with independent random
 * variance, whichever total is higher wins, and both sides take losses —
 * the winner's proportional to how close the fight was, the loser's the
 * complement of that, so a near-even fight bruises both sides while a
 * lopsided one leaves the winner almost untouched and wipes the loser.
 */

/** Random variance applied to each side's strength before comparing: ±20%. */
const COMBAT_VARIANCE = 0.2;

/** The winner's loss fraction at the closest possible fight (an even roll).
 *  The loser's loss fraction is always 1 minus the winner's. */
const MAX_WINNER_LOSS_FRACTION = 0.5;

export interface CombatOutcome {
  attackerRoll: number;
  defenderRoll: number;
  attackerWins: boolean;
  /** Fraction (0-1) of the attacker's strength lost. */
  attackerLossFraction: number;
  /** Fraction (0-1) of the defender's strength lost. */
  defenderLossFraction: number;
}

/**
 * Resolves one engagement between an attacking fleet and a defending
 * garrison, given their pre-roll strengths. `rng` defaults to Math.random
 * and is overridable so the formula can be tested deterministically.
 * `variance` defaults to the standard ±20% band and is overridable so a
 * combat stance can tighten or widen it without touching this formula.
 */
export function rollCombat(
  attackerStrength: number,
  defenderStrength: number,
  rng: () => number = Math.random,
  variance: number = COMBAT_VARIANCE,
): CombatOutcome {
  const varied = (base: number) => base * (1 + (rng() * 2 - 1) * variance);
  const attackerRoll = varied(attackerStrength);
  const defenderRoll = varied(defenderStrength);
  const attackerWins = attackerRoll >= defenderRoll;

  const winnerRoll = attackerWins ? attackerRoll : defenderRoll;
  const loserRoll = attackerWins ? defenderRoll : attackerRoll;
  // How close the fight was, 0 (a rout) to 1 (an even match).
  const closeness = winnerRoll > 0 ? Math.min(1, loserRoll / winnerRoll) : 0;

  const winnerLoss = MAX_WINNER_LOSS_FRACTION * closeness;
  const loserLoss = 1 - winnerLoss;

  return {
    attackerRoll,
    defenderRoll,
    attackerWins,
    attackerLossFraction: attackerWins ? winnerLoss : loserLoss,
    defenderLossFraction: attackerWins ? loserLoss : winnerLoss,
  };
}
