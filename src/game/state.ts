import { rollCombat } from './combat';
import {
  DIRECTORATE_ATTACK_THRESHOLD,
  DIRECTORATE_BASELINE_DEFENSE,
  DIRECTORATE_FLEET_GROWTH_PER_DAY,
  DIRECTORATE_INITIAL_FLEET_STRENGTH,
  DIRECTORATE_NAVAL_SHARE,
  DIRECTORATE_TRAITS,
  NAVAL_INTELLIGENCE,
  defendingStrengthAt,
  directorateWantsToAttack,
  pickDirectorateTarget,
  rollDirectorateArrivalDays,
  rollDirectorateCheckInterval,
  rollDirectorateOccupationOutcome,
} from './directorate';
import { EVENTS, findEvent } from './events';
import { FOCUS_PATH } from './focuses';
import { checkGameEnd } from './gameEnd';
import { OCCUPATION_CHOICES } from './occupation';
import {
  applyCompositionLosses,
  applySurvivingShare,
  describeComposition,
  fleetStrength,
  nextFleetName,
} from './fleets';
import { SHIP_TYPES } from './ships';
import { STANCE_LABEL, resolveStanceCombat } from './stance';
import { HOME_SYSTEM_ID, SYSTEMS, currentController, systemById, systemName } from './systems';
import { nearestOtherSystem, travelDays } from './travel';
import type { CombatStance } from './stance';
import type { ShipComposition } from './types';
import type {
  ActiveFocus,
  BuildOrder,
  Effects,
  EventDef,
  Fleet,
  GameEndState,
  GameSession,
  GameState,
  PendingCombat,
  PendingDirectorateAlert,
  PendingDirectorateCombat,
  QueuedEffects,
  ShipType,
  Speed,
  TaxPolicy,
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
  manpower: 30,
  log: ['Day 0 — Emergency session convened. New Virginia is in Directorate hands.'],
};

/** Automatic drift applied for each whole in game day that passes, at
 *  Standard tax policy. The scripted events now span 22 days where they once
 *  spanned 5 turns, so the old per turn drift is scaled to roughly a fifth to
 *  keep the same economic pressure. */
const DAILY_UPKEEP: Effects = {
  materiel: -1.2,
  population: 1,
  approval: -0.4,
  leadershipPoints: 0.2,
  manpower: 0.5,
};

/**
 * Materiel and approval deltas layered onto DAILY_UPKEEP by tax policy — a
 * modifier, not a replacement, so Standard reproduces DAILY_UPKEEP exactly.
 * Low trades materiel income for approval over time; Wartime trades the
 * other way. Population, leadership and manpower drift are untouched by
 * tax policy.
 */
const TAX_POLICY_MODIFIERS: Record<TaxPolicy, { materiel: number; approval: number }> = {
  low: { materiel: -0.6, approval: 0.6 },
  standard: { materiel: 0, approval: 0 },
  wartime: { materiel: 0.8, approval: -0.8 },
};

/** Short, narrated line logged when the player changes tax policy. */
const TAX_POLICY_CHANGE_TEXT: Record<TaxPolicy, string> = {
  low: 'Rates ease across the core worlds. Treasury receipts fall almost immediately, and so does the grumbling.',
  standard: 'Wartime rates return to their ordinary schedule.',
  wartime: 'Emergency levies are imposed on every world still answering to Sol.',
};

export const TAX_POLICY_LABEL: Record<TaxPolicy, string> = {
  low: 'Low',
  standard: 'Standard',
  wartime: 'Wartime',
};

export const TAX_POLICIES: TaxPolicy[] = ['low', 'standard', 'wartime'];

/** The day's automatic drift under the given tax policy, with the permanent
 *  dailyModifier of every completed National Focus layered on top — the same
 *  additive layering the tax policy modifier itself uses. */
export function dailyUpkeepFor(taxPolicy: TaxPolicy, completedFocusIds: string[]): Effects {
  const mod = TAX_POLICY_MODIFIERS[taxPolicy];
  const upkeep: Effects = {
    ...DAILY_UPKEEP,
    materiel: (DAILY_UPKEEP.materiel ?? 0) + mod.materiel,
    approval: (DAILY_UPKEEP.approval ?? 0) + mod.approval,
  };

  for (const focus of FOCUS_PATH) {
    if (!focus.dailyModifier || !completedFocusIds.includes(focus.id)) continue;
    for (const key of Object.keys(focus.dailyModifier) as (keyof Effects)[]) {
      upkeep[key] = (upkeep[key] ?? 0) + (focus.dailyModifier[key] ?? 0);
    }
  }

  return upkeep;
}

/** The combined ship construction time multiplier from every completed
 *  National Focus that shortens it. Focuses without a buildTimeMultiplier
 *  leave it untouched. */
export function buildTimeMultiplierFor(completedFocusIds: string[]): number {
  let multiplier = 1;
  for (const focus of FOCUS_PATH) {
    if (focus.buildTimeMultiplier !== undefined && completedFocusIds.includes(focus.id)) {
      multiplier *= focus.buildTimeMultiplier;
    }
  }
  return multiplier;
}

const INITIAL_FLEETS: Fleet[] = [
  {
    id: 'first-fleet',
    name: 'First Fleet',
    location: HOME_SYSTEM_ID,
    origin: null,
    destination: null,
    departureDay: 0,
    arrivalDay: 0,
    composition: { escort: 2, cruiser: 1, transport: 0 },
    groundTroops: 0,
  },
  {
    id: 'third-fleet',
    name: 'Third Fleet',
    location: 'anchorage',
    origin: null,
    destination: null,
    departureDay: 0,
    arrivalDay: 0,
    composition: { escort: 1, cruiser: 1, transport: 0 },
    groundTroops: 0,
  },
];

/** The next ordinal a newly built ship's fleet tries first. First and Third
 *  are already taken by the starting fleets, so construction begins its own
 *  sequence at Second and skips forward past any name already in use. */
const INITIAL_NEXT_FLEET_NUMBER = 2;

/** Starting garrison strength per system, read from each Directorate or
 *  contested system's static baseline; a Republic system (never attacked)
 *  contributes nothing. */
function initialGarrisons(): Record<string, number> {
  const garrisons: Record<string, number> = {};
  for (const system of SYSTEMS) {
    if (system.garrisonStrength !== undefined) garrisons[system.id] = system.garrisonStrength;
  }
  return garrisons;
}

/** Starting ground defense per system, the invasion equivalent of
 *  initialGarrisons(). */
function initialGroundDefenses(): Record<string, number> {
  const defenses: Record<string, number> = {};
  for (const system of SYSTEMS) {
    if (system.groundDefense !== undefined) defenses[system.id] = system.groundDefense;
  }
  return defenses;
}

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
    manpower: round1(state.manpower + (effects.manpower ?? 0)),
  };
}

const LABELS: Record<keyof Effects, string> = {
  materiel: 'materiel',
  population: 'population',
  approval: 'approval',
  leadershipPoints: 'leadership',
  manpower: 'manpower',
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
    pendingCombat: null,
    pendingOccupation: null,
    queued: [],
    fleets: INITIAL_FLEETS,
    buildQueue: [],
    nextFleetNumber: INITIAL_NEXT_FLEET_NUMBER,
    garrisons: initialGarrisons(),
    groundDefenses: initialGroundDefenses(),
    controllerOverrides: {},
    taxPolicy: 'standard',
    completedFocusIds: [],
    activeFocus: null,
    directorateFleetStrength: DIRECTORATE_INITIAL_FLEET_STRENGTH,
    directorateNextCheckDay: rollDirectorateCheckInterval(),
    directorateAttack: null,
    pendingDirectorateAlert: null,
    pendingDirectorateCombat: null,
    approvalCollapseStartDay: null,
    gameOver: null,
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
 * Applies a won Directorate attack's automatic occupation to the national
 * totals and, on Occupy and Govern, the target's controller — shared by the
 * undefended auto-resolve path in runClock and the player-facing defend
 * stance resolution in commitDirectorateDefense, so the two can never drift
 * apart on what a Directorate win actually does.
 */
function applyDirectorateOccupation(
  resources: GameState,
  controllerOverrides: GameSession['controllerOverrides'],
  systemId: string,
  logDay: number,
): {
  resources: GameState;
  controllerOverrides: GameSession['controllerOverrides'];
  logLines: string[];
} {
  const targetName = systemName(systemId);
  const outcomeChoice = rollDirectorateOccupationOutcome(DIRECTORATE_TRAITS.brutality);
  const nextResources = applyEffects(resources, outcomeChoice.effects);
  const nextControllerOverrides = outcomeChoice.flipsControl
    ? { ...controllerOverrides, [systemId]: 'directorate' as const }
    : controllerOverrides;
  const logLines = [
    `Day ${dayLabel(logDay)} — ${outcomeChoice.label}: ${outcomeChoice.resultText(targetName)} ` +
      `(${describeEffects(outcomeChoice.effects)})`,
  ];
  return { resources: nextResources, controllerOverrides: nextControllerOverrides, logLines };
}

/** Defensive stance never lets a loss wipe the fleet outright — if every
 *  ship type would otherwise round to zero, one ship of whichever type the
 *  original composition had the most of survives to retreat. */
function guaranteeSurvivor(
  composition: ShipComposition,
  original: ShipComposition,
): ShipComposition {
  if (fleetStrength(composition) > 0) return composition;
  const types = Object.keys(original) as ShipType[];
  const largest = types.reduce((best, t) => (original[t] > original[best] ? t : best), types[0]);
  if (original[largest] <= 0) return composition;
  return { ...composition, [largest]: 1 };
}

/**
 * Advances the clock by `realMs` of wall time at the session's current speed.
 *
 * Whole days are walked one at a time so that daily upkeep, delayed effects,
 * fleet arrivals and event thresholds all land in order. An event stops the
 * walk: the clock is clamped to that day and the speed drops to paused, so no
 * in game time runs past a decision the player has not made yet.
 */
export function runClock(session: GameSession, realMs: number): GameSession {
  if (
    session.pendingEventId ||
    session.pendingCombat ||
    session.pendingOccupation ||
    session.pendingDirectorateCombat ||
    session.speed === 0 ||
    realMs <= 0
  ) {
    return session;
  }

  const target = session.state.daysElapsed + (realMs * session.speed) / MS_PER_GAME_DAY;
  const log = [...session.state.log];

  let resources = session.state;
  let queued: QueuedEffects[] = session.queued;
  let fleets = session.fleets;
  let buildQueue: BuildOrder[] = session.buildQueue;
  let nextFleetNumber = session.nextFleetNumber;
  let firedEventIds = session.firedEventIds;
  let activeFocus = session.activeFocus;
  let completedFocusIds = session.completedFocusIds;
  let controllerOverrides = session.controllerOverrides;
  let directorateFleetStrength = session.directorateFleetStrength;
  let directorateNextCheckDay = session.directorateNextCheckDay;
  let directorateAttack = session.directorateAttack;
  let approvalCollapseStartDay = session.approvalCollapseStartDay;
  let days = session.state.daysElapsed;
  let pendingEventId: string | null = null;
  let pendingCombat: PendingCombat | null = null;
  let pendingDirectorateAlert: PendingDirectorateAlert | null = null;
  let pendingDirectorateCombat: PendingDirectorateCombat | null = null;
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
      // Live controller, not the static baseline: a system Occupy and Govern
      // has already flipped to Republic no longer triggers combat on arrival.
      const controller = destination && currentController(destination, controllerOverrides);
      const hostile = controller === 'directorate' || controller === 'contested';

      if (hostile) {
        // Only the first hostile arrival found this pass opens Combat
        // Orders; a second one the same day is left exactly as it is —
        // still "arrived" with its transit fields intact — and gets caught
        // again on the next runClock call once this fight is resolved.
        if (!pendingCombat) {
          pendingCombat = { fleetId: fleet.id, systemId: fleet.destination };
          log.push(
            `Day ${dayLabel(fleet.arrivalDay)} — ${fleet.name} arrives at ` +
              `${systemName(fleet.destination)}. Awaiting combat orders.`,
          );
        }
        return fleet;
      }

      log.push(
        `Day ${dayLabel(fleet.arrivalDay)} — ${fleet.name} arrives at ` +
          `${systemName(fleet.destination)}.`,
      );
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
                  groundTroops: fleet.groundTroops + def.groundTroopsCarried,
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
          const composition = { escort: 0, cruiser: 0, transport: 0 } as Record<ShipType, number>;
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
              groundTroops: def.groundTroopsCarried,
            },
          ];
          log.push(
            `Day ${dayLabel(order.completesOnDay)} — ${def.name} construction complete at ` +
              `${systemName(order.systemId)}, forms ${formed.name}.`,
          );
        }
      }
    }

    if (activeFocus && activeFocus.completesOnDay <= atDay) {
      const def = FOCUS_PATH.find((f) => f.id === activeFocus!.id);
      const completed = activeFocus;
      activeFocus = null;
      if (def) {
        if (def.onComplete) resources = applyEffects(resources, def.onComplete);
        completedFocusIds = [...completedFocusIds, def.id];
        log.push(
          `Day ${dayLabel(completed.completesOnDay)} — ${def.completeText}` +
            (def.onComplete ? ` (${describeEffects(def.onComplete)})` : ''),
        );
      }
    }

    if (directorateAttack && directorateAttack.arrivalDay <= atDay) {
      const attack = directorateAttack;
      const targetName = systemName(attack.systemId);
      const rawDefense = defendingStrengthAt(attack.systemId, fleets);

      if (rawDefense > 0) {
        // A Republic fleet is present: the player chooses a defend stance
        // (commitDirectorateDefense) instead of this resolving automatically.
        directorateAttack = null;
        pendingDirectorateCombat = { systemId: attack.systemId };
        log.push(
          `Day ${dayLabel(attack.arrivalDay)} — ${NAVAL_INTELLIGENCE}: the Directorate fleet ` +
            `reaches ${targetName} and closes on the defending fleet. Awaiting combat orders.`,
        );
      } else {
        directorateAttack = null;
        const defenderStrength = DIRECTORATE_BASELINE_DEFENSE;
        const navalStrength = directorateFleetStrength * DIRECTORATE_NAVAL_SHARE;
        const groundTroops = directorateFleetStrength * (1 - DIRECTORATE_NAVAL_SHARE);
        const outcome = rollCombat(navalStrength, defenderStrength);

        log.push(
          `Day ${dayLabel(attack.arrivalDay)} — ${NAVAL_INTELLIGENCE}: the Directorate fleet ` +
            `reaches ${targetName} (${Math.round(navalStrength)} strength, an estimated ` +
            `${Math.round(groundTroops)} ground troops aboard) and engages ${targetName}'s ` +
            `minimal garrison (${Math.round(defenderStrength)} strength). ` +
            `${outcome.attackerWins ? 'The Directorate fleet breaks through.' : 'The Republic defense holds.'}`,
        );

        if (outcome.attackerWins) {
          // Even a winning attacker takes proportional losses, same as the
          // player's own commitAttack; the survivors are what remains of the
          // Directorate's standing force going forward.
          directorateFleetStrength = applySurvivingShare(
            directorateFleetStrength,
            outcome.attackerLossFraction,
          );
          const result = applyDirectorateOccupation(
            resources,
            controllerOverrides,
            attack.systemId,
            attack.arrivalDay,
          );
          resources = result.resources;
          controllerOverrides = result.controllerOverrides;
          log.push(...result.logLines);
        } else {
          // A defensive win costs the Directorate its committed fleet
          // outright — nothing else about the system changes.
          directorateFleetStrength = 0;
          log.push(
            `Day ${dayLabel(attack.arrivalDay)} — The Directorate fleet is destroyed at ${targetName}.`,
          );
        }
      }
    }
  };

  const upkeep = dailyUpkeepFor(session.taxPolicy, session.completedFocusIds);

  for (let boundary = Math.floor(days) + 1; boundary <= target; boundary++) {
    days = boundary;
    resources = applyEffects(resources, upkeep);
    // Unseen passive production, the same way materiel accrues for the
    // Republic — never applied through Effects/describeEffects since it
    // isn't part of GameState and the player never sees it directly.
    directorateFleetStrength += DIRECTORATE_FLEET_GROWTH_PER_DAY;
    log.push(`Day ${boundary} — The war effort grinds on (${describeEffects(upkeep)}).`);
    settleDueWork(boundary);

    // Tracked at whole day precision, the same granularity as everything
    // else settled per boundary — see APPROVAL_COLLAPSE_DAYS in gameEnd.ts.
    if (resources.approval <= 0) {
      if (approvalCollapseStartDay === null) approvalCollapseStartDay = boundary;
    } else {
      approvalCollapseStartDay = null;
    }

    if (pendingCombat || pendingDirectorateCombat) {
      speed = 0;
      break;
    }

    // Periodic Directorate check: only one attack can be in flight at a
    // time, so skip entirely while one is already underway.
    if (!directorateAttack && boundary >= directorateNextCheckDay) {
      directorateNextCheckDay = boundary + rollDirectorateCheckInterval();
      if (directorateWantsToAttack(directorateFleetStrength, DIRECTORATE_TRAITS, DIRECTORATE_ATTACK_THRESHOLD)) {
        const targetId = pickDirectorateTarget(controllerOverrides, fleets);
        if (targetId) {
          const arrivalDays = rollDirectorateArrivalDays();
          directorateAttack = { systemId: targetId, arrivalDay: boundary + arrivalDays };
          pendingDirectorateAlert = { systemId: targetId, resumeSpeed: session.speed };
          log.push(
            `Day ${boundary} — ${NAVAL_INTELLIGENCE}: unidentified Directorate fleet movement ` +
              `detected. Estimated arrival at ${systemName(targetId)} in ${arrivalDays} days.`,
          );
        }
      }
    }

    const event = pickEventForDay(boundary, firedEventIds);
    if (event) {
      pendingEventId = event.id;
      firedEventIds = [...firedEventIds, event.id];
      log.push(`Day ${boundary} — Incoming dispatch: ${event.title}. Clock paused.`);
    }

    // An intelligence alert pauses the clock only briefly (the UI resumes it
    // automatically), but it still shares the same break-the-walk mechanism
    // a scripted event or combat arrival uses, so it always lands on a whole
    // day boundary rather than mid-tick.
    if (pendingDirectorateAlert || pendingEventId) {
      speed = 0;
      break;
    }
  }

  if (!pendingEventId && !pendingCombat && !pendingDirectorateAlert && !pendingDirectorateCombat) {
    days = target;
    settleDueWork(days);
    if (pendingCombat || pendingDirectorateCombat) speed = 0;
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
    pendingCombat,
    activeFocus,
    completedFocusIds,
    controllerOverrides,
    directorateFleetStrength,
    directorateNextCheckDay,
    directorateAttack,
    pendingDirectorateAlert,
    pendingDirectorateCombat,
    approvalCollapseStartDay,
  };
}

export type GameAction =
  | { type: 'choose'; choiceIndex: number }
  | { type: 'assignFleet'; fleetId: string; destinationId: string }
  | { type: 'buildShip'; systemId: string; shipType: ShipType }
  | { type: 'commitAttack'; stance: CombatStance }
  | { type: 'commitDirectorateDefense'; stance: CombatStance }
  | { type: 'commitInvasion'; fleetId: string }
  | { type: 'commitOccupation'; choiceIndex: number }
  | { type: 'setTaxPolicy'; policy: TaxPolicy }
  | { type: 'startFocus'; focusId: string }
  | { type: 'acknowledgeDirectorateAlert'; now: number }
  | { type: 'setSpeed'; speed: Speed; now: number }
  | { type: 'tick'; now: number }
  | { type: 'reset' };

function reducerCore(session: GameSession, action: GameAction): GameSession {
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
        speed:
          settled.pendingEventId ||
          settled.pendingCombat ||
          settled.pendingOccupation ||
          settled.pendingDirectorateAlert ||
          settled.pendingDirectorateCombat
            ? 0
            : action.speed,
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
      if (
        session.state.materiel < def.materielCost ||
        session.state.manpower < def.manpowerCost
      ) {
        return session;
      }

      const days = session.state.daysElapsed;
      const buildDays = Math.max(
        1,
        Math.round(def.buildDays * buildTimeMultiplierFor(session.completedFocusIds)),
      );
      const order: BuildOrder = {
        id: `build-${action.shipType}-${Math.round(days * 1000)}-${session.buildQueue.length}`,
        systemId: action.systemId,
        shipType: action.shipType,
        completesOnDay: days + buildDays,
      };
      const cost: Effects = { materiel: -def.materielCost, manpower: -def.manpowerCost };
      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — ${def.name} construction begun at ` +
          `${systemName(action.systemId)} (${describeEffects(cost)}); complete in ` +
          `${buildDays} days.`,
      ];

      return {
        ...session,
        state: { ...applyEffects(session.state, cost), log },
        buildQueue: [...session.buildQueue, order],
      };
    }

    case 'commitAttack': {
      const pending = session.pendingCombat;
      if (!pending) return session;
      const fleet = session.fleets.find((f) => f.id === pending.fleetId);
      // Defensive: the fleet or system should always exist here, but never
      // leave the clock stuck paused with no way to clear it if they don't.
      if (!fleet) return { ...session, pendingCombat: null };

      const days = session.state.daysElapsed;
      const attackerStrength = fleetStrength(fleet.composition);
      const defenderStrength = session.garrisons[pending.systemId] ?? 0;
      const outcome = resolveStanceCombat(attackerStrength, defenderStrength, action.stance);

      let survivors = applyCompositionLosses(fleet.composition, outcome.attackerLossFraction);
      const garrisonAfter = Math.max(
        0,
        Math.round(defenderStrength * (1 - outcome.defenderLossFraction)),
      );
      // Ground troops ride the same ships that just took losses, so they take
      // the same proportional hit naval combat dealt this fleet — not a
      // change to naval combat itself, just this new field participating in
      // the loss it already applies to everything else the fleet carries.
      const survivingTroops = applySurvivingShare(fleet.groundTroops, outcome.attackerLossFraction);

      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — Battle of ${systemName(pending.systemId)}: ${fleet.name} ` +
          `(${Math.round(attackerStrength)} strength) engages the garrison ` +
          `(${Math.round(defenderStrength)} strength) under a ${STANCE_LABEL[action.stance]} stance. ` +
          `${outcome.attackerWins ? `${fleet.name} prevails.` : 'The garrison holds.'}`,
      ];

      // Defensive stance never makes a last stand: a loss always retreats
      // with partial losses rather than being destroyed outright.
      const defensiveLossRetreat = action.stance === 'defensive' && !outcome.attackerWins;
      if (defensiveLossRetreat) survivors = guaranteeSurvivor(survivors, fleet.composition);
      const survivingStrength = fleetStrength(survivors);

      let fleets: Fleet[];
      if (survivingStrength <= 0) {
        fleets = session.fleets.filter((f) => f.id !== fleet.id);
        log.push(`Day ${dayLabel(days)} — ${fleet.name} is destroyed at ${systemName(pending.systemId)}.`);
      } else if (outcome.attackerWins) {
        fleets = session.fleets.map((f) =>
          f.id === fleet.id
            ? {
                ...f,
                location: pending.systemId,
                origin: null,
                destination: null,
                departureDay: 0,
                arrivalDay: 0,
                composition: survivors,
                groundTroops: survivingTroops,
              }
            : f,
        );
        log.push(
          `Day ${dayLabel(days)} — ${fleet.name} holds position at ` +
            `${systemName(pending.systemId)} (${describeComposition(survivors)} remain).`,
        );
        // No auto-resolved invasion: with troops aboard, Invade becomes
        // available in this system's Military tab whenever the player
        // chooses; with none, say plainly why the system stays contested.
        if (survivingTroops <= 0) {
          log.push(
            `Day ${dayLabel(days)} — ${systemName(pending.systemId)} is cleared but cannot be ` +
              'taken without landing forces; control has not changed hands.',
          );
        }
      } else {
        const fallback = nearestOtherSystem(pending.systemId);
        const eta = travelDays(pending.systemId, fallback);
        fleets = session.fleets.map((f) =>
          f.id === fleet.id
            ? {
                ...f,
                location: null,
                origin: pending.systemId,
                destination: fallback,
                departureDay: days,
                arrivalDay: days + eta,
                composition: survivors,
                groundTroops: survivingTroops,
              }
            : f,
        );
        log.push(
          `Day ${dayLabel(days)} — ${fleet.name} withdraws from ${systemName(pending.systemId)} ` +
            `toward ${systemName(fallback)} (${describeComposition(survivors)} remain); ` +
            `ETA ${eta} days.`,
        );
      }

      return {
        ...session,
        state: { ...session.state, log },
        fleets,
        garrisons: { ...session.garrisons, [pending.systemId]: garrisonAfter },
        pendingCombat: null,
      };
    }

    case 'commitDirectorateDefense': {
      const pending = session.pendingDirectorateCombat;
      if (!pending) return session;

      const days = session.state.daysElapsed;
      const targetName = systemName(pending.systemId);
      const defendingFleets = session.fleets.filter((f) => f.location === pending.systemId);
      const defenderStrength = defendingFleets.reduce(
        (sum, f) => sum + fleetStrength(f.composition),
        0,
      );
      const navalStrength = session.directorateFleetStrength * DIRECTORATE_NAVAL_SHARE;
      const groundTroops = session.directorateFleetStrength * (1 - DIRECTORATE_NAVAL_SHARE);

      // The defending Republic fleet is the stance holder here — the
      // Directorate's naval strength is the unmodified opponent, same
      // formula and variance as any other engagement.
      const outcome = resolveStanceCombat(defenderStrength, navalStrength, action.stance);
      const republicWins = outcome.attackerWins;
      const republicLossFraction = outcome.attackerLossFraction;
      const directorateLossFraction = outcome.defenderLossFraction;

      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — ${NAVAL_INTELLIGENCE}: the Directorate fleet reaches ${targetName} ` +
          `(${Math.round(navalStrength)} strength, an estimated ${Math.round(groundTroops)} ` +
          `ground troops aboard) and engages the defending fleet (${Math.round(defenderStrength)} ` +
          `strength) under a ${STANCE_LABEL[action.stance]} stance. ` +
          `${republicWins ? 'The Republic defense holds.' : 'The Directorate fleet breaks through.'}`,
      ];

      let fleets = session.fleets;
      if (action.stance === 'defensive' && !republicWins) {
        // Defensive: preserve the fleet by retreating rather than making a
        // last stand — the same retreat behavior a losing attacker uses.
        const fallback = nearestOtherSystem(pending.systemId);
        const eta = travelDays(pending.systemId, fallback);
        fleets = session.fleets.map((f) => {
          if (f.location !== pending.systemId) return f;
          const survivors = guaranteeSurvivor(
            applyCompositionLosses(f.composition, republicLossFraction),
            f.composition,
          );
          return {
            ...f,
            location: null,
            origin: pending.systemId,
            destination: fallback,
            departureDay: days,
            arrivalDay: days + eta,
            composition: survivors,
          };
        });
        log.push(
          `Day ${dayLabel(days)} — the defending fleet withdraws from ${targetName} toward ` +
            `${systemName(fallback)} rather than make a last stand; ETA ${eta} days.`,
        );
      } else if (defendingFleets.length > 0) {
        fleets = session.fleets.flatMap((f) => {
          if (f.location !== pending.systemId) return [f];
          const survivors = applyCompositionLosses(f.composition, republicLossFraction);
          if (fleetStrength(survivors) <= 0) {
            log.push(`Day ${dayLabel(days)} — ${f.name} is destroyed defending ${targetName}.`);
            return [];
          }
          return [{ ...f, composition: survivors }];
        });
      }

      let directorateFleetStrength = session.directorateFleetStrength;
      let controllerOverrides = session.controllerOverrides;
      let resources = session.state;

      if (!republicWins) {
        directorateFleetStrength = applySurvivingShare(directorateFleetStrength, directorateLossFraction);
        const result = applyDirectorateOccupation(resources, controllerOverrides, pending.systemId, days);
        resources = result.resources;
        controllerOverrides = result.controllerOverrides;
        log.push(...result.logLines);
      } else {
        directorateFleetStrength = 0;
        log.push(`Day ${dayLabel(days)} — The Directorate fleet is destroyed at ${targetName}.`);
      }

      return {
        ...session,
        state: { ...resources, log },
        fleets,
        directorateFleetStrength,
        controllerOverrides,
        pendingDirectorateCombat: null,
      };
    }

    case 'commitInvasion': {
      // Only one thing is ever allowed to pause the game at a time; refusing
      // here keeps that invariant even though nothing else currently calls
      // this action while another is pending.
      if (
        session.pendingEventId ||
        session.pendingCombat ||
        session.pendingOccupation ||
        session.pendingDirectorateAlert ||
        session.pendingDirectorateCombat
      ) {
        return session;
      }

      const fleet = session.fleets.find((f) => f.id === action.fleetId);
      if (!fleet || !fleet.location || fleet.groundTroops <= 0) return session;

      const systemId = fleet.location;
      const system = systemById(systemId);
      if (!system || currentController(system, session.controllerOverrides) === 'republic') {
        return session;
      }

      const days = session.state.daysElapsed;
      const attackerStrength = fleet.groundTroops;
      const defenderStrength = session.groundDefenses[systemId] ?? 0;
      // Same rollCombat formula naval combat uses, on a different pair of
      // strengths — nothing about naval combat's own resolution changes.
      const outcome = rollCombat(attackerStrength, defenderStrength);

      const survivingTroops = applySurvivingShare(fleet.groundTroops, outcome.attackerLossFraction);
      const defenseAfter = applySurvivingShare(defenderStrength, outcome.defenderLossFraction);

      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — Invasion committed: ${fleet.name} lands ` +
          `${Math.round(attackerStrength)} ground troops against ${systemName(systemId)}'s ` +
          `defense of ${Math.round(defenderStrength)}. ` +
          `${outcome.attackerWins ? `${fleet.name} secures a foothold on the surface.` : 'The landing is thrown back.'}`,
      ];

      const fleets = session.fleets.map((f) =>
        f.id === fleet.id ? { ...f, groundTroops: survivingTroops } : f,
      );
      const groundDefenses = { ...session.groundDefenses, [systemId]: defenseAfter };

      if (!outcome.attackerWins) {
        return { ...session, state: { ...session.state, log }, fleets, groundDefenses };
      }

      return {
        ...session,
        state: { ...session.state, log },
        fleets,
        groundDefenses,
        pendingOccupation: { systemId },
      };
    }

    case 'commitOccupation': {
      const pending = session.pendingOccupation;
      if (!pending) return session;
      const choice = OCCUPATION_CHOICES[action.choiceIndex];
      if (!choice) return session;

      const days = session.state.daysElapsed;
      const name = systemName(pending.systemId);
      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — ${choice.label}: ${choice.resultText(name)} ` +
          `(${describeEffects(choice.effects)})`,
      ];

      const controllerOverrides = choice.flipsControl
        ? { ...session.controllerOverrides, [pending.systemId]: 'republic' as const }
        : session.controllerOverrides;

      return {
        ...session,
        state: { ...applyEffects(session.state, choice.effects), log },
        controllerOverrides,
        pendingOccupation: null,
      };
    }

    case 'setTaxPolicy': {
      if (action.policy === session.taxPolicy) return session;

      const days = session.state.daysElapsed;
      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — Tax policy set to ${TAX_POLICY_LABEL[action.policy]}: ` +
          `${TAX_POLICY_CHANGE_TEXT[action.policy]}`,
      ];

      return { ...session, state: { ...session.state, log }, taxPolicy: action.policy };
    }

    case 'startFocus': {
      if (session.activeFocus) return session;
      const index = FOCUS_PATH.findIndex((f) => f.id === action.focusId);
      // Only the next focus in the path — the one right after however many
      // are already completed — can ever be started.
      if (index === -1 || index !== session.completedFocusIds.length) return session;
      const def = FOCUS_PATH[index];
      if (session.state.leadershipPoints < def.leadershipCost) return session;

      const days = session.state.daysElapsed;
      const cost: Effects = { leadershipPoints: -def.leadershipCost };
      const activeFocus: ActiveFocus = { id: def.id, completesOnDay: days + def.days };
      const log = [
        ...session.state.log,
        `Day ${dayLabel(days)} — ${def.startText} (${describeEffects(cost)}); complete in ` +
          `${def.days} days.`,
      ];

      return {
        ...session,
        state: { ...applyEffects(session.state, cost), log },
        activeFocus,
      };
    }

    case 'acknowledgeDirectorateAlert': {
      if (!session.pendingDirectorateAlert) return session;
      // A scripted event (or any other pending state) can land on the exact
      // same day boundary as the alert; acknowledging the alert must not
      // resume the clock out from under a decision still waiting on the
      // player, so it only restores the prior speed when nothing else is.
      const stillPaused =
        session.pendingEventId ||
        session.pendingCombat ||
        session.pendingOccupation ||
        session.pendingDirectorateCombat;
      return {
        ...session,
        pendingDirectorateAlert: null,
        speed: stillPaused ? 0 : session.pendingDirectorateAlert.resumeSpeed,
        lastTickAt: action.now,
      };
    }

    case 'reset':
      return initialSession();

    default:
      return session;
  }
}

function endLogLine(end: GameEndState): string {
  const label = end.result === 'victory' ? 'Victory' : 'Defeat';
  return `Day ${end.day} — ${label}: ${end.reason}`;
}

/** Checked after every action — see checkGameEnd in gameEnd.ts. A no-op once
 *  the game is already over: the reducer wrapper below refuses every action
 *  but 'reset' before this could ever run again. */
function applyGameEnd(session: GameSession): GameSession {
  if (session.gameOver) return session;
  const end = checkGameEnd(session);
  if (!end) return session;
  return {
    ...session,
    gameOver: end,
    speed: 0,
    state: { ...session.state, log: [...session.state.log, endLogLine(end)] },
  };
}

/**
 * The public reducer: runs every action through reducerCore, then checks
 * win and lose conditions on the result, effectively continuously since
 * every dispatch (including the 100ms clock tick) passes through here.
 * Once gameOver is set, every action but 'reset' is a no-op — the clock is
 * paused immediately and permanently, and nothing else can process.
 */
export function reducer(session: GameSession, action: GameAction): GameSession {
  if (session.gameOver && action.type !== 'reset') return session;
  return applyGameEnd(reducerCore(session, action));
}
