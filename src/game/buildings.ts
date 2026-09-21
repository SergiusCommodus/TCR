import { MAT_SCALE, POP_SCALE } from './scale';
import type { BuildingType } from './types';

export interface BuildingTypeDef {
  id: BuildingType;
  name: string;
  description: string;
  /** Deducted from materiel immediately when construction begins. */
  materielCost: number;
  /** In game days from when construction begins to when it starts producing. */
  buildDays: number;
  /** Materiel generated automatically every day this building is complete
   *  and its system is Republic controlled. Factory and Mine both add here
   *  — there's only the one materiel resource — Factory simply produces
   *  more of it per day than the cheaper, faster Mine. */
  materielPerDay?: number;
  /** Approval generated automatically every day, same conditions. */
  approvalPerDay?: number;
  /** Population generated automatically every day, same conditions — a
   *  civic building's other half, alongside approvalPerDay. */
  populationPerDay?: number;
}

/**
 * The four buildable building types. Placeholder costs and rates, kept as
 * simple data so they're easy to retune: Mine is the cheap, fast, modest
 * early pick; Factory costs and takes roughly twice as long to build but
 * produces over twice the daily income, a better long run investment once
 * materiel allows it. Shipyard costs about as much as a Factory but produces
 * nothing directly — its return is what it unlocks (see buildShip in
 * state.ts, which now requires a completed Shipyard at the system rather
 * than the old Sol-only restriction; Sol starts with one already built so
 * existing play is untouched). Civic is the cheapest and fastest of the
 * four, trading materiel income for a small steady boost to population and
 * approval instead.
 */
export const BUILDING_TYPES: Record<BuildingType, BuildingTypeDef> = {
  factory: {
    id: 'factory',
    name: 'Factory',
    description: 'Refines materiel output. Costly and slow to build, but the strongest income per slot.',
    materielCost: 60 * MAT_SCALE,
    buildDays: 12,
    materielPerDay: 2.5 * MAT_SCALE,
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    description: 'Extracts raw materiel. Cheaper and faster than a Factory, at a lower daily yield.',
    materielCost: 30 * MAT_SCALE,
    buildDays: 7,
    materielPerDay: 1.4 * MAT_SCALE,
  },
  shipyard: {
    id: 'shipyard',
    name: 'Shipyard',
    description: 'Produces no income by itself, but is required before any ship can be built at this system.',
    materielCost: 50 * MAT_SCALE,
    buildDays: 14,
  },
  civic: {
    id: 'civic',
    name: 'Civic Infrastructure',
    description: 'Schools, hospitals and public works. Cheapest and fastest to build, boosting population and approval instead of materiel.',
    materielCost: 25 * MAT_SCALE,
    buildDays: 6,
    approvalPerDay: 0.2,
    populationPerDay: 0.5 * POP_SCALE,
  },
};

/** Factory, Mine, Shipyard, then Civic, matching the order BUILDING_TYPES
 *  declares them in — used wherever building types are listed (build
 *  buttons, completed building summaries). */
export const BUILDING_TYPE_LIST: BuildingTypeDef[] = Object.values(BUILDING_TYPES);
