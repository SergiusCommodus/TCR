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

export interface GameSession {
  state: GameState;
  pendingEventId: string | null;
  firedEventIds: string[];
  queued: QueuedEffects[];
}
