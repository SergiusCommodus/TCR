import { describeEffects } from '../game/state';
import type { EventDef } from '../game/types';

interface Props {
  event: EventDef;
  onChoose: (choiceIndex: number) => void;
}

/** Renders one pending event and its choices. Used by both the global banner
 *  and a system's Political tab, so both paths share the same decision logic. */
export default function DecisionCard({ event, onChoose }: Props) {
  return (
    <div className="decision">
      <h3>{event.title}</h3>
      <p className="decision-text">{event.text}</p>
      <div className="choices">
        {event.choices.map((choice, index) => (
          <button key={choice.label} onClick={() => onChoose(index)}>
            <span className="choice-label">{choice.label}</span>
            <span className="choice-effects">{describeEffects(choice.effects)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
