import type { Controller } from './systems';

export interface GameState {
  /** In game days since the Directorate attack, as a fraction; the clock drives it. */
  daysElapsed: number;
  materiel: number;
  population: number;
  approval: number;
  leadershipPoints: number;
  /** Military manpower: population converted into a form the war effort can
   *  actually spend, on Transports for now. Drifts up slowly from population
   *  on its own; conscription is the other way to get a real amount of it. */
  manpower: number;
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

/** The three ship types available for construction. Transport carries
 *  ground troops instead of fighting: its combat strength is 0. */
export type ShipType = 'escort' | 'cruiser' | 'transport';

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
  /** Ground troops actually aboard this fleet, loaded from a system's
   *  trained troop pool via Load Troops (see groundTroopPool below and
   *  groundTroopCapacity in fleets.ts for the ceiling its Transports allow).
   *  Used only for a ground invasion at a system this fleet has already won
   *  the naval battle at — it plays no part in naval combat strength. */
  groundTroops: number;
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

/** Ground troop training under way at a system, counting down on the same
 *  day based clock as ship construction — see TROOP_TRAINING in troops.ts. */
export interface TroopTrainingOrder {
  id: string;
  systemId: string;
  /** Absolute day the trained troops join that system's pool. */
  completesOnDay: number;
}

/** A fleet that has reached a Directorate or contested system and is
 *  waiting for the player to commit to attack, or not, before the clock can
 *  resume. */
export interface PendingCombat {
  fleetId: string;
  systemId: string;
}

/** A system whose ground defense has just been overrun and is waiting on an
 *  occupation choice before the clock can resume. */
export interface PendingOccupation {
  systemId: string;
}

/** The National Focus currently underway, counting down on the same day
 *  based clock as fleet transit and ship construction. */
export interface ActiveFocus {
  id: string;
  /** Absolute day the focus completes, so its countdown is drift free like
   *  everything else on the clock. */
  completesOnDay: number;
}

/** A Directorate attack in flight: decided and alerted, counting down to
 *  arrival on the same day based clock as fleet transit. */
export interface DirectorateAttack {
  systemId: string;
  /** Absolute day the fleet arrives and combat resolves, drift free like
   *  everything else on the clock. */
  arrivalDay: number;
}

/** The just-fired Directorate intelligence alert, shown once as a notice
 *  rather than a decision — cleared automatically a few seconds after it
 *  appears, restoring the speed the clock was running at before the brief
 *  pause it causes. */
export interface PendingDirectorateAlert {
  systemId: string;
  resumeSpeed: Speed;
}

/** A Directorate attack that has arrived at a system where a Republic fleet
 *  is present: paused, awaiting the player's defend stance choice instead of
 *  resolving automatically. */
export interface PendingDirectorateCombat {
  systemId: string;
}

/** Victory or defeat, decided once and permanent: 'result' and 'reason'
 *  drive the end screen and the closing log line, 'day' is the whole day
 *  count the game ended on. */
export type GameResult = 'victory' | 'defeat';

export interface GameEndState {
  result: GameResult;
  reason: string;
  day: number;
}

/** 0 is paused; 1, 5, 10 and 20 are the in game days per real minute. */
export type Speed = 0 | 1 | 5 | 10 | 20;

/** Low trades materiel income for approval over time; Wartime trades the
 *  other way; Standard is the untouched baseline drift. */
export type TaxPolicy = 'low' | 'standard' | 'wartime';

export interface GameSession {
  state: GameState;
  speed: Speed;
  /** Wall clock reading of the last settled moment, or null before the first. */
  lastTickAt: number | null;
  pendingEventId: string | null;
  pendingCombat: PendingCombat | null;
  pendingOccupation: PendingOccupation | null;
  firedEventIds: string[];
  queued: QueuedEffects[];
  fleets: Fleet[];
  buildQueue: BuildOrder[];
  /** Ground troop training orders under way, Sol only for now — see
   *  TroopTrainingOrder and TROOP_TRAINING in troops.ts. */
  trainingQueue: TroopTrainingOrder[];
  /** Trained ground troops sitting at a system, not yet loaded onto any
   *  fleet, keyed by system id. A system absent here has none. Drawn down by
   *  Load Troops, which moves some into a stationed fleet's own groundTroops
   *  up to its Transport carrying capacity. */
  groundTroopPool: Record<string, number>;
  /** The ordinal to try first when a completed ship needs a new fleet; skips
   *  forward past any name already in use (First and Third are taken from the
   *  start), so it never has to be exactly sequential. */
  nextFleetNumber: number;
  /** Current defensive strength per system id. Starts from each system's
   *  static garrisonStrength and is reduced by combat from there, the same
   *  split as a fleet's live composition versus a ship type's fixed data. */
  garrisons: Record<string, number>;
  /** Current ground defense per system id, the invasion equivalent of
   *  garrisons — same static-baseline-versus-live-value split. */
  groundDefenses: Record<string, number>;
  /** Systems whose controller has changed from its static SystemDef.controller
   *  baseline. Sparse: a system absent here is still at its static baseline.
   *  Currently only ever set by a successful Occupy and Govern choice. */
  controllerOverrides: Record<string, Controller>;
  /** The standing tax policy: takes effect immediately and holds until
   *  changed again, same as any other policy setting rather than a one time
   *  event choice. */
  taxPolicy: TaxPolicy;
  /** Ids of completed National Focuses, in path order. The next eligible
   *  focus is always the one at this array's length in FOCUS_PATH. */
  completedFocusIds: string[];
  /** The focus currently in progress, or null when none is. Only one focus
   *  can ever be underway at a time. */
  activeFocus: ActiveFocus | null;
  /** The Directorate's abstract fleet strength: an unseen number that grows
   *  passively over time, the same way materiel accrues for the Republic.
   *  Never shown to the player directly. */
  directorateFleetStrength: number;
  /** Absolute day of the next periodic check for whether the Directorate
   *  launches an attack. */
  directorateNextCheckDay: number;
  /** A decided, alerted Directorate attack counting down to arrival, or null
   *  when none is in flight. Only one can be underway at a time. */
  directorateAttack: DirectorateAttack | null;
  /** The just-fired intelligence alert, shown once and cleared automatically
   *  a few seconds later — see PendingDirectorateAlert. */
  pendingDirectorateAlert: PendingDirectorateAlert | null;
  /** A Directorate attack that has arrived where a Republic fleet is
   *  present, awaiting the player's defend stance choice. */
  pendingDirectorateCombat: PendingDirectorateCombat | null;
  /** The absolute day approval first read at or below zero, cleared the
   *  moment it rises back above zero. Null while approval is healthy. Used
   *  to judge internal collapse: see APPROVAL_COLLAPSE_DAYS in gameEnd.ts. */
  approvalCollapseStartDay: number | null;
  /** Set once, permanently, the moment a win or loss condition triggers.
   *  Every action but 'reset' is then a no-op — see the reducer wrapper. */
  gameOver: GameEndState | null;
}
