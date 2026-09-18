export interface GameState {
  /** In game days since the Directorate attack, as a fraction; the clock drives it. */
  daysElapsed: number;
  materiel: number;
  population: number;
  approval: number;
  leadershipPoints: number;
  log: string[];
}

/** A partial GameState used as a set of deltas to add to the current state.
 *  Time is not a delta: daysElapsed comes from the clock alone. */
export type Effects = Partial<Omit<GameState, 'log' | 'daysElapsed'>>;

/** Effects that land a number of in game days after the choice was made. */
export interface DelayedEffects {
  afterDays: number;
  effects: Effects;
  text: string;
}

export interface Choice {
  label: string;
  effects: Effects;
  resultText: string;
  delayed?: DelayedEffects;
}

export interface EventDef {
  id: string;
  /** The day this event fires on, or 'random' for a per day probability check. */
  dayTrigger: number | 'random';
  title: string;
  text: string;
  /** Random events are only eligible from this day onward. */
  earliestDay?: number;
  choices: Choice[];
}

export interface QueuedEffects {
  dueDay: number;
  effects: Effects;
  text: string;
}

/** The two ship types available for construction. */
export type ShipType = 'escort' | 'cruiser';

/** How many of each ship type a fleet carries. The shape combat resolution
 *  will read from later, so every fleet always has both keys, zero or not. */
export type ShipComposition = Record<ShipType, number>;

/** A fleet: a composition of ships, stationed at a system or in transit
 *  between two. */
export interface Fleet {
  id: string;
  name: string;
  /** Set while stationed; null while in transit. */
  location: string | null;
  /** Set while in transit; null while stationed. */
  origin: string | null;
  destination: string | null;
  /** Absolute day numbers, so transit is drift free like everything else. */
  departureDay: number;
  arrivalDay: number;
  composition: ShipComposition;
}

/** A ship under construction at a system, counting down on the same day
 *  based clock as everything else. */
export interface BuildOrder {
  id: string;
  systemId: string;
  shipType: ShipType;
  /** Absolute day the ship joins a fleet, so it is drift free like transit. */
  completesOnDay: number;
}

/** 0 is paused; 1 through 5 are the in game days per real minute. */
export type Speed = 0 | 1 | 2 | 3 | 4 | 5;

export interface GameSession {
  state: GameState;
  speed: Speed;
  /** Wall clock reading of the last settled moment, or null before the first. */
  lastTickAt: number | null;
  pendingEventId: string | null;
  firedEventIds: string[];
  queued: QueuedEffects[];
  fleets: Fleet[];
  buildQueue: BuildOrder[];
  /** The ordinal to try first when a completed ship needs a new fleet; skips
   *  forward past any name already in use (First and Third are taken from the
   *  start), so it never has to be exactly sequential. */
  nextFleetNumber: number;
}
