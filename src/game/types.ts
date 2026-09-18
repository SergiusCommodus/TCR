export interface GameState {
  turn: number;
  materiel: number;
  population: number;
  approval: number;
  leadershipPoints: number;
  log: string[];
}

/** A partial GameState used as a set of deltas to add to the current state. */
export type Effects = Partial<Omit<GameState, 'log'>>;

/** Effects that land some number of turns after the choice was made. */
export interface DelayedEffects {
  afterTurns: number;
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
  turnTrigger: number | 'random';
  title: string;
  text: string;
  /** Random events are only eligible from this turn onward. */
  earliestTurn?: number;
  choices: Choice[];
}

export interface QueuedEffects {
  dueTurn: number;
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
  turnsRemaining: number;
  /** Trip length, kept so the map can interpolate progress. */
  totalTurns: number;
}

export interface GameSession {
  state: GameState;
  pendingEventId: string | null;
  firedEventIds: string[];
  queued: QueuedEffects[];
  fleets: Fleet[];
}
