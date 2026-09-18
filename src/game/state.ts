import { EVENTS, findEvent } from './events';
import type { Effects, EventDef, GameSession, GameState, QueuedEffects } from './types';

export const INITIAL_STATE: GameState = {
  turn: 1,
  materiel: 120,
  population: 9400,
  approval: 58,
  leadershipPoints: 4,
  log: ['Turn 1 — Emergency session convened. New Virginia is in Directorate hands.'],
};

/** Automatic per-turn drift applied at the start of every new turn. */
const UPKEEP: Effects = {
  materiel: -6,
  population: 5,
  approval: -2,
  leadershipPoints: 1,
};

/** Chance per turn that an eligible random event fires. */
const RANDOM_EVENT_CHANCE = 0.5;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function applyEffects(state: GameState, effects: Effects): GameState {
  return {
    ...state,
    turn: round1(state.turn + (effects.turn ?? 0)),
    materiel: round1(state.materiel + (effects.materiel ?? 0)),
    population: round1(state.population + (effects.population ?? 0)),
    approval: round1(state.approval + (effects.approval ?? 0)),
    leadershipPoints: round1(state.leadershipPoints + (effects.leadershipPoints ?? 0)),
  };
}

const LABELS: Record<keyof Effects, string> = {
  turn: 'turn',
  materiel: 'materiel',
  population: 'population',
  approval: 'approval',
  leadershipPoints: 'leadership',
};

export function describeEffects(effects: Effects): string {
  const parts = (Object.keys(LABELS) as (keyof Effects)[])
    .filter((key) => key !== 'turn' && (effects[key] ?? 0) !== 0)
    .map((key) => {
      const value = effects[key] as number;
      return `${LABELS[key]} ${value > 0 ? '+' : ''}${round1(value)}`;
    });
  return parts.length ? parts.join(', ') : 'no immediate change';
}

export function initialSession(): GameSession {
  const opening = EVENTS.find((e) => e.turnTrigger === INITIAL_STATE.turn);
  return {
    state: INITIAL_STATE,
    pendingEventId: opening ? opening.id : null,
    firedEventIds: opening ? [opening.id] : [],
    queued: [],
  };
}

function pickEventForTurn(turn: number, firedEventIds: string[]): EventDef | undefined {
  const scripted = EVENTS.find((e) => e.turnTrigger === turn && !firedEventIds.includes(e.id));
  if (scripted) return scripted;

  const eligible = EVENTS.filter(
    (e) =>
      e.turnTrigger === 'random' &&
      !firedEventIds.includes(e.id) &&
      turn >= (e.earliestTurn ?? 1),
  );
  if (!eligible.length) return undefined;
  if (Math.random() > RANDOM_EVENT_CHANCE) return undefined;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export type GameAction =
  | { type: 'choose'; choiceIndex: number }
  | { type: 'advanceTurn' }
  | { type: 'reset' };

export function reducer(session: GameSession, action: GameAction): GameSession {
  switch (action.type) {
    case 'choose': {
      if (!session.pendingEventId) return session;
      const event = findEvent(session.pendingEventId);
      const choice = event?.choices[action.choiceIndex];
      if (!event || !choice) return session;

      const turn = session.state.turn;
      const log = [
        ...session.state.log,
        `Turn ${turn} — ${choice.label}: ${choice.resultText} (${describeEffects(choice.effects)})`,
      ];
      const queued: QueuedEffects[] = choice.delayed
        ? [
            ...session.queued,
            {
              dueTurn: turn + choice.delayed.afterTurns,
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

    case 'advanceTurn': {
      if (session.pendingEventId) return session;

      let state = applyEffects(session.state, { ...UPKEEP, turn: 1 });
      const turn = state.turn;
      const log = [
        ...state.log,
        `Turn ${turn} — The war effort grinds on (${describeEffects(UPKEEP)}).`,
      ];

      const due = session.queued.filter((q) => q.dueTurn <= turn);
      const queued = session.queued.filter((q) => q.dueTurn > turn);
      for (const entry of due) {
        state = applyEffects(state, entry.effects);
        log.push(`Turn ${turn} — ${entry.text} (${describeEffects(entry.effects)})`);
      }

      const event = pickEventForTurn(turn, session.firedEventIds);
      if (event) {
        log.push(`Turn ${turn} — Incoming dispatch: ${event.title}.`);
      }

      return {
        state: { ...state, log },
        pendingEventId: event ? event.id : null,
        firedEventIds: event ? [...session.firedEventIds, event.id] : session.firedEventIds,
        queued,
      };
    }

    case 'reset':
      return initialSession();

    default:
      return session;
  }
}
