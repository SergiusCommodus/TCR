import { HOME_SYSTEM_ID, SYSTEMS, currentController, systemName } from './systems';
import type { GameEndState, GameSession } from './types';

/** Consecutive in game days approval can sit at or below zero before the
 *  government is judged to have collapsed from within. */
export const APPROVAL_COLLAPSE_DAYS = 10;

/**
 * Checks every win and loss condition against the current session. Pure and
 * side effect free — the caller decides what to do with the result. Called
 * after every reducer action (see the reducer's applyGameEnd wrapper in
 * state.ts), so this is effectively continuous rather than a one time check.
 *
 * Checked in order: the capital falling is existential and checked first,
 * then the two internal collapse conditions, then victory last (a defeat
 * this same tick always takes precedence over a simultaneous victory read,
 * though the two are mutually exclusive by construction: the capital or
 * population conditions can't hold at the same moment every system is
 * Republic controlled).
 */
export function checkGameEnd(session: GameSession): GameEndState | null {
  const { state, controllerOverrides } = session;
  const day = Math.floor(state.daysElapsed);

  const capital = SYSTEMS.find((system) => system.id === HOME_SYSTEM_ID);
  if (capital && currentController(capital, controllerOverrides) !== 'republic') {
    return {
      result: 'defeat',
      reason:
        `${systemName(HOME_SYSTEM_ID)} has fallen to the Directorate. The Republic's capital, ` +
        'and with it the war, is lost.',
      day,
    };
  }

  if (state.population <= 0) {
    return {
      result: 'defeat',
      reason: 'Population has collapsed to nothing. There is no one left to govern.',
      day,
    };
  }

  if (
    session.approvalCollapseStartDay !== null &&
    state.daysElapsed - session.approvalCollapseStartDay > APPROVAL_COLLAPSE_DAYS
  ) {
    return {
      result: 'defeat',
      reason:
        'Public approval has stayed at rock bottom for too long. The government collapses ' +
        'from within, not from Directorate guns.',
      day,
    };
  }

  const allRepublic = SYSTEMS.every(
    (system) => currentController(system, controllerOverrides) === 'republic',
  );
  if (allRepublic) {
    return {
      result: 'victory',
      reason:
        'Every system in local space now answers to the Republic. The Directorate has been ' +
        'fully repelled.',
      day,
    };
  }

  return null;
}
