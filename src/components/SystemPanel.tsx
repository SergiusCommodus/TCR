import { findEvent } from '../game/events';
import { buildDaysOut, daysOut, describeComposition } from '../game/fleets';
import { SHIP_TYPE_LIST, SHIP_TYPES } from '../game/ships';
import { CONTROLLER_LABEL, HOME_SYSTEM_ID, SYSTEMS, systemName } from '../game/systems';
import { travelDays } from '../game/travel';
import type { SystemDef } from '../game/systems';
import type { BuildOrder, Fleet, ShipType } from '../game/types';
import DecisionCard from './DecisionCard';

export const TABS = ['Military', 'Buildings', 'Economy', 'Political'] as const;
export type Tab = (typeof TABS)[number];

interface Props {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
  /** The pending event id when it belongs to this system, otherwise null. */
  pendingEventId: string | null;
  fleets: Fleet[];
  buildQueue: BuildOrder[];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onChoose: (choiceIndex: number) => void;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
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
  fleets: Fleet[];
  buildQueue: BuildOrder[];
  onAssignFleet: (fleetId: string, destinationId: string) => void;
  onBuildShip: (systemId: string, shipType: ShipType) => void;
}

function BuildPanel({
  system,
  daysElapsed,
  materiel,
  buildQueue,
  onBuildShip,
}: {
  system: SystemDef;
  daysElapsed: number;
  materiel: number;
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
          const affordable = materiel >= def.materielCost;
          return (
            <button
              key={def.id}
              className="ghost"
              disabled={!affordable}
              title={affordable ? undefined : 'Not enough materiel'}
              onClick={() => onBuildShip(system.id, def.id)}
            >
              Build {def.name} · {def.materielCost} materiel, {def.buildDays}d
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

function MilitaryTab({
  system,
  daysElapsed,
  materiel,
  fleets,
  buildQueue,
  onAssignFleet,
  onBuildShip,
}: MilitaryProps) {
  const stationed = fleets.filter((f) => f.location === system.id);
  // Fleets that departed from this system and are currently between here and
  // wherever they were sent — this system's own record of where its ships are.
  const transiting = fleets.filter((f) => f.origin === system.id);
  const destinations = SYSTEMS.filter((s) => s.id !== system.id);

  return (
    <>
      <Placeholder title="Garrison and orbital defense">
        Ground formations, fortifications, and the local order of battle will live here.
      </Placeholder>

      {system.id === HOME_SYSTEM_ID && (
        <BuildPanel
          system={system}
          daysElapsed={daysElapsed}
          materiel={materiel}
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
          return (
            <p key={fleet.id} className="quiet">
              {fleet.name} ({describeComposition(fleet.composition)}) en route to{' '}
              {systemName(fleet.destination)}, {remaining} day{remaining === 1 ? '' : 's'} remaining.
            </p>
          );
        })}

        {stationed.map((fleet) => (
          <div key={fleet.id} className="fleet-order">
            <p className="fleet-name">{fleet.name} — stationed</p>
            <p className="quiet">{describeComposition(fleet.composition)}</p>
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
  pendingEventId,
  fleets,
  buildQueue,
  tab,
  onTabChange,
  onChoose,
  onAssignFleet,
  onBuildShip,
}: Props) {
  const event = pendingEventId ? findEvent(pendingEventId) : undefined;

  return (
    <aside className="system-panel">
      <header className={`panel-head head-${system.controller}`}>
        <p className="panel-eyebrow">{CONTROLLER_LABEL[system.controller]}</p>
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
            {name === 'Political' && event && <span className="tab-alert" aria-hidden="true" />}
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
            fleets={fleets}
            buildQueue={buildQueue}
            onAssignFleet={onAssignFleet}
            onBuildShip={onBuildShip}
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
            {event ? (
              <DecisionCard event={event} onChoose={onChoose} />
            ) : (
              <p className="quiet">No decision pending in this system.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
