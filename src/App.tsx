import { useEffect, useReducer, useRef, useState } from 'react';
import DecisionCard from './components/DecisionCard';
import SpeedControls from './components/SpeedControls';
import SystemMap from './components/SystemMap';
import SystemPanel from './components/SystemPanel';
import type { Tab } from './components/SystemPanel';
import { findEvent } from './game/events';
import { dayLabel, initialSession, reducer } from './game/state';
import { HOME_SYSTEM_ID, SYSTEMS, scopeOf, systemById, systemName } from './game/systems';
import type { Speed } from './game/types';

/** How often the clock is settled against the wall clock. Elapsed real time is
 *  measured each time, so the interval's own jitter cannot accumulate. */
const TICK_MS = 100;

/** The system a pending event belongs to, or null when it is national in scope. */
function pendingSystemOf(pendingEventId: string | null): string | null {
  if (!pendingEventId) return null;
  const scope = scopeOf(pendingEventId);
  return scope === 'global' ? null : scope;
}

export default function App() {
  const [session, dispatch] = useReducer(reducer, undefined, initialSession);
  const { state, speed, pendingEventId, fleets } = session;

  const pendingSystemId = pendingSystemOf(pendingEventId);
  const globalEvent = pendingEventId && !pendingSystemId ? findEvent(pendingEventId) : undefined;

  const [selectedId, setSelectedId] = useState<string>(
    () => pendingSystemOf(session.pendingEventId) ?? HOME_SYSTEM_ID,
  );
  const [tab, setTab] = useState<Tab>('Political');

  const selected = systemById(selectedId) ?? SYSTEMS[0];
  /** A system decision is only on screen when its system is open on the Political tab. */
  const decisionVisible =
    pendingSystemId !== null && pendingSystemId === selectedId && tab === 'Political';
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  useEffect(() => {
    if (speed === 0 || pendingEventId) return;
    const id = window.setInterval(
      () => dispatch({ type: 'tick', now: performance.now() }),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [speed, pendingEventId]);

  const setSpeed = (next: Speed) =>
    dispatch({ type: 'setSpeed', speed: next, now: performance.now() });

  const openPendingSystem = () => {
    if (!pendingSystemId) return;
    setSelectedId(pendingSystemId);
    setTab('Political');
  };

  const restart = () => {
    dispatch({ type: 'reset' });
    setSelectedId(pendingSystemOf(initialSession().pendingEventId) ?? HOME_SYSTEM_ID);
    setTab('Political');
  };

  return (
    <div className="app">
      <header className="status-bar">
        <div className="identity">
          <h1>Continental Republic</h1>
          <p>War Command</p>
        </div>

        <div className="clock">
          <div className="clock-readout">
            <span className="clock-label">Day</span>
            <span className="clock-day">{dayLabel(state.daysElapsed)}</span>
          </div>
          <div
            className="day-progress"
            role="progressbar"
            aria-label="Progress through the current day"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor((state.daysElapsed % 1) * 100)}
          >
            <span style={{ width: `${(state.daysElapsed % 1) * 100}%` }} />
          </div>
          <SpeedControls speed={speed} locked={Boolean(pendingEventId)} onChange={setSpeed} />
        </div>

        <dl className="briefing">
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
            <dt>Leadership</dt>
            <dd>{state.leadershipPoints}</dd>
          </div>
        </dl>
      </header>

      {globalEvent && (
        <section className="global-banner" aria-label="National decision">
          <p className="banner-eyebrow">Congress in session — national decision</p>
          <DecisionCard
            event={globalEvent}
            onChoose={(choiceIndex) => dispatch({ type: 'choose', choiceIndex })}
          />
        </section>
      )}

      {pendingSystemId && !decisionVisible && (
        <button className="pending-hint" onClick={openPendingSystem}>
          Decision pending at {systemName(pendingSystemId)} — open its Political tab
        </button>
      )}

      <main className="stage">
        <SystemMap
          daysElapsed={state.daysElapsed}
          selectedId={selectedId}
          pendingSystemId={pendingSystemId}
          fleets={fleets}
          onSelect={setSelectedId}
        />
        <SystemPanel
          system={selected}
          daysElapsed={state.daysElapsed}
          materiel={state.materiel}
          pendingEventId={pendingSystemId === selected.id ? pendingEventId : null}
          fleets={fleets}
          buildQueue={session.buildQueue}
          tab={tab}
          onTabChange={setTab}
          onChoose={(choiceIndex) => dispatch({ type: 'choose', choiceIndex })}
          onAssignFleet={(fleetId, destinationId) =>
            dispatch({ type: 'assignFleet', fleetId, destinationId })
          }
          onBuildShip={(systemId, shipType) => dispatch({ type: 'buildShip', systemId, shipType })}
        />
      </main>

      <footer className="history">
        <h2>History</h2>
        <div className="log" ref={logRef}>
          {state.log.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="actions">
          <button className="secondary" onClick={restart}>
            Restart
          </button>
          {pendingEventId && (
            <p className="quiet">Clock paused. Resolve the pending decision to resume.</p>
          )}
        </div>
      </footer>
    </div>
  );
}
