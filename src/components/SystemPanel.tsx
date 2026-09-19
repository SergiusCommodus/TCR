import { DIRECTORATE_NAVAL_SHARE } from '../game/directorate';
import { findEvent } from '../game/events';
import { buildDaysOut, daysOut, daysUntil, describeComposition, fleetStrength } from '../game/fleets';
import { FOCUS_PATH } from '../game/focuses';
import { occupationEventFor } from '../game/occupation';
import { SHIP_TYPE_LIST, SHIP_TYPES } from '../game/ships';
import { STANCES, STANCE_LABEL, estimateWinChance } from '../game/stance';
import { TAX_POLICIES, TAX_POLICY_LABEL, buildTimeMultiplierFor } from '../game/state';
import {
  CONTROLLER_LABEL,
  HOME_SYSTEM_ID,
  SYSTEMS,
  currentController,
  systemName,
} from '../game/systems';
import { travelDays } from '../game/travel';
import type { Controller, SystemDef } from '../game/systems';
import type { CombatStance } from '../game/stance';
import type {
  ActiveFocus,
  BuildOrder,
  Fleet,
  PendingCombat,
  PendingDirectorateCombat,
  PendingOccupation,
  ShipType,
  TaxPolicy,
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
  taxPolicy: TaxPolicy;
  completedFocusIds: string[];
  activeFocus: ActiveFocus | null;
  leadershipPoints: number;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onChoose: (choiceIndex: number) => void;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
  onCommitAttack: (stance: CombatStance) => void;
  onCommitDirectorateDefense: (stance: CombatStance) => void;
  onCommitInvasion: (fleetId: string) => void;
  onCommitOccupation: (choiceIndex: number) => void;
  onSetTaxPolicy: (policy: TaxPolicy) => void;
  onStartFocus: (focusId: string) => void;
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
  completedFocusIds: string[];
  pendingCombat: PendingCombat | null;
  pendingDirectorateCombat: PendingDirectorateCombat | null;
  directorateFleetStrength: number;
  garrisonStrength: number;
  groundDefenseStrength: number;
  isHostile: boolean;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
  onCommitAttack: (stance: CombatStance) => void;
  onCommitDirectorateDefense: (stance: CombatStance) => void;
  onCommitInvasion: (fleetId: string) => void;
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

function BuildPanel({
  system,
  daysElapsed,
  materiel,
  manpower,
  buildQueue,
  completedFocusIds,
  onBuildShip,
}: {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  manpower: number;
  buildQueue: BuildOrder[];
  completedFocusIds: string[];
  onBuildShip: (systemId: string, shipType: ShipType) => void;
}) {
  const queueHere = buildQueue.filter((order) => order.systemId === system.id);
  const buildMultiplier = buildTimeMultiplierFor(completedFocusIds);

  return (
    <section className="tab-section">
      <h4>Shipyard</h4>
      <p className="quiet">Construction is available at Sol for now.</p>
      <div className="fleet-buttons">
        {SHIP_TYPE_LIST.map((def) => {
          const affordable = materiel >= def.materielCost && manpower >= def.manpowerCost;
          const buildDays = Math.max(1, Math.round(def.buildDays * buildMultiplier));
          const cost =
            def.manpowerCost > 0
              ? `${def.materielCost} materiel, ${def.manpowerCost} manpower, ${buildDays}d`
              : `${def.materielCost} materiel, ${buildDays}d`;
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
                {def.name}, {remaining} day{remaining === 1 ? '' : 's'} remaining.
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
  completedFocusIds,
  pendingCombat,
  pendingDirectorateCombat,
  directorateFleetStrength,
  garrisonStrength,
  groundDefenseStrength,
  isHostile,
  onAssignFleet,
  onBuildShip,
  onCommitAttack,
  onCommitDirectorateDefense,
  onCommitInvasion,
}: MilitaryProps) {
  const stationed = fleets.filter((f) => f.location === system.id);
  // Fleets that departed from this system and are currently between here and
  // wherever they were sent — this system's own record of where its ships are.
  const transiting = fleets.filter((f) => f.origin === system.id);
  const destinations = SYSTEMS.filter((s) => s.id !== system.id);
  const combatFleet = pendingCombat ? fleets.find((f) => f.id === pendingCombat.fleetId) : undefined;
  const directorateCombatHere = pendingDirectorateCombat?.systemId === system.id;
  const defendingStrengthHere = stationed.reduce((sum, f) => sum + fleetStrength(f.composition), 0);

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

      {system.id === HOME_SYSTEM_ID && (
        <BuildPanel
          system={system}
          daysElapsed={daysElapsed}
          materiel={materiel}
          manpower={manpower}
          buildQueue={buildQueue}
          completedFocusIds={completedFocusIds}
          onBuildShip={onBuildShip}
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

        {stationed.map((fleet) => (
          <div key={fleet.id} className="fleet-order">
            <p className="fleet-name">{fleet.name} — stationed</p>
            <p className="quiet">{describeComposition(fleet.composition)}</p>

            {isHostile && (
              <p className="quiet">
                {fleet.groundTroops > 0
                  ? `${fleet.groundTroops} ground troops aboard.`
                  : 'No ground troops aboard.'}
              </p>
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
        ))}
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
  taxPolicy,
  completedFocusIds,
  activeFocus,
  leadershipPoints,
  tab,
  onTabChange,
  onChoose,
  onAssignFleet,
  onBuildShip,
  onCommitAttack,
  onCommitDirectorateDefense,
  onCommitInvasion,
  onCommitOccupation,
  onSetTaxPolicy,
  onStartFocus,
}: Props) {
  const event = pendingEventId ? findEvent(pendingEventId) : undefined;
  const controller = currentController(system, controllerOverrides);
  const isHostile = controller !== 'republic';
  const occupationEvent = pendingOccupation ? occupationEventFor(system.name) : undefined;

  return (
    <aside className="system-panel">
      <header className={`panel-head head-${controller}`}>
        <p className="panel-eyebrow">{CONTROLLER_LABEL[controller]}</p>
        <h2>{system.name}</h2>
        <p className="panel-note">{system.note}</p>
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
            completedFocusIds={completedFocusIds}
            pendingCombat={pendingCombat}
            pendingDirectorateCombat={pendingDirectorateCombat}
            directorateFleetStrength={directorateFleetStrength}
            garrisonStrength={garrisons[system.id] ?? 0}
            groundDefenseStrength={groundDefenses[system.id] ?? 0}
            isHostile={isHostile}
            onAssignFleet={onAssignFleet}
            onBuildShip={onBuildShip}
            onCommitAttack={onCommitAttack}
            onCommitDirectorateDefense={onCommitDirectorateDefense}
            onCommitInvasion={onCommitInvasion}
          />
        )}

        {tab === 'Buildings' && (
          <Placeholder title="Construction">
            Shipyards, factories, and defensive works will be queued and built here.
          </Placeholder>
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
