/**
 * Ground troop training: trained directly from manpower and materiel over
 * time, at Sol only, the same restriction and general shape as ship
 * construction (see ships.ts and buildShip in state.ts) but landing in a
 * per system pool rather than joining a fleet directly. A completed
 * Transport carries no troops of its own anymore — it only provides the
 * carrying capacity (see groundTroopCapacity in fleets.ts) that Load Troops
 * draws this pool down against.
 */
export const TROOP_TRAINING = {
  /** Troops added to the training system's pool when one order completes. */
  count: 5,
  /** Deducted from materiel immediately when training begins. */
  materielCost: 10,
  /** Deducted from manpower immediately when training begins. */
  manpowerCost: 15,
  /** In game days from when training begins to when the troops are ready,
   *  similar in scale to ship construction (4-10 days). */
  days: 6,
};
