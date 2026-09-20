import { MAT_SCALE } from './scale';
import type { Effects } from './types';

export interface FocusDef {
  id: string;
  name: string;
  description: string;
  /** In game days from when the focus begins to when it completes. */
  days: number;
  /** Deducted from leadershipPoints immediately when the focus begins. */
  leadershipCost: number;
  /** Narrated line logged when the focus begins. */
  startText: string;
  /** Narrated line logged when the focus completes. */
  completeText: string;
  /** One time Effects applied the moment the focus completes. */
  onComplete?: Effects;
  /** Permanent per day modifier layered onto daily upkeep from the day this
   *  focus completes onward, the same way tax policy layers onto it. */
  dailyModifier?: Effects;
  /** Multiplier applied to every ship type's buildDays once this focus has
   *  completed. Absent means no change to construction time. */
  buildTimeMultiplier?: number;
}

/**
 * The National Focus tree: a single linear path of eleven focuses. Each is
 * locked until the one before it completes, and only one can be underway at
 * a time. Placeholder numbers throughout are scaled against the baseline
 * daily drift (materiel -1.2, approval -0.4, leadershipPoints +0.2, manpower
 * +0.5) so "slightly" and "notable" read as meaningfully different sizes of
 * bonus rather than arbitrary ones. The last four escalate further still,
 * larger effects at higher day and leadership costs, reflecting a nation
 * further committed to total war.
 */
export const FOCUS_PATH: FocusDef[] = [
  {
    id: 'national-mobilization',
    name: 'National Mobilization Act',
    description:
      "Redirects civilian industry across Republic space onto a war footing, permanently lifting materiel output.",
    days: 10,
    leadershipCost: 2,
    startText:
      'Congress passes the National Mobilization Act, ordering colonial industry onto a war footing.',
    completeText:
      'The National Mobilization Act is fully implemented; materiel output climbs across every Republic world.',
    dailyModifier: { materiel: 0.4 * MAT_SCALE },
  },
  {
    id: 'shipyard-expansion',
    name: 'Colonial Shipyard Expansion',
    description:
      'Expands drydock capacity at Sol and the colonial yards, cutting the time needed to lay down new hulls by roughly 15%.',
    days: 14,
    leadershipCost: 2,
    startText: 'Work begins expanding drydock capacity across the colonial shipyards.',
    completeText:
      'The expanded colonial shipyards come online, cutting construction times across the fleet.',
    buildTimeMultiplier: 0.85,
  },
  {
    id: 'refugee-resettlement',
    name: 'Refugee Resettlement Program',
    description:
      "Opens resettlement camps and relief programs for New Virginia's displaced, easing public anger over the colony's fall.",
    days: 8,
    leadershipCost: 1,
    startText: "Resettlement camps open to house New Virginia's refugees as they arrive across Republic space.",
    completeText:
      "The Refugee Resettlement Program eases the plight of New Virginia's displaced; public confidence rises.",
    onComplete: { approval: 6 },
  },
  {
    id: 'war-powers-act',
    name: 'Emergency War Powers Act',
    description:
      'Grants the war cabinet sweeping emergency authority, permanently speeding leadership decision making at a one time cost to public trust.',
    days: 12,
    leadershipCost: 3,
    startText:
      'The war cabinet moves to invoke Emergency War Powers, consolidating authority for the duration of the conflict.',
    completeText:
      'The Emergency War Powers Act is enacted; decision making across the war effort accelerates, though not without controversy.',
    onComplete: { approval: -5 },
    dailyModifier: { leadershipPoints: 0.1 },
  },
  {
    id: 'intelligence-network',
    name: 'Frontier Intelligence Network',
    description:
      'Builds a network of scouts and listening posts along the frontier, improving visibility into Directorate system details.',
    days: 10,
    leadershipCost: 2,
    startText: 'Agents and scout craft begin quietly establishing a frontier intelligence network.',
    completeText:
      'The Frontier Intelligence Network is operational, giving the Republic its first real window into Directorate territory.',
    // Placeholder: no intelligence data model exists yet to reveal. Completing
    // this focus is recorded (completedFocusIds) so future work can read it.
  },
  {
    id: 'total-war-footing',
    name: 'Total War Footing',
    description:
      'Commits the Republic fully to war: every factory, shipyard, and recruiting office runs at maximum capacity, at the cost of growing unrest.',
    days: 16,
    leadershipCost: 3,
    startText: 'The Republic shifts to Total War Footing, committing every available resource to the war effort.',
    completeText:
      'Total War Footing takes hold; materiel and manpower surge, though the strain on public patience is starting to show.',
    dailyModifier: { materiel: 0.8 * MAT_SCALE, manpower: 0.4, approval: -0.3 },
  },
  {
    id: 'reconstruction-directive',
    name: 'Reconstruction Directive',
    description:
      'Charters reconstruction authorities and relief protocols to stabilize any world retaken from Directorate occupation.',
    days: 12,
    leadershipCost: 2,
    startText: 'Reconstruction authorities are chartered to prepare for the recovery of occupied worlds.',
    completeText:
      'The Reconstruction Directive is in place, ready to stabilize any world the Republic retakes.',
    // Placeholder hook: occupation outcomes do not yet read completedFocusIds.
  },
  {
    id: 'emergency-requisition-powers',
    name: 'Emergency Requisition Powers',
    description:
      "Grants the war economy sweeping requisition authority over colonial industry, permanently " +
      "lifting materiel output well beyond the National Mobilization Act's reach, at a cost to " +
      'public patience.',
    days: 14,
    leadershipCost: 3,
    startText:
      'Congress extends emergency requisition powers over every colonial industry still ' +
      'answering to Sol.',
    completeText:
      'Emergency Requisition Powers take full effect; materiel flows from worlds that used to ' +
      'keep more of what they made.',
    onComplete: { approval: -6 },
    dailyModifier: { materiel: 0.7 * MAT_SCALE },
  },
  {
    id: 'unified-war-production-board',
    name: 'Unified War Production Board',
    description:
      'Centralizes every shipyard still under Republic control behind a single wartime ' +
      'production board, cutting construction times well beyond what the Colonial Shipyard ' +
      'Expansion alone achieved.',
    days: 18,
    leadershipCost: 4,
    startText: 'A Unified War Production Board stands up, with authority over every Republic shipyard.',
    completeText:
      'The Unified War Production Board is fully operational; hulls move through Republic yards ' +
      'faster than at any point since the war began.',
    buildTimeMultiplier: 0.8,
  },
  {
    id: 'total-mobilization-decree',
    name: 'Total Mobilization Decree',
    description:
      'Converts what remains of the civilian economy to war production outright — a far more ' +
      'total commitment than Total War Footing alone, at a matching cost to public patience.',
    days: 20,
    leadershipCost: 4,
    startText:
      'The Total Mobilization Decree is signed, placing what remains of the civilian economy ' +
      'under direct war footing.',
    completeText:
      'Total Mobilization takes hold across every Republic world still standing; materiel and ' +
      'manpower surge again, and so does the strain.',
    dailyModifier: { materiel: 1.2 * MAT_SCALE, manpower: 0.8, approval: -0.6 },
  },
  {
    id: 'continental-defense-initiative',
    name: 'Continental Defense Initiative',
    description:
      'Frames the war as what it has become: an existential defense of the Continental Republic ' +
      'itself. A permanent boost to leadership decision making, and a nation that finally, fully, ' +
      'believes it.',
    days: 22,
    leadershipCost: 5,
    startText:
      'The Continental Defense Initiative is declared from the Capitol steps: the Republic ' +
      'stands or falls together.',
    completeText:
      'The Continental Defense Initiative takes hold; the war cabinet moves with a speed and ' +
      'unity it has not had since New Virginia fell.',
    onComplete: { approval: 8 },
    dailyModifier: { leadershipPoints: 0.3 },
  },
];
