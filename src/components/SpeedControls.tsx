import { SPEEDS } from '../game/state';
import type { Speed } from '../game/types';

interface Props {
  speed: Speed;
  /** True while combat, an occupation choice or a Directorate alert is
   *  pending: the clock cannot run until it is resolved. A political or
   *  narrative decision event no longer locks this — the clock keeps
   *  running (at 1x or slower) while it's open. */
  locked: boolean;
  onChange: (speed: Speed) => void;
}

const label = (speed: Speed) => (speed === 0 ? 'Paused' : `${speed}x`);

export default function SpeedControls({ speed, locked, onChange }: Props) {
  return (
    <div className="speed" role="group" aria-label="Clock speed">
      {SPEEDS.map((value) => (
        <button
          key={value}
          className={value === speed ? 'speed-button is-active' : 'speed-button'}
          aria-pressed={value === speed}
          disabled={locked && value !== 0}
          onClick={() => onChange(value)}
        >
          {label(value)}
        </button>
      ))}
    </div>
  );
}
