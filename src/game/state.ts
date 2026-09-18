import { EVENTS, findEvent } from './events';
import { nextFleetName } from './fleets';
import { SHIP_TYPES } from './ships';
import { HOME_SYSTEM_ID, systemById, systemName } from './systems';
import { travelDays } from './travel';
import type {
  BuildOrder,
  Effects,
  EventDef,
  Fleet,
  GameSession,
  GameState,
  QueuedEffects,
  ShipType,
  Speed,
} from './types';

/** At 1x, one real minute is one in game day. Speed multiplies that directly,
 *  so 5x is five in game days per real minute. */
export const MS_PER_GAME_DAY = 60_000;

export const SPEEDS: Speed[] = [0, 1, 2, 3, 4, 5];

/** Chance per day that an eligible random event fires. */
const RANDOM_EVENT_CHANCE = 0.5;

export const INITIAL_STATE: GameState = {
  daysElapsed: 0,
  materiel: 120,
  population: 9400,
  approval: 58,
  leadershipPoints: 4,
  log: ['Day 0 — Emergency session convened. New Virginia is in Directorate hands.'],
};

/** Automatic drift applied for each whole in game day that passes. The scripted
 *  events now span 22 days where they once spanned 5 turns, so the old per turn
 *  drift is scaled to roughly a fifth to keep the same economic pressure. */
const DAILY_UPKEEP: Effects = {
  materiel: -1.2,
  population: 1,
  approval: -0.4,
  leadershipPoints: 0.2,
};

const INITIAL_FLEETS: Fleet[] = [
  {
    id: 'first-fleet',
    name: 'First Fleet',
    location: HOME_SYSTEM_ID,
    origin: null,
    destination: null,
    departureDay: 0,
    arrivalDay: 0,
    composition: { escort: 2, cruiser: 1 },
  },
  {
    id: 'third-fleet',
    name: 'Third Fleet',
    location: 'anchorage',
    origin: null,
    destination: null,
    departureDay: 0,
    arrivalDay: 0,
    composition: { escort: 1, cruiser: 1 },
  },
];

/** The next ordinal a newly built ship's fleet tries first. First and Third
 *  are already taken by the starting fleets, so construction begins its own
 *  sequence at Second and skips forward past any name already in use. */
const INITIAL_NEXT_FLEET_NUMBER = 2;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Whole day number used in log lines and readouts. */
export const dayLabel = (days: number) => Math.floor(days);

export function applyEffects(state: GameState, effects: Effects): GameState {
  return {
    ...state,
    materiel: round1(state.materiel + (effects.materiel ?? 0)),
    population: round1(state.population + (effects.population ?? 0)),
    approval: round1(state.approval + (effects.approval ?? 0)),
    leadershipPoints: round1(state.leadershipPoints + (effects.leadershipPoints ?? 0)),
  };
}

const LABELS: Record<keyof Effects, string> = {
  materiel: 'materiel',
  population: 'population',
  approval: 'approval',
  leadershipPoints: 'leadership',
};

export function describeEffects(effects: Effects): string {
  const parts = (Object.keys(LABELS) as (keyof Effects)[])
    .filter((key) => (effects[key] ?? 0) !== 0)
    .map((key) => {
      const value = effects[key] as number;
      return `${LABELS[key]} ${value > 0 ? '+' : ''}${round1(value)}`;
    });
  return parts.length ? parts.join(', ') : 'no immediate change';
}

export function initialSession(): GameSession {
  const opening = EVENTS.find((e) => e.dayTrigger === INITIAL_STATE.daysElapsed);
  return {
    state: INITIAL_STATE,
    speed: 0,
    lastTickAt: null,
    pendingEventId: opening ? opening.id : null,
    firedEventIds: opening ? [opening.id] : [],
    queued: [],
    fleets: INITIAL_FLEETS,
    buildQueue: [],
    nextFleetNumber: INITIAL_NEXT_FLEET_NUMBER,
  };
}

function pickEventForDay(day: number, firedEventIds: string[]): EventDef | undefined {
  const scripted = EVENTS.find((e) => e.dayTrigger === day && !firedEventIds.includes(e.id));
  if (scripted) return scripted;

  const eligible = EVENTS.filter(
    (e) =>
      e.dayTrigger === 'random' && !firedEventIds.includes(e.id) && day >= (e.earliestDay ?? 0),
  );
  if (!eligible.length) return undefined;
  if (Math.random() > RANDOM_EVENT_CHANCE) return undefined;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Advances the clock by `realMs` of wall time at the session's current speed.
 *
 * Whole days are walked one at a time so that daily upkeep, delayed effects,
 * fleet arrivals and event thresholds all land in order. An event stops the
 * walk: the clock is clamped to that day and the speed drops to paused, so no
 * in game time runs past a decision the player has not made yet.
 */
function runClock(session: GameSession, realMs: number): GameSession {
  if (session.pendingEventId || session.speed === 0 || realMs <= 0) return session;

  const target = session.state.daysElapsed + (realMs * session.speed) / MS_PER_GAME_DAY;
  const log = [...session.state.log];

  let resources = session.state;
  let queued: QueuedEffects[] = session.queued;
  let fleets = session.fleets;
  let buildQueue: BuildOrder[] = session.buildQueue;
  let nextFleetNumber = session.nextFleetNumber;
  let firedEventIds = session.firedEventIds;
  let days = session.state.daysElapsed;
  let pendingEventId: string | null = null;
  let speed: Speed = session.speed;

  /** Applies everything scheduled at or before `atDay`. */
  const settleDueWork = (atDay: number) => {
    const due = queued.filter((q) => q.dueDay <= atDay);
    if (due.length > 0) {
      queued = queued.filter((q) => q.dueDay > atDay);
      for (const entry of due) {
        resources = applyEffects(resources, entry.effects);
        // Labelled with the day it came due, not the day it was noticed: a
        // single long tick can settle several days at once.
        log.push(`Day ${dayLabel(entry.dueDay)} — ${entry.text} (${describeEffects(entry.effects)})`);
      }
    }

    fleets = fleets.map((fleet) => {
      if (!fleet.destination || fleet.arrivalDay > atDay) return fleet;
      const destination = systemById(fleet.destination);
      // A hook for later: no combat yet, just a distinct line when the fleet
      // arrives somewhere the Directorate holds.
      const arrivalLine =
        destination?.controller === 'directorate'
          ? `Day ${dayLabel(fleet.arrivalDay)} — ${fleet.name} arrives at ` +
            `${systemName(fleet.destination)}. Directorate forces detected in system.`
          : `Day ${dayLabel(fleet.arrivalDay)} — ${fleet.name} arrives at ` +
            `${systemName(fleet.destination)}.`;
      log.push(arrivalLine);
      return {
        ...fleet,
        location: fleet.destination,
        origin: null,
        destination: null,
        departureDay: 0,
        arrivalDay: 0,
      };
    });

    const dueBuilds = buildQueue.filter((order) => order.completesOnDay <= atDay);
    if (dueBuilds.length > 0) {
      buildQueue = buildQueue.filter((order) => order.completesOnDay > atDay);
      for (const order of dueBuilds) {
        const def = SHIP_TYPES[order.shipType];
        // Joins an existing fleet already stationed where it was built, or
        // forms a new one if none is there. Picks the first match when more
        // than one fleet happens to be stationed there.
        const existing = fleets.find((fleet) => fleet.location === order.systemId);

        if (existing) {
          fleets = fleets.map((fleet) =>
            fleet.id === existing.id
              ? {
                  ...fleet,
                  composition: {
                    ...fleet.composition,
                    [order.shipType]: fleet.composition[order.shipType] + 1,
                  },
                }
              : fleet,
          );
          log.push(
            `Day ${dayLabel(order.completesOnDay)} — ${def.name} construction complete at ` +
              `${systemName(order.systemId)}, assigned to ${existing.name}.`,
          );
        } else {
          const formed = nextFleetName(fleets, nextFleetNumber);
          nextFleetNumber = formed.next;
          const composition = { escort: 0, cruiser: 0 } as Record<ShipType, number>;
          composition[order.shipType] = 1;
          fleets = [
            ...fleets,
            {
              id: `fleet-${order.systemId}-${formed.name.toLowerCase().replace(/\s+/g, '-')}`,
              name: formed.name,
              location: order.systemId,
              origin: null,
              destination: null,
              departureDay: 0,
              arrivalDay: 0,
              composition,
            },
          ];
          log.push(
            `Day ${dayLabel(order.completesOnDay)} — ${def.name} construction complete at ` +
              `${systemName(order.systemId)}, forms ${formed.name}.`,
          );
        }
      }
    }
  };

  for (let boundary = Math.floor(days) + 1; boundary <= target; boundary++) {
    days = boundary;
    resources = applyEffects(resources, DAILY_UPKEEP);
    log.push(`Day ${boundary} — The war effort grinds on (${describeEffects(DAILY_UPKEEP)}).`);
    settleDueWork(boundary);

    const event = pickEventForDay(boundary, firedEventIds);
    if (event) {
      pendingEventId = event.id;
      firedEventIds = [...firedEventIds, event.id];
      speed = 0;
      log.push(`Day ${boundary} — Incoming dispatch: ${event.title}. Clock paused.`);
      break;
    }
  }

  if (!pendingEventId) {
    days = target;
    settleDueWork(days);
  }

  return {
    ...session,
    state: { ...resources, daysElapsed: days, log },
    speed,
    queued,
    fleets,
    buildQueue,
    nextFleetNumber,
    firedEventIds,
    pendingEventId,
  };
}

export type GameAction =
  | { type: 'choose'; choiceIndex: number }
  | { type: 'assignFleet'; fleetId: string; destinationId: string }
  | { type: 'buildShip'; systemId: string; shipType: ShipType }
  | { type: 'setSpeed'; speed: Speed; now: number }
  | { type: 'tick'; now: number }
  | { type: 'reset' };

export function reducer(session: GameSession, action: GameAction): GameSession {
  switch (action.type) {
    case 'tick': {
      if (session.lastTickAt === null) return { ...session, lastTickAt: action.now };
      const advanced = runClock(session, action.now - session.lastTickAt);
      return { ...advanced, lastTickAt: action.now };
    }

    case 'setSpeed': {
      // Settle the time already run at the old speed before switching, so a
      // speed change neither loses nor double counts the interval it lands in.
      const settled =
        session.lastTickAt === null ? session : runClock(session, action.now - session.lastTickAt);
      return {
        ...settled,
        speed: settled.pendingEventId ? 0 : action.speed,
        lastTickAt: action.now,
      };
    }

    case 'choose': {
      if (!session.pendingEventId) return session;
      const event = findEvent(session.pendingEventId);
      const choice = event?.choices[action.choiceIndex];
      if (!event || !choice) return session;

      const days = session.state.daysElapsed;
      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — ${choice.label}: ${choice.resultText} ` +
          `(${describeEffects(choice.effects)})`,
      ];
      const queued: QueuedEffects[] = choice.delayed
        ? [
            ...session.queued,
            {
              dueDay: days + choice.delayed.afterDays,
              effects: choice.delayed.effects,
              text: choice.delayed.text,
            },
          ]
        : session.queued;

      return {
        ...session,
        state: { ...applyEffects(session.state, choice.effects), log },
        pendingEventId: null,
        queued,
      };
    }

    case 'assignFleet': {
      const fleet = session.fleets.find((f) => f.id === action.fleetId);
      if (!fleet || fleet.destination || !fleet.location) return session;
      if (fleet.location === action.destinationId) return session;

      const days = session.state.daysElapsed;
      const eta = travelDays(fleet.location, action.destinationId);
      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — ${fleet.name} ordered from ${systemName(fleet.location)} to ` +
          `${systemName(action.destinationId)}; ETA ${eta} days.`,
      ];

      return {
        ...session,
        state: { ...session.state, log },
        fleets: session.fleets.map((f) =>
          f.id === fleet.id
            ? {
                ...f,
                location: null,
                origin: fleet.location,
                destination: action.destinationId,
                departureDay: days,
                arrivalDay: days + eta,
              }
            : f,
        ),
      };
    }

    case 'buildShip': {
      // Construction is Sol only for now; enforced here too, not just by
      // which system shows the Build panel.
      if (action.systemId !== HOME_SYSTEM_ID) return session;
      const def = SHIP_TYPES[action.shipType];
      if (session.state.materiel < def.materielCost) return session;

      const days = session.state.daysElapsed;
      const order: BuildOrder = {
        id: `build-${action.shipType}-${Math.round(days * 1000)}-${session.buildQueue.length}`,
        systemId: action.systemId,
        shipType: action.shipType,
        completesOnDay: days + def.buildDays,
      };
      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — ${def.name} construction begun at ` +
          `${systemName(action.systemId)} (materiel -${def.materielCost}); complete in ` +
          `${def.buildDays} days.`,
      ];

      return {
        ...session,
        state: { ...applyEffects(session.state, { materiel: -def.materielCost }), log },
        buildQueue: [...session.buildQueue, order],
      };
    }

    case 'reset':
      return initialSession();

    default:
      return session;
  }
}
