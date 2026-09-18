import { HOME_SYSTEM_ID, SYSTEMS, systemById } from '../game/systems';
import type { Fleet } from '../game/types';

interface Props {
  selectedId: string | null;
  pendingSystemId: string | null;
  fleets: Fleet[];
  onSelect: (systemId: string) => void;
}

const HOME = systemById(HOME_SYSTEM_ID);

function transitPosition(fleet: Fleet) {
  const from = systemById(fleet.origin);
  const to = systemById(fleet.destination);
  if (!from || !to || fleet.totalTurns === 0) return null;
  const progress = (fleet.totalTurns - fleet.turnsRemaining) / fleet.totalTurns;
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export default function SystemMap({ selectedId, pendingSystemId, fleets, onSelect }: Props) {
  const stationed = (systemId: string) => fleets.filter((f) => f.location === systemId);

  return (
    <div className="map" role="group" aria-label="Local space">
      <svg className="lanes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {HOME &&
          SYSTEMS.filter((s) => s.id !== HOME_SYSTEM_ID).map((s) => (
            <line
              key={s.id}
              x1={HOME.x}
              y1={HOME.y}
              x2={s.x}
              y2={s.y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>

      {fleets.map((fleet) => {
        const position = transitPosition(fleet);
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
              {fleet.name} · {fleet.turnsRemaining}
            </span>
          </div>
        );
      })}

      {SYSTEMS.map((system) => {
        const here = stationed(system.id);
        return (
          <button
            key={system.id}
            className={`node node-${system.controller}${
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
              {here.length > 0 && (
                <span className="node-tag node-tag-fleet">
                  {here.length === 1 ? here[0].name : `${here.length} fleets`}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
