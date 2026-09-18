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

/** An abstract fleet. Stationed at a system, or in transit between two. */
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
}
