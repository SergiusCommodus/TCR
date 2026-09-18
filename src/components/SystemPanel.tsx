import { findEvent } from '../game/events';
import { TRAVEL_TURNS } from '../game/state';
import { CONTROLLER_LABEL, SYSTEMS, systemName } from '../game/systems';
import type { SystemDef } from '../game/systems';
import type { Fleet } from '../game/types';
import DecisionCard from './DecisionCard';

export const TABS = ['Military', 'Buildings', 'Economy', 'Political'] as const;
export type Tab = (typeof TABS)[number];

interface Props {
  system: SystemDef;
  /** The pending event id when it belongs to this system, otherwise null. */
  pendingEventId: string | null;
  fleets: Fleet[];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onChoose: (choiceIndex: number) => void;
  onAssignFleet: (fleetId: string, destinationId: string) => void;
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
  fleets: Fleet[];
  onAssignFleet: (fleetId: string, destinationId: string) => void;
}

function MilitaryTab({ system, fleets, onAssignFleet }: MilitaryProps) {
  const stationed = fleets.filter((f) => f.location === system.id);
  const inbound = fleets.filter((f) => f.destination === system.id);
  const destinations = SYSTEMS.filter((s) => s.id !== system.id);

  return (
    <>
      <Placeholder title="Garrison and orbital defense">
        Ground formations, fortifications, and the local order of battle will live here.
      </Placeholder>

      <section className="tab-section">
        <h4>Fleets</h4>
        {stationed.length === 0 && inbound.length === 0 && (
          <p className="quiet">No fleets stationed here or inbound.</p>
        )}

        {inbound.map((fleet) => (
          <p key={fleet.id} className="quiet">
            {fleet.name} inbound from {systemName(fleet.origin)}, {fleet.turnsRemaining} turn
            {fleet.turnsRemaining === 1 ? '' : 's'} out.
          </p>
        ))}

        {stationed.map((fleet) => (
          <div key={fleet.id} className="fleet-order">
            <p className="fleet-name">{fleet.name} — stationed</p>
            <p className="quiet">Assign a destination ({TRAVEL_TURNS} turns in transit):</p>
            <div className="fleet-buttons">
              {destinations.map((target) => (
                <button
                  key={target.id}
                  className="ghost"
                  onClick={() => onAssignFleet(fleet.id, target.id)}
                >
                  Send to {target.name}
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
  pendingEventId,
  fleets,
  tab,
  onTabChange,
  onChoose,
  onAssignFleet,
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
          <MilitaryTab system={system} fleets={fleets} onAssignFleet={onAssignFleet} />
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
