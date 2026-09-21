import { useState } from 'react';
import { BUILDING_TYPE_LIST, BUILDING_TYPES } from '../game/buildings';
import { DIRECTORATE_NAVAL_SHARE } from '../game/directorate';
import { findEvent } from '../game/events';
import {
  buildDaysOut,
  daysOut,
  daysUntil,
  describeComposition,
  fleetStrength,
  groundTroopCapacity,
} from '../game/fleets';
import { FOCUS_PATH } from '../game/focuses';
import { occupationEventFor } from '../game/occupation';
import { formatMoney, formatPopulation } from '../game/scale';
import { SHIP_TYPE_LIST, SHIP_TYPES } from '../game/ships';
import { STANCES, STANCE_LABEL, estimateWinChance } from '../game/stance';
import { describeEffects, TAX_POLICIES, TAX_POLICY_LABEL, buildTimeMultiplierFor } from '../game/state';
import {
  CONTROLLER_LABEL,
  HOME_SYSTEM_ID,
  SYSTEMS,
  currentController,
  systemName,
} from '../game/systems';
import { TROOP_TRAINING } from '../game/troops';
import { travelDays } from '../game/travel';
import type { Controller, SystemDef } from '../game/systems';
import type { CombatStance } from '../game/stance';
import type {
  ActiveFocus,
  BuildingOrder,
  BuildingType,
  BuildOrder,
  Effects,
  Fleet,
  PendingCombat,
  PendingDirectorateCombat,
  PendingOccupation,
  PlacedBuilding,
  ShipType,
  StandingShipOrder,
  TaxPolicy,
  TroopTrainingOrder,
} from '../game/types';
import DecisionCard from './DecisionCard';

export const TABS = ['Military', 'Buildings', 'Economy', 'Political', 'Focus'] as const;
export type Tab = (typeof TABS)[number];

interface Props {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  manpower: number;
  /** The pending event id when it belongs to this system, otherwise null. */
  pendingEventId: string | null;
  /** Set only when this system is the one the pending combat is at. */
  pendingCombat: PendingCombat | null;
  /** Set only when this system is the one the pending occupation is at. */
  pendingOccupation: PendingOccupation | null;
  /** Set only when this system is the one a Directorate attack has arrived
   *  at and is awaiting a defend stance choice. */
  pendingDirectorateCombat: PendingDirectorateCombat | null;
  /** The Directorate's abstract fleet strength — only shown once a fleet
   *  built from it has actually arrived and is engaging here. */
  directorateFleetStrength: number;
  garrisons: Record<string, number>;
  groundDefenses: Record<string, number>;
  controllerOverrides: Record<string, Controller>;
  fleets: Fleet[];
  buildQueue: BuildOrder[];
  standingShipOrders: Record<string, StandingShipOrder>;
  trainingQueue: TroopTrainingOrder[];
  groundTroopPool: Record<string, number>;
  buildings: Record<string, PlacedBuilding[]>;
  buildingQueue: BuildingOrder[];
  taxPolicy: TaxPolicy;
  completedFocusIds: string[];
  activeFocus: ActiveFocus | null;
  leadershipPoints: number;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onChoose: (choiceIndex: number) => void;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
  onSetStandingShipOrder: (systemId: string, sequence: ShipType[]) => void;
  onCancelStandingShipOrder: (systemId: string) => void;
  onQueueBuilding: (systemId: string, buildingType: BuildingType) => void;
  onTrainTroops: (systemId: string) => void;
  onLoadTroops: (fleetId: string) => void;
  onCommitAttack: (stance: CombatStance) => void;
  onCommitDirectorateDefense: (stance: CombatStance) => void;
  onCommitInvasion: (fleetId: string) => void;
  onCommitOccupation: (choiceIndex: number) => void;
  onSetTaxPolicy: (policy: TaxPolicy) => void;
  onStartFocus: (focusId: string) => void;
  onMergeFleets: (fleetIds: string[], keepFleetId: string) => void;
}

function Placeholder({ title, children }: { title: string; children: string }) {
  return (
    <div className="placeholder">
      <h4>{title}</h4>
      <p>{children}</p>
      <span className="stub-tag">Not yet implemented</span>
    </div>
  );
}

interface MilitaryProps {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  manpower: number;
  fleets: Fleet[];
  buildQueue: BuildOrder[];
  standingShipOrders: Record<string, StandingShipOrder>;
  trainingQueue: TroopTrainingOrder[];
  groundTroopPool: Record<string, number>;
  buildingsHere: PlacedBuilding[];
  completedFocusIds: string[];
  pendingCombat: PendingCombat | null;
  pendingDirectorateCombat: PendingDirectorateCombat | null;
  directorateFleetStrength: number;
  garrisonStrength: number;
  groundDefenseStrength: number;
  isHostile: boolean;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
  onSetStandingShipOrder: (systemId: string, sequence: ShipType[]) => void;
  onCancelStandingShipOrder: (systemId: string) => void;
  onTrainTroops: (systemId: string) => void;
  onLoadTroops: (fleetId: string) => void;
  onCommitAttack: (stance: CombatStance) => void;
  onCommitDirectorateDefense: (stance: CombatStance) => void;
  onCommitInvasion: (fleetId: string) => void;
  onMergeFleets: (fleetIds: string[], keepFleetId: string) => void;
}

/**
 * The combat stance panel: reused both for a player initiated attack on a
 * Directorate or contested system and for defending a Republic system a
 * Directorate attack has just reached. `playerLabel`/`playerStrength` is
 * always the side the player is choosing a stance for, whichever side of
 * the engagement that happens to be; `opponentLabel`/`opponentStrength` is
 * the other side, unmodified by any stance. Three buttons replace the old
 * single Commit to Attack button, each showing an estimated win chance
 * before the player commits.
 */
function CombatOrdersPanel({
  heading,
  narrative,
  playerLabel,
  playerComposition,
  playerStrength,
  opponentLabel,
  opponentStrength,
  onCommit,
}: {
  heading: string;
  narrative: string;
  playerLabel: string;
  playerComposition?: Fleet['composition'];
  playerStrength: number;
  opponentLabel: string;
  opponentStrength: number;
  onCommit: (stance: CombatStance) => void;
}) {
  return (
    <section className="tab-section combat-orders">
      <h4>{heading}</h4>
      <p className="quiet">{narrative}</p>
      <div className="combat-sides">
        <div className="combat-side">
          <p className="combat-side-label">{playerLabel}</p>
          {playerComposition && <p className="quiet">{describeComposition(playerComposition)}</p>}
          <p className="combat-strength">{Math.round(playerStrength)} strength</p>
        </div>
        <div className="combat-side combat-side-defender">
          <p className="combat-side-label">{opponentLabel}</p>
          <p className="combat-strength">{Math.round(opponentStrength)} strength</p>
        </div>
      </div>
      <p className="quiet">Choose a stance — an estimate, not a guarantee:</p>
      <div className="stance-choices">
        {STANCES.map((stance) => (
          <button key={stance} className="stance-button" onClick={() => onCommit(stance)}>
            <span className="stance-name">{STANCE_LABEL[stance]}</span>
            <span className="stance-chance">
              {estimateWinChance(playerStrength, opponentStrength, stance)}% est. win
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Sets, changes or cancels a system's standing ship production order — a
 * repeating sequence the Shipyard keeps building automatically, one ship at
 * a time, without the player reissuing it. Before one is set, ship type
 * buttons build up a draft sequence (local UI state only, discarded on
 * confirm); once one is set, this shows what it's producing and how many
 * days remain, or that it's waiting on materiel, plus a Cancel button.
 */
function StandingOrderControl({
  system,
  daysElapsed,
  standingOrder,
  queueHere,
  onSet,
  onCancel,
}: {
  system: SystemDef;
  daysElapsed: number;
  standingOrder: StandingShipOrder | undefined;
  queueHere: BuildOrder[];
  onSet: (systemId: string, sequence: ShipType[]) => void;
  onCancel: (systemId: string) => void;
}) {
  const [draft, setDraft] = useState<ShipType[]>([]);

  if (standingOrder) {
    const label = standingOrder.sequence.map((t) => SHIP_TYPES[t].name).join(' → ');
    // The order's own in-flight build, if any — see BuildOrder.origin in
    // types.ts. Waiting on materiel shows no in-flight order at all, since
    // the refill check in runClock skips queueing one until affordable.
    const current = queueHere.find((order) => order.origin === 'standing');

    return (
      <div className="standing-order">
        <p className="quiet">Standing order: {label} (repeating).</p>
        {current ? (
          (() => {
            const remaining = buildDaysOut(current, daysElapsed);
            return (
              <p className="quiet">
                Currently producing {SHIP_TYPES[current.shipType].name} — {remaining} day
                {remaining === 1 ? '' : 's'} remaining.
              </p>
            );
          })()
        ) : (
          <p className="quiet">Waiting for materiel — will resume automatically once affordable.</p>
        )}
        <div className="fleet-buttons">
          <button className="ghost" onClick={() => onCancel(system.id)}>
            Cancel Standing Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="standing-order">
      <p className="quiet">
        Set a repeating standing order and the Shipyard keeps building it automatically, one ship
        at a time, resuming on its own if materiel runs short.
      </p>
      <div className="fleet-buttons">
        {SHIP_TYPE_LIST.map((def) => (
          <button key={def.id} className="ghost" onClick={() => setDraft([...draft, def.id])}>
            + {def.name}
          </button>
        ))}
      </div>
      {draft.length > 0 && (
        <>
          <p className="quiet">Draft: {draft.map((t) => SHIP_TYPES[t].name).join(' → ')}</p>
          <div className="fleet-buttons">
            <button className="ghost" onClick={() => onSet(system.id, draft)}>
              Set Standing Order
            </button>
            <button className="ghost" onClick={() => setDraft([])}>
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BuildPanel({
  system,
  daysElapsed,
  materiel,
  manpower,
  buildQueue,
  standingShipOrders,
  completedFocusIds,
  onBuildShip,
  onSetStandingShipOrder,
  onCancelStandingShipOrder,
}: {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  manpower: number;
  buildQueue: BuildOrder[];
  standingShipOrders: Record<string, StandingShipOrder>;
  completedFocusIds: string[];
  onBuildShip: (systemId: string, shipType: ShipType) => void;
  onSetStandingShipOrder: (systemId: string, sequence: ShipType[]) => void;
  onCancelStandingShipOrder: (systemId: string) => void;
}) {
  const queueHere = buildQueue.filter((order) => order.systemId === system.id);
  const buildMultiplier = buildTimeMultiplierFor(completedFocusIds);

  return (
    <section className="tab-section">
      <h4>Shipyard</h4>
      <p className="quiet">Ship construction is available here — see Buildings for the Shipyard itself.</p>
      <div className="fleet-buttons">
        {SHIP_TYPE_LIST.map((def) => {
          const affordable = materiel >= def.materielCost && manpower >= def.manpowerCost;
          const buildDays = Math.max(1, Math.round(def.buildDays * buildMultiplier));
          const cost =
            def.manpowerCost > 0
              ? `${formatMoney(def.materielCost)}, ${def.manpowerCost} manpower, ${buildDays}d`
              : `${formatMoney(def.materielCost)}, ${buildDays}d`;
          return (
            <button
              key={def.id}
              className="ghost"
              disabled={!affordable}
              title={affordable ? undefined : 'Not enough materiel or manpower'}
              onClick={() => onBuildShip(system.id, def.id)}
            >
              Build {def.name} · {cost}
            </button>
          );
        })}
      </div>

      {queueHere.length > 0 && (
        <div className="build-queue">
          <p className="quiet">Under construction:</p>
          {queueHere.map((order) => {
            const def = SHIP_TYPES[order.shipType];
            const remaining = buildDaysOut(order, daysElapsed);
            return (
              <p key={order.id} className="quiet">
                {def.name}, {remaining} day{remaining === 1 ? '' : 's'} remaining
                {order.origin === 'standing' ? ' (standing order)' : ''}.
              </p>
            );
          })}
        </div>
      )}

      <StandingOrderControl
        system={system}
        daysElapsed={daysElapsed}
        standingOrder={standingShipOrders[system.id]}
        queueHere={queueHere}
        onSet={onSetStandingShipOrder}
        onCancel={onCancelStandingShipOrder}
      />
    </section>
  );
}

function TroopTrainingPanel({
  system,
  daysElapsed,
  materiel,
  manpower,
  trainingQueue,
  groundTroopPool,
  onTrainTroops,
}: {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  manpower: number;
  trainingQueue: TroopTrainingOrder[];
  groundTroopPool: Record<string, number>;
  onTrainTroops: (systemId: string) => void;
}) {
  const queueHere = trainingQueue.filter((order) => order.systemId === system.id);
  const stationed = groundTroopPool[system.id] ?? 0;
  const affordable = materiel >= TROOP_TRAINING.materielCost && manpower >= TROOP_TRAINING.manpowerCost;

  return (
    <section className="tab-section">
      <h4>Ground Troop Training</h4>
      <p className="quiet">
        Trains directly from manpower and materiel, independent of Transport ships — those only
        carry troops once trained, via Load Troops below.
      </p>
      {stationed > 0 && (
        <p className="quiet">
          {stationed} ground troop{stationed === 1 ? '' : 's'} stationed here, awaiting Load Troops.
        </p>
      )}
      <div className="fleet-buttons">
        <button
          className="ghost"
          disabled={!affordable}
          title={affordable ? undefined : 'Not enough materiel or manpower'}
          onClick={() => onTrainTroops(system.id)}
        >
          Train {TROOP_TRAINING.count} Troops · {formatMoney(TROOP_TRAINING.materielCost)},{' '}
          {TROOP_TRAINING.manpowerCost} manpower, {TROOP_TRAINING.days}d
        </button>
      </div>

      {queueHere.length > 0 && (
        <div className="build-queue">
          <p className="quiet">In training:</p>
          {queueHere.map((order) => {
            const remaining = daysUntil(order.completesOnDay, daysElapsed);
            return (
              <p key={order.id} className="quiet">
                {TROOP_TRAINING.count} troops, {remaining} day{remaining === 1 ? '' : 's'} remaining.
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** A completed building's own daily effect, described the same way any
 *  other Effects object is — "materiel +$14M", "approval +0.2, population
 *  +500K" — or a plain note for Shipyard, which produces no numeric effect
 *  at all. */
function buildingEffectText(buildingType: BuildingType): string {
  const def = BUILDING_TYPES[buildingType];
  if (buildingType === 'shipyard') return 'Enables ship construction here';
  const effects: Effects = {
    materiel: def.materielPerDay,
    approval: def.approvalPerDay,
    population: def.populationPerDay,
  };
  return describeEffects(effects);
}

function BuildingsPanel({
  system,
  daysElapsed,
  materiel,
  buildingsHere,
  queueHere,
  isRepublic,
  onQueueBuilding,
}: {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  buildingsHere: PlacedBuilding[];
  queueHere: BuildingOrder[];
  isRepublic: boolean;
  onQueueBuilding: (systemId: string, buildingType: BuildingType) => void;
}) {
  if (!isRepublic) {
    return (
      <section className="tab-section">
        <h4>Buildings</h4>
        <p className="quiet">
          {system.name} isn't under Republic control — buildings can only be queued once it is.
        </p>
      </section>
    );
  }

  const usedSlots = buildingsHere.length + queueHere.length;
  const hasShipyard = buildingsHere.some((b) => b.type === 'shipyard') || queueHere.some((o) => o.buildingType === 'shipyard');
  const totalIncome: Effects = {};
  for (const building of buildingsHere) {
    const def = BUILDING_TYPES[building.type];
    if (def.materielPerDay) totalIncome.materiel = (totalIncome.materiel ?? 0) + def.materielPerDay;
    if (def.approvalPerDay) totalIncome.approval = (totalIncome.approval ?? 0) + def.approvalPerDay;
    if (def.populationPerDay) totalIncome.population = (totalIncome.population ?? 0) + def.populationPerDay;
  }

  return (
    <section className="tab-section">
      <h4>Buildings</h4>
      <p className="quiet">
        {usedSlots} of {system.buildingSlots} slots used.
      </p>
      {buildingsHere.length > 0 && (
        <p className="quiet">This system generates {describeEffects(totalIncome)} per day.</p>
      )}

      <div className="fleet-buttons">
        {BUILDING_TYPE_LIST.map((def) => {
          const affordable = materiel >= def.materielCost;
          const slotFree = usedSlots < system.buildingSlots;
          const redundantShipyard = def.id === 'shipyard' && hasShipyard;
          const disabled = !affordable || !slotFree || redundantShipyard;
          const title = redundantShipyard
            ? 'Already has a Shipyard'
            : !slotFree
              ? 'No free building slot'
              : !affordable
                ? 'Not enough materiel'
                : undefined;
          return (
            <button
              key={def.id}
              className="ghost"
              disabled={disabled}
              title={title}
              onClick={() => onQueueBuilding(system.id, def.id)}
            >
              Build {def.name} · {formatMoney(def.materielCost)}, {def.buildDays}d
            </button>
          );
        })}
      </div>

      {queueHere.length > 0 && (
        <div className="build-queue">
          <p className="quiet">Under construction:</p>
          {queueHere.map((order) => {
            const def = BUILDING_TYPES[order.buildingType];
            const remaining = daysUntil(order.completesOnDay, daysElapsed);
            return (
              <p key={order.id} className="quiet">
                {def.name}, {remaining} day{remaining === 1 ? '' : 's'} remaining.
              </p>
            );
          })}
        </div>
      )}

      {buildingsHere.length > 0 && (
        <div className="build-queue">
          <p className="quiet">Completed, broken out by building:</p>
          {buildingsHere.map((building) => {
            const def = BUILDING_TYPES[building.type];
            return (
              <p key={building.id} className="quiet">
                {def.name} — {buildingEffectText(building.type)}
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaxPolicyControl({
  taxPolicy,
  onSetTaxPolicy,
}: {
  taxPolicy: TaxPolicy;
  onSetTaxPolicy: (policy: TaxPolicy) => void;
}) {
  return (
    <section className="tab-section tax-policy">
      <h4>Tax Policy</h4>
      <p className="quiet">
        Low trades materiel income for approval over time; Wartime trades the other way.
        Standard is the untouched baseline. Takes effect immediately and holds until changed.
      </p>
      <div className="speed" role="group" aria-label="Tax policy">
        {TAX_POLICIES.map((policy) => (
          <button
            key={policy}
            className={policy === taxPolicy ? 'speed-button is-active' : 'speed-button'}
            aria-pressed={policy === taxPolicy}
            onClick={() => onSetTaxPolicy(policy)}
          >
            {TAX_POLICY_LABEL[policy]}
          </button>
        ))}
      </div>
    </section>
  );
}

function FocusTreeControl({
  daysElapsed,
  leadershipPoints,
  completedFocusIds,
  activeFocus,
  onStartFocus,
}: {
  daysElapsed: number;
  leadershipPoints: number;
  completedFocusIds: string[];
  activeFocus: ActiveFocus | null;
  onStartFocus: (focusId: string) => void;
}) {
  const nextIndex = completedFocusIds.length;
  const active = activeFocus ? FOCUS_PATH.find((f) => f.id === activeFocus.id) : undefined;
  const remaining = activeFocus ? daysUntil(activeFocus.completesOnDay, daysElapsed) : null;

  return (
    <section className="tab-section focus-tree">
      <h4>National Focus</h4>
      <p className="quiet">
        A single national track of policy and mobilization. Only one focus can be underway at a
        time, and each unlocks the next.
      </p>

      {active && remaining !== null && (
        <p className="focus-active-summary">
          {active.name} underway — {remaining} day{remaining === 1 ? '' : 's'} remaining.
        </p>
      )}

      <div className="focus-path">
        {FOCUS_PATH.map((focus, index) => {
          const completed = index < nextIndex;
          const isActive = index === nextIndex && activeFocus?.id === focus.id;
          const isNext = index === nextIndex && !isActive;
          const locked = index > nextIndex;
          const affordable = leadershipPoints >= focus.leadershipCost;
          const focusRemaining =
            isActive && activeFocus ? daysUntil(activeFocus.completesOnDay, daysElapsed) : null;

          const status = completed
            ? 'is-complete'
            : isActive
              ? 'is-active'
              : locked
                ? 'is-locked'
                : 'is-next';

          return (
            <div key={focus.id} className={`focus-node ${status}`}>
              <div className="focus-node-head">
                <span className="focus-node-name">{focus.name}</span>
                {completed && <span className="focus-node-tag">Completed</span>}
                {isActive && <span className="focus-node-tag">In progress</span>}
                {locked && <span className="focus-node-tag">Locked</span>}
              </div>
              <p className="quiet">{focus.description}</p>
              <p className="quiet">
                {focus.days} days · {focus.leadershipCost} leadership
              </p>
              {isActive && focusRemaining !== null && (
                <p className="focus-remaining">
                  {focusRemaining} day{focusRemaining === 1 ? '' : 's'} remaining
                </p>
              )}
              {isNext && (
                <button
                  className="ghost"
                  disabled={!affordable}
                  title={affordable ? undefined : 'Not enough leadership points'}
                  onClick={() => onStartFocus(focus.id)}
                >
                  Begin
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MilitaryTab({
  system,
  daysElapsed,
  materiel,
  manpower,
  fleets,
  buildQueue,
  standingShipOrders,
  trainingQueue,
  groundTroopPool,
  buildingsHere,
  completedFocusIds,
  pendingCombat,
  pendingDirectorateCombat,
  directorateFleetStrength,
  garrisonStrength,
  groundDefenseStrength,
  isHostile,
  onAssignFleet,
  onBuildShip,
  onSetStandingShipOrder,
  onCancelStandingShipOrder,
  onTrainTroops,
  onLoadTroops,
  onCommitAttack,
  onCommitDirectorateDefense,
  onCommitInvasion,
  onMergeFleets,
}: MilitaryProps) {
  const stationed = fleets.filter((f) => f.location === system.id);
  // Fleets that departed from this system and are currently between here and
  // wherever they were sent — this system's own record of where its ships are.
  const transiting = fleets.filter((f) => f.origin === system.id);
  const destinations = SYSTEMS.filter((s) => s.id !== system.id);
  const combatFleet = pendingCombat ? fleets.find((f) => f.id === pendingCombat.fleetId) : undefined;
  const directorateCombatHere = pendingDirectorateCombat?.systemId === system.id;
  const defendingStrengthHere = stationed.reduce((sum, f) => sum + fleetStrength(f.composition), 0);
  const troopPoolHere = groundTroopPool[system.id] ?? 0;
  const hasShipyard = buildingsHere.some((b) => b.type === 'shipyard');

  return (
    <>
      {combatFleet && (
        <CombatOrdersPanel
          heading="Combat Orders"
          narrative={`${combatFleet.name} has arrived and is holding at the system edge, awaiting orders.`}
          playerLabel="Attacking"
          playerComposition={combatFleet.composition}
          playerStrength={fleetStrength(combatFleet.composition)}
          opponentLabel="Defending garrison"
          opponentStrength={garrisonStrength}
          onCommit={onCommitAttack}
        />
      )}

      {directorateCombatHere && (
        <CombatOrdersPanel
          heading="Combat Orders"
          narrative="A Directorate fleet has reached this system and is closing on the defending fleet."
          playerLabel="Defending fleet"
          playerStrength={defendingStrengthHere}
          opponentLabel="Directorate fleet"
          opponentStrength={directorateFleetStrength * DIRECTORATE_NAVAL_SHARE}
          onCommit={onCommitDirectorateDefense}
        />
      )}

      <Placeholder title="Garrison and orbital defense">
        Ground formations, fortifications, and the local order of battle will live here.
      </Placeholder>

      {hasShipyard && (
        <BuildPanel
          system={system}
          daysElapsed={daysElapsed}
          materiel={materiel}
          manpower={manpower}
          buildQueue={buildQueue}
          standingShipOrders={standingShipOrders}
          completedFocusIds={completedFocusIds}
          onBuildShip={onBuildShip}
          onSetStandingShipOrder={onSetStandingShipOrder}
          onCancelStandingShipOrder={onCancelStandingShipOrder}
        />
      )}

      {system.id === HOME_SYSTEM_ID && (
        <TroopTrainingPanel
          system={system}
          daysElapsed={daysElapsed}
          materiel={materiel}
          manpower={manpower}
          trainingQueue={trainingQueue}
          groundTroopPool={groundTroopPool}
          onTrainTroops={onTrainTroops}
        />
      )}

      <section className="tab-section">
        <h4>Fleets</h4>
        {stationed.length === 0 && transiting.length === 0 && (
          <p className="quiet">No fleets stationed here or in transit from here.</p>
        )}

        {transiting.map((fleet) => {
          const remaining = daysOut(fleet, daysElapsed);
          const arrived = pendingCombat?.fleetId === fleet.id;
          return (
            <p key={fleet.id} className="quiet">
              {fleet.name} ({describeComposition(fleet.composition)}){' '}
              {arrived
                ? `has reached ${systemName(fleet.destination)} and awaits combat orders.`
                : `en route to ${systemName(fleet.destination)}, ${remaining} day${
                    remaining === 1 ? '' : 's'
                  } remaining.`}
            </p>
          );
        })}

        {stationed.map((fleet) => {
          const capacity = groundTroopCapacity(fleet.composition);
          const room = capacity - fleet.groundTroops;
          const toLoad = Math.min(room, troopPoolHere);
          return (
          <div key={fleet.id} className="fleet-order">
            <p className="fleet-name">{fleet.name} — stationed</p>
            <p className="quiet">{describeComposition(fleet.composition)}</p>

            {capacity > 0 && (
              <p className="quiet">
                {fleet.groundTroops} of {capacity} ground troop capacity loaded.
              </p>
            )}

            {toLoad > 0 && (
              <div className="fleet-buttons">
                <button className="ghost" onClick={() => onLoadTroops(fleet.id)}>
                  Load Troops · +{toLoad}
                </button>
              </div>
            )}

            {isHostile && fleet.groundTroops > 0 && (
              <div className="fleet-buttons">
                <button className="ghost invade" onClick={() => onCommitInvasion(fleet.id)}>
                  Invade · defense {groundDefenseStrength}
                </button>
              </div>
            )}

            {isHostile && fleet.groundTroops <= 0 && (
              <p className="quiet">
                The system is cleared but cannot be taken without landing forces.
              </p>
            )}

            {stationed.length > 1 && (
              <div className="fleet-buttons">
                <button
                  className="ghost merge"
                  onClick={() =>
                    onMergeFleets(
                      stationed.map((s) => s.id),
                      fleet.id,
                    )
                  }
                >
                  Merge {stationed.length} fleets into {fleet.name}
                </button>
              </div>
            )}

            <p className="quiet">Assign a destination:</p>
            <div className="fleet-buttons">
              {destinations.map((target) => (
                <button
                  key={target.id}
                  className="ghost"
                  onClick={() => onAssignFleet(fleet.id, target.id)}
                >
                  Send to {target.name} · {travelDays(system.id, target.id)}d
                </button>
              ))}
            </div>
          </div>
          );
        })}
      </section>
    </>
  );
}

export default function SystemPanel({
  system,
  daysElapsed,
  materiel,
  manpower,
  pendingEventId,
  pendingCombat,
  pendingOccupation,
  pendingDirectorateCombat,
  directorateFleetStrength,
  garrisons,
  groundDefenses,
  controllerOverrides,
  fleets,
  buildQueue,
  standingShipOrders,
  trainingQueue,
  groundTroopPool,
  buildings,
  buildingQueue,
  taxPolicy,
  completedFocusIds,
  activeFocus,
  leadershipPoints,
  tab,
  onTabChange,
  onChoose,
  onAssignFleet,
  onBuildShip,
  onSetStandingShipOrder,
  onCancelStandingShipOrder,
  onQueueBuilding,
  onTrainTroops,
  onLoadTroops,
  onCommitAttack,
  onCommitDirectorateDefense,
  onCommitInvasion,
  onCommitOccupation,
  onSetTaxPolicy,
  onStartFocus,
  onMergeFleets,
}: Props) {
  const event = pendingEventId ? findEvent(pendingEventId) : undefined;
  const controller = currentController(system, controllerOverrides);
  const isHostile = controller !== 'republic';
  const occupationEvent = pendingOccupation ? occupationEventFor(system.name) : undefined;
  const buildingsHere = buildings[system.id] ?? [];
  const buildingQueueHere = buildingQueue.filter((o) => o.systemId === system.id);

  return (
    <aside className="system-panel">
      <header className={`panel-head head-${controller}`}>
        <p className="panel-eyebrow">{CONTROLLER_LABEL[controller]}</p>
        <h2>{system.name}</h2>
        <p className="panel-note">{system.note}</p>
        <dl className="panel-stats">
          <div>
            <dt>Population</dt>
            <dd>{formatPopulation(system.population)}</dd>
          </div>
          {isHostile && (
            <>
              <div>
                <dt>Garrison</dt>
                <dd>{garrisons[system.id] ?? 0}</dd>
              </div>
              <div>
                <dt>Ground Defense</dt>
                <dd>{groundDefenses[system.id] ?? 0}</dd>
              </div>
            </>
          )}
        </dl>
      </header>

      <div className="tabs" role="tablist" aria-label={`${system.name} administration`}>
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            id={`tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`tabpanel-${name}`}
            className={tab === name ? 'tab is-active' : 'tab'}
            onClick={() => onTabChange(name)}
          >
            {name}
            {name === 'Political' && (event || occupationEvent) && (
              <span className="tab-alert" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <div
        className="tab-body"
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'Military' && (
          <MilitaryTab
            system={system}
            daysElapsed={daysElapsed}
            materiel={materiel}
            manpower={manpower}
            fleets={fleets}
            buildQueue={buildQueue}
            standingShipOrders={standingShipOrders}
            trainingQueue={trainingQueue}
            groundTroopPool={groundTroopPool}
            buildingsHere={buildingsHere}
            completedFocusIds={completedFocusIds}
            pendingCombat={pendingCombat}
            pendingDirectorateCombat={pendingDirectorateCombat}
            directorateFleetStrength={directorateFleetStrength}
            garrisonStrength={garrisons[system.id] ?? 0}
            groundDefenseStrength={groundDefenses[system.id] ?? 0}
            isHostile={isHostile}
            onAssignFleet={onAssignFleet}
            onBuildShip={onBuildShip}
            onSetStandingShipOrder={onSetStandingShipOrder}
            onCancelStandingShipOrder={onCancelStandingShipOrder}
            onTrainTroops={onTrainTroops}
            onLoadTroops={onLoadTroops}
            onCommitAttack={onCommitAttack}
            onCommitDirectorateDefense={onCommitDirectorateDefense}
            onCommitInvasion={onCommitInvasion}
            onMergeFleets={onMergeFleets}
          />
        )}

        {tab === 'Buildings' && (
          <BuildingsPanel
            system={system}
            daysElapsed={daysElapsed}
            materiel={materiel}
            buildingsHere={buildingsHere}
            queueHere={buildingQueueHere}
            isRepublic={!isHostile}
            onQueueBuilding={onQueueBuilding}
          />
        )}

        {tab === 'Economy' && (
          <Placeholder title="Production and trade">
            Local materiel output, trade routes, and supply throughput will be reported here.
          </Placeholder>
        )}

        {tab === 'Political' && (
          <>
            {occupationEvent ? (
              <DecisionCard event={occupationEvent} onChoose={onCommitOccupation} />
            ) : event ? (
              <DecisionCard event={event} onChoose={onChoose} />
            ) : (
              <p className="quiet">No decision pending in this system.</p>
            )}
            <TaxPolicyControl taxPolicy={taxPolicy} onSetTaxPolicy={onSetTaxPolicy} />
          </>
        )}

        {tab === 'Focus' && (
          <FocusTreeControl
            daysElapsed={daysElapsed}
            leadershipPoints={leadershipPoints}
            completedFocusIds={completedFocusIds}
            activeFocus={activeFocus}
            onStartFocus={onStartFocus}
          />
        )}
      </div>
    </aside>
  );
}
