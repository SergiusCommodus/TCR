import { MAT_SCALE } from './scale';
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
  /** Ground troops one of this ship type can carry, contributing to its
   *  fleet's total carrying capacity (see groundTroopCapacity in fleets.ts).
   *  Purely capacity — it doesn't generate troops on its own; those come
   *  from training (see troops.ts) and are loaded aboard separately via
   *  Load Troops. Zero for every type except Transport. */
  groundTroopCapacity: number;
  /** Deducted from manpower immediately when construction begins, alongside
   *  materielCost. Zero for Escort and Cruiser — manpower only matters for
   *  Transport, which is crewing troops rather than a warship. */
  manpowerCost: number;
}

/**
 * The three ship types available for construction. Placeholder costs, build
 * times and strengths, kept as simple data so they're easy to retune later:
 * Escort is cheap, fast, and weak; Cruiser is costlier, slower, and strong;
 * Transport sits between the two in cost and build time, fights for neither
 * side (strength 0), and carries ground troops instead of fighting — trained
 * separately (see troops.ts) and loaded aboard via Load Troops, up to the
 * capacity its Transports provide. Crewing a Transport also costs manpower,
 * unlike the other two.
 */
export const SHIP_TYPES: Record<ShipType, ShipTypeDef> = {
  escort: {
    id: 'escort',
    name: 'Escort',
    pluralName: 'Escorts',
    materielCost: 15 * MAT_SCALE,
    buildDays: 4,
    strength: 1,
    groundTroopCapacity: 0,
    manpowerCost: 0,
  },
  cruiser: {
    id: 'cruiser',
    name: 'Cruiser',
    pluralName: 'Cruisers',
    materielCost: 40 * MAT_SCALE,
    buildDays: 10,
    strength: 3,
    groundTroopCapacity: 0,
    manpowerCost: 0,
  },
  transport: {
    id: 'transport',
    name: 'Transport',
    pluralName: 'Transports',
    materielCost: 25 * MAT_SCALE,
    buildDays: 7,
    strength: 0,
    groundTroopCapacity: 2,
    manpowerCost: 8,
  },
};

/** Escort, Cruiser, then Transport, matching the order SHIP_TYPES declares
 *  them in — used wherever ship types are listed (build buttons, composition
 *  summaries). */
export const SHIP_TYPE_LIST: ShipTypeDef[] = Object.values(SHIP_TYPES);
