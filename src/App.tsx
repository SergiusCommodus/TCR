import { useEffect, useReducer, useRef } from 'react';
import { findEvent } from './game/events';
import { describeEffects, initialSession, reducer } from './game/state';

export default function App() {
  const [session, dispatch] = useReducer(reducer, undefined, initialSession);
  const { state, pendingEventId } = session;
  const event = pendingEventId ? findEvent(pendingEventId) : undefined;
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  return (
    <main>
      <h1>Continental Republic — War Command</h1>

      <section className="panel">
        <h2>Briefing</h2>
        <dl className="briefing">
          <div>
            <dt>Turn</dt>
            <dd>{state.turn}</dd>
          </div>
          <div>
            <dt>Materiel</dt>
            <dd>{state.materiel}</dd>
          </div>
          <div>
            <dt>Population</dt>
            <dd>{state.population}</dd>
          </div>
          <div>
            <dt>Approval</dt>
            <dd>{state.approval}</dd>
          </div>
          <div>
            <dt>Leadership Points</dt>
            <dd>{state.leadershipPoints}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Decision</h2>
        {event ? (
          <>
            <h3>{event.title}</h3>
            <p>{event.text}</p>
            <div className="choices">
              {event.choices.map((choice, index) => (
                <button
                  key={choice.label}
                  onClick={() => dispatch({ type: 'choose', choiceIndex: index })}
                >
                  <span className="choice-label">{choice.label}</span>
                  <span className="choice-effects">{describeEffects(choice.effects)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="quiet">No decision pending. Advance the turn.</p>
        )}
      </section>

      <section className="panel">
        <h2>History</h2>
        <div className="log" ref={logRef}>
          {state.log.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="actions">
          <button onClick={() => dispatch({ type: 'advanceTurn' })} disabled={Boolean(event)}>
            Advance Turn
          </button>
          <button className="secondary" onClick={() => dispatch({ type: 'reset' })}>
            Restart
          </button>
        </div>
        {event && <p className="quiet">Resolve the pending decision before advancing.</p>}
      </section>
    </main>
  );
}
