import { useEffect, useReducer, useRef, useState } from 'react';
import DecisionCard from './components/DecisionCard';
import SystemMap from './components/SystemMap';
import SystemPanel from './components/SystemPanel';
import type { Tab } from './components/SystemPanel';
import { findEvent } from './game/events';
import { initialSession, reducer } from './game/state';
import { HOME_SYSTEM_ID, SYSTEMS, scopeOf, systemById, systemName } from './game/systems';

/** The system a pending event belongs to, or null when it is national in scope. */
function pendingSystemOf(pendingEventId: string | null): string | null {
  if (!pendingEventId) return null;
  const scope = scopeOf(pendingEventId);
  return scope === 'global' ? null : scope;
}

export default function App() {
  const [session, dispatch] = useReducer(reducer, undefined, initialSession);
  const { state, pendingEventId, fleets } = session;

  const pendingSystemId = pendingSystemOf(pendingEventId);
  const globalEvent =
    pendingEventId && !pendingSystemId ? findEvent(pendingEventId) : undefined;

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
          selectedId={selectedId}
          pendingSystemId={pendingSystemId}
          fleets={fleets}
          onSelect={setSelectedId}
        />
        <SystemPanel
          system={selected}
          pendingEventId={pendingSystemId === selected.id ? pendingEventId : null}
          fleets={fleets}
          tab={tab}
          onTabChange={setTab}
          onChoose={(choiceIndex) => dispatch({ type: 'choose', choiceIndex })}
          onAssignFleet={(fleetId, destinationId) =>
            dispatch({ type: 'assignFleet', fleetId, destinationId })
          }
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
          <button
            onClick={() => dispatch({ type: 'advanceTurn' })}
            disabled={Boolean(pendingEventId)}
          >
            Advance Turn
          </button>
          <button className="secondary" onClick={restart}>
            Restart
          </button>
          {pendingEventId && (
            <p className="quiet">Resolve the pending decision before advancing.</p>
          )}
        </div>
      </footer>
    </div>
  );
}
