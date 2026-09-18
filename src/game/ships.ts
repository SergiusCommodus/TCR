import type { ShipType } from './types';

export interface ShipTypeDef {
  id: ShipType;
  name: string;
  pluralName: string;
  /** Deducted from materiel immediately when construction begins. */
  materielCost: number;
  /** In game days from when construction begins to when the ship joins a fleet. */
  buildDays: number;
  /** Combat strength this ship contributes to its fleet's total. */
  strength: number;
  /** Ground troops added to a fleet's groundTroops when this ship completes.
   *  Zero for every type except Transport. */
  groundTroopsCarried: number;
}

/**
 * The three ship types available for construction. Placeholder costs, build
 * times and strengths, kept as simple data so they're easy to retune later:
 * Escort is cheap, fast, and weak; Cruiser is costlier, slower, and strong;
 * Transport sits between the two in cost and build time, fights for neither
 * side (strength 0), and carries ground troops instead.
 */
export const SHIP_TYPES: Record<ShipType, ShipTypeDef> = {
  escort: {
    id: 'escort',
    name: 'Escort',
    pluralName: 'Escorts',
    materielCost: 15,
    buildDays: 4,
    strength: 1,
    groundTroopsCarried: 0,
  },
  cruiser: {
    id: 'cruiser',
    name: 'Cruiser',
    pluralName: 'Cruisers',
    materielCost: 40,
    buildDays: 10,
    strength: 3,
    groundTroopsCarried: 0,
  },
  transport: {
    id: 'transport',
    name: 'Transport',
    pluralName: 'Transports',
    materielCost: 25,
    buildDays: 7,
    strength: 0,
    groundTroopsCarried: 2,
  },
};

/** Escort, Cruiser, then Transport, matching the order SHIP_TYPES declares
 *  them in — used wherever ship types are listed (build buttons, composition
 *  summaries). */
export const SHIP_TYPE_LIST: ShipTypeDef[] = Object.values(SHIP_TYPES);
