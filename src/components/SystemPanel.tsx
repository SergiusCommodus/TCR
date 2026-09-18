import { findEvent } from '../game/events';
import { buildDaysOut, daysOut, describeComposition, fleetStrength } from '../game/fleets';
import { occupationEventFor } from '../game/occupation';
import { SHIP_TYPE_LIST, SHIP_TYPES } from '../game/ships';
import { TAX_POLICIES, TAX_POLICY_LABEL } from '../game/state';
import {
  CONTROLLER_LABEL,
  HOME_SYSTEM_ID,
  SYSTEMS,
  currentController,
  systemName,
} from '../game/systems';
import { travelDays } from '../game/travel';
import type { Controller, SystemDef } from '../game/systems';
import type {
  BuildOrder,
  Fleet,
  PendingCombat,
  PendingOccupation,
  ShipType,
  TaxPolicy,
} from '../game/types';
import DecisionCard from './DecisionCard';

export const TABS = ['Military', 'Buildings', 'Economy', 'Political'] as const;
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
  garrisons: Record<string, number>;
  groundDefenses: Record<string, number>;
  controllerOverrides: Record<string, Controller>;
  fleets: Fleet[];
  buildQueue: BuildOrder[];
  taxPolicy: TaxPolicy;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onChoose: (choiceIndex: number) => void;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
  onCommitAttack: () => void;
  onCommitInvasion: (fleetId: string) => void;
  onCommitOccupation: (choiceIndex: number) => void;
  onSetTaxPolicy: (policy: TaxPolicy) => void;
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
  pendingCombat: PendingCombat | null;
  garrisonStrength: number;
  groundDefenseStrength: number;
  isHostile: boolean;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
  onCommitAttack: () => void;
  onCommitInvasion: (fleetId: string) => void;
}

function CombatOrdersPanel({
  fleet,
  attackerStrength,
  defenderStrength,
  onCommitAttack,
}: {
  fleet: Fleet;
  attackerStrength: number;
  defenderStrength: number;
  onCommitAttack: () => void;
}) {
  return (
    <section className="tab-section combat-orders">
      <h4>Combat Orders</h4>
      <p className="quiet">
        {fleet.name} has arrived and is holding at the system edge, awaiting orders.
      </p>
      <div className="combat-sides">
        <div className="combat-side">
          <p className="combat-side-label">Attacking</p>
          <p className="fleet-name">{fleet.name}</p>
          <p className="quiet">{describeComposition(fleet.composition)}</p>
          <p className="combat-strength">{attackerStrength} strength</p>
        </div>
        <div className="combat-side combat-side-defender">
          <p className="combat-side-label">Defending garrison</p>
          <p className="combat-strength">{defenderStrength} strength</p>
        </div>
      </div>
      <button className="commit-attack" onClick={onCommitAttack}>
        Commit to Attack
      </button>
    </section>
  );
}

function BuildPanel({
  system,
  daysElapsed,
  materiel,
  manpower,
  buildQueue,
  onBuildShip,
}: {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  manpower: number;
  buildQueue: BuildOrder[];
  onBuildShip: (systemId: string, shipType: ShipType) => void;
}) {
  const queueHere = buildQueue.filter((order) => order.systemId === system.id);

  return (
    <section className="tab-section">
      <h4>Shipyard</h4>
      <p className="quiet">Construction is available at Sol for now.</p>
      <div className="fleet-buttons">
        {SHIP_TYPE_LIST.map((def) => {
          const affordable = materiel >= def.materielCost && manpower >= def.manpowerCost;
          const cost =
            def.manpowerCost > 0
              ? `${def.materielCost} materiel, ${def.manpowerCost} manpower, ${def.buildDays}d`
              : `${def.materielCost} materiel, ${def.buildDays}d`;
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

function MilitaryTab({
  system,
  daysElapsed,
  materiel,
  manpower,
  fleets,
  buildQueue,
  pendingCombat,
  garrisonStrength,
  groundDefenseStrength,
  isHostile,
  onAssignFleet,
  onBuildShip,
  onCommitAttack,
  onCommitInvasion,
}: MilitaryProps) {
  const stationed = fleets.filter((f) => f.location === system.id);
  // Fleets that departed from this system and are currently between here and
  // wherever they were sent — this system's own record of where its ships are.
  const transiting = fleets.filter((f) => f.origin === system.id);
  const destinations = SYSTEMS.filter((s) => s.id !== system.id);
  const combatFleet = pendingCombat ? fleets.find((f) => f.id === pendingCombat.fleetId) : undefined;

  return (
    <>
      {combatFleet && (
        <CombatOrdersPanel
          fleet={combatFleet}
          attackerStrength={fleetStrength(combatFleet.composition)}
          defenderStrength={garrisonStrength}
          onCommitAttack={onCommitAttack}
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
  garrisons,
  groundDefenses,
  controllerOverrides,
  fleets,
  buildQueue,
  taxPolicy,
  tab,
  onTabChange,
  onChoose,
  onAssignFleet,
  onBuildShip,
  onCommitAttack,
  onCommitInvasion,
  onCommitOccupation,
  onSetTaxPolicy,
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
            pendingCombat={pendingCombat}
            garrisonStrength={garrisons[system.id] ?? 0}
            groundDefenseStrength={groundDefenses[system.id] ?? 0}
            isHostile={isHostile}
            onAssignFleet={onAssignFleet}
            onBuildShip={onBuildShip}
            onCommitAttack={onCommitAttack}
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
      </div>
    </aside>
  );
}
