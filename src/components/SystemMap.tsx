import { SYSTEMS, currentController, systemById } from '../game/systems';
import { daysOut, describeComposition, fleetLabel, sumComposition } from '../game/fleets';
import { systemPairs } from '../game/travel';
import type { Controller } from '../game/systems';
import type { Fleet } from '../game/types';

interface Props {
  daysElapsed: number;
  selectedId: string | null;
  pendingSystemId: string | null;
  pendingCombatSystemId: string | null;
  pendingOccupationSystemId: string | null;
  controllerOverrides: Record<string, Controller>;
  fleets: Fleet[];
  onSelect: (systemId: string) => void;
}

const LANES = systemPairs()
  .map(([a, b]) => [systemById(a), systemById(b)] as const)
  .filter((pair): pair is readonly [NonNullable<(typeof pair)[0]>, NonNullable<(typeof pair)[1]>] =>
    Boolean(pair[0] && pair[1]),
  );

function transitPosition(fleet: Fleet, daysElapsed: number) {
  const from = systemById(fleet.origin);
  const to = systemById(fleet.destination);
  const trip = fleet.arrivalDay - fleet.departureDay;
  if (!from || !to || trip <= 0) return null;
  const progress = Math.min(1, Math.max(0, (daysElapsed - fleet.departureDay) / trip));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export default function SystemMap({
  daysElapsed,
  selectedId,
  pendingSystemId,
  pendingCombatSystemId,
  pendingOccupationSystemId,
  controllerOverrides,
  fleets,
  onSelect,
}: Props) {
  const stationed = (systemId: string) => fleets.filter((f) => f.location === systemId);

  return (
    <div className="map" role="group" aria-label="Local space">
      <svg className="lanes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {LANES.map(([a, b]) => (
          <line
            key={`${a.id}-${b.id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {fleets.map((fleet) => {
        const position = transitPosition(fleet, daysElapsed);
        if (!position) return null;
        return (
          <div
            key={fleet.id}
            className="fleet-marker"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            <span className="fleet-glyph" aria-hidden="true">
              ▸
            </span>
            <span className="fleet-marker-label">
              <span className="fleet-marker-name">
                {fleet.name} · {daysOut(fleet, daysElapsed)}d
              </span>
              <span className="fleet-marker-comp">{describeComposition(fleet.composition)}</span>
            </span>
          </div>
        );
      })}

      {SYSTEMS.map((system) => {
        const here = stationed(system.id);
        return (
          <button
            key={system.id}
            className={`node node-${currentController(system, controllerOverrides)}${
              selectedId === system.id ? ' is-selected' : ''
            }`}
            style={{ left: `${system.x}%`, top: `${system.y}%` }}
            onClick={() => onSelect(system.id)}
            aria-pressed={selectedId === system.id}
          >
            <span className="node-dot">
              {pendingSystemId === system.id && <span className="node-alert" aria-hidden="true" />}
            </span>
            <span className="node-name">{system.name}</span>
            <span className="node-meta">
              {pendingSystemId === system.id && <span className="node-tag">decision</span>}
              {pendingCombatSystemId === system.id && <span className="node-tag">combat</span>}
              {pendingOccupationSystemId === system.id && (
                <span className="node-tag">occupation</span>
              )}
              {here.length > 0 && (
                <span className="node-tag node-tag-fleet">
                  {here.length === 1
                    ? fleetLabel(here[0])
                    : `${here.length} fleets · ${describeComposition(sumComposition(here))}`}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
