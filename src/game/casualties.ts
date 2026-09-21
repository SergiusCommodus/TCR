import { fleetCrew } from './fleets';
import { formatMagnitude } from './scale';
import type { ShipComposition, WarTotals } from './types';

/**
 * Personnel represented by one point of abstract naval or ground combat
 * strength — lets the existing garrison and ground defense numbers (already
 * hand sized by each system's importance, see systems.ts) stand in for
 * realistic personnel counts without touching the combat math they drive.
 * Naval crews run leaner per strength point than ground formations, so a
 * small frontier garrison reads in the tens of thousands while a heavily
 * defended world's ground forces climb toward the low millions — the same
 * range a landing force's own embarked troops (an abstract strength number
 * on Fleet.groundTroops, exactly like a defender's) read at once converted.
 */
export const NAVAL_PERSONNEL_PER_STRENGTH = 20_000;
export const GROUND_PERSONNEL_PER_STRENGTH = 120_000;

/** Personnel estimated for a naval force known only by its abstract combat
 *  strength — a garrison or the Directorate's fleet. */
export function navalPersonnel(strength: number): number {
  return Math.round(Math.max(0, strength) * NAVAL_PERSONNEL_PER_STRENGTH);
}

/** Personnel estimated for a ground force known only by its abstract combat
 *  strength — a system's ground defense, the Directorate's ground troops
 *  riding along on an attack, or a Republic fleet's own embarked troops. */
export function groundPersonnel(strength: number): number {
  return Math.round(Math.max(0, strength) * GROUND_PERSONNEL_PER_STRENGTH);
}

/** A fleet's total personnel: exact crew across its whole ship composition
 *  (see fleetCrew in fleets.ts) plus its embarked ground troops converted
 *  through groundPersonnel above — the realistic headcount casualty
 *  reporting and flavor draw on, entirely separate from fleetStrength,
 *  which keeps driving combat resolution unchanged. */
export function fleetPersonnel(composition: ShipComposition, groundTroops: number): number {
  return fleetCrew(composition) + groundPersonnel(groundTroops);
}

export interface CasualtyReport {
  killed: number;
  wounded: number;
}

/** Share of the personnel riding on strength a side lost who are confirmed
 *  dead versus wounded but recovered — the remaining share (roughly 15%) is
 *  missing, captured, or otherwise unaccounted for, and isn't tracked as its
 *  own figure. */
const KILLED_SHARE_OF_LOST = 0.55;
const WOUNDED_SHARE_OF_LOST = 0.3;

/**
 * Casualties for one side of an engagement: the personnel present before
 * the fight, times the fraction of strength that side actually lost, split
 * into killed and wounded. Tied directly to the same lossFraction combat
 * resolution already produces — stance modified, scaled by how decisive the
 * fight was — so a rout costs far more than a near-even fight the loser
 * still holds together from, and a bigger force always pays a bigger price
 * for the same fractional loss.
 */
export function computeCasualties(personnelBefore: number, lossFraction: number): CasualtyReport {
  const lost = Math.max(0, personnelBefore) * Math.max(0, Math.min(1, lossFraction));
  return {
    killed: Math.round(lost * KILLED_SHARE_OF_LOST),
    wounded: Math.round(lost * WOUNDED_SHARE_OF_LOST),
  };
}

/** "1.2K killed, 640 wounded", or "no casualties" for a report with neither. */
export function describeCasualtyReport(report: CasualtyReport): string {
  if (report.killed === 0 && report.wounded === 0) return 'no casualties';
  return `${formatMagnitude(report.killed)} killed, ${formatMagnitude(report.wounded)} wounded`;
}

export const INITIAL_WAR_TOTALS: WarTotals = {
  ownKilled: 0,
  ownWounded: 0,
  ownShipsLost: 0,
  enemyKilledEstimate: 0,
  enemyWoundedEstimate: 0,
  civilianDeaths: 0,
};

/** Adds a delta onto a running WarTotals — every field in `delta` is
 *  optional, so a call site only ever names the figures its engagement
 *  actually produced. */
export function addWarTotals(totals: WarTotals, delta: Partial<WarTotals>): WarTotals {
  return {
    ownKilled: totals.ownKilled + (delta.ownKilled ?? 0),
    ownWounded: totals.ownWounded + (delta.ownWounded ?? 0),
    ownShipsLost: totals.ownShipsLost + (delta.ownShipsLost ?? 0),
    enemyKilledEstimate: totals.enemyKilledEstimate + (delta.enemyKilledEstimate ?? 0),
    enemyWoundedEstimate: totals.enemyWoundedEstimate + (delta.enemyWoundedEstimate ?? 0),
    civilianDeaths: totals.civilianDeaths + (delta.civilianDeaths ?? 0),
  };
}
