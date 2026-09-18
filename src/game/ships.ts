import type { ShipType } from './types';

export interface ShipTypeDef {
  id: ShipType;
  name: string;
  pluralName: string;
  /** Deducted from materiel immediately when construction begins. */
  materielCost: number;
  /** In game days from when construction begins to when the ship joins a fleet. */
  buildDays: number;
}

/**
 * The two ship types available for construction. Placeholder costs and build
 * times, kept as simple data so they're easy to retune later: Escort is
 * cheap and fast, Cruiser is costlier and slower.
 */
export const SHIP_TYPES: Record<ShipType, ShipTypeDef> = {
  escort: {
    id: 'escort',
    name: 'Escort',
    pluralName: 'Escorts',
    materielCost: 15,
    buildDays: 4,
  },
  cruiser: {
    id: 'cruiser',
    name: 'Cruiser',
    pluralName: 'Cruisers',
    materielCost: 40,
    buildDays: 10,
  },
};

/** Escort then Cruiser, matching the order SHIP_TYPES declares them in — used
 *  wherever ship types are listed (build buttons, composition summaries). */
export const SHIP_TYPE_LIST: ShipTypeDef[] = Object.values(SHIP_TYPES);
