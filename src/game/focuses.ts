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
 * The National Focus tree: a single linear path of seven focuses. Each is
 * locked until the one before it completes, and only one can be underway at
 * a time. Placeholder numbers throughout are scaled against the baseline
 * daily drift (materiel -1.2, approval -0.4, leadershipPoints +0.2, manpower
 * +0.5) so "slightly" and "notable" read as meaningfully different sizes of
 * bonus rather than arbitrary ones.
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
    dailyModifier: { materiel: 0.4 },
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
    dailyModifier: { materiel: 0.8, manpower: 0.4, approval: -0.3 },
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
];
