import { useEffect, useReducer, useRef, useState } from 'react';
import DecisionCard from './components/DecisionCard';
import EndScreen from './components/EndScreen';
import SpeedControls from './components/SpeedControls';
import SystemMap from './components/SystemMap';
import SystemPanel from './components/SystemPanel';
import type { Tab } from './components/SystemPanel';
import { NAVAL_INTELLIGENCE } from './game/directorate';
import { findEvent } from './game/events';
import { dayLabel, initialSession, reducer } from './game/state';
import { HOME_SYSTEM_ID, SYSTEMS, scopeOf, systemById, systemName } from './game/systems';
import type { CombatStance } from './game/stance';
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
  const {
    state,
    speed,
    pendingEventId,
    pendingCombat,
    pendingOccupation,
    taxPolicy,
    fleets,
    completedFocusIds,
    activeFocus,
    directorateAttack,
    directorateFleetStrength,
    pendingDirectorateAlert,
    pendingDirectorateCombat,
    gameOver,
  } = session;

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
  /** Combat Orders lives in the Military tab of the system under attack. */
  const combatVisible =
    pendingCombat !== null && pendingCombat.systemId === selectedId && tab === 'Military';
  /** A Directorate defend stance decision lives in the same tab, same rule. */
  const directorateCombatVisible =
    pendingDirectorateCombat !== null &&
    pendingDirectorateCombat.systemId === selectedId &&
    tab === 'Military';
  /** The occupation decision lives in the Political tab, same as any other
   *  system scoped decision. */
  const occupationVisible =
    pendingOccupation !== null && pendingOccupation.systemId === selectedId && tab === 'Political';
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

  // The Directorate alert pauses the clock only long enough to be read, then
  // resumes on its own — no player action required, unlike every other
  // pending state.
  useEffect(() => {
    if (!pendingDirectorateAlert) return;
    const id = window.setTimeout(() => {
      dispatch({ type: 'acknowledgeDirectorateAlert', now: performance.now() });
    }, 4500);
    return () => window.clearTimeout(id);
  }, [pendingDirectorateAlert]);

  const setSpeed = (next: Speed) =>
    dispatch({ type: 'setSpeed', speed: next, now: performance.now() });

  const openPendingSystem = () => {
    if (!pendingSystemId) return;
    setSelectedId(pendingSystemId);
    setTab('Political');
  };

  const openPendingCombat = () => {
    if (!pendingCombat) return;
    setSelectedId(pendingCombat.systemId);
    setTab('Military');
  };

  const openPendingDirectorateCombat = () => {
    if (!pendingDirectorateCombat) return;
    setSelectedId(pendingDirectorateCombat.systemId);
    setTab('Military');
  };

  const openPendingOccupation = () => {
    if (!pendingOccupation) return;
    setSelectedId(pendingOccupation.systemId);
    setTab('Political');
  };

  const restart = () => {
    dispatch({ type: 'reset' });
    setSelectedId(pendingSystemOf(initialSession().pendingEventId) ?? HOME_SYSTEM_ID);
    setTab('Political');
  };

  if (gameOver) {
    return <EndScreen gameOver={gameOver} onRestart={restart} />;
  }

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
          <SpeedControls
            speed={speed}
            locked={
              Boolean(pendingEventId) ||
              Boolean(pendingCombat) ||
              Boolean(pendingOccupation) ||
              Boolean(pendingDirectorateAlert) ||
              Boolean(pendingDirectorateCombat)
            }
            onChange={setSpeed}
          />
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
          <div>
            <dt>Manpower</dt>
            <dd>{state.manpower}</dd>
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

      {pendingDirectorateAlert && directorateAttack && (
        <section className="directorate-alert" aria-label="Naval Intelligence alert" role="status">
          <p className="banner-eyebrow">{NAVAL_INTELLIGENCE} — fleet movement alert</p>
          <p>
            Unidentified Directorate fleet movement detected. Estimated arrival at{' '}
            {systemName(directorateAttack.systemId)} in{' '}
            {Math.max(1, Math.ceil(directorateAttack.arrivalDay - state.daysElapsed))} days.
          </p>
        </section>
      )}

      {pendingSystemId && !decisionVisible && (
        <button className="pending-hint" onClick={openPendingSystem}>
          Decision pending at {systemName(pendingSystemId)} — open its Political tab
        </button>
      )}

      {pendingCombat && !combatVisible && (
        <button className="pending-hint" onClick={openPendingCombat}>
          Combat orders pending at {systemName(pendingCombat.systemId)} — open its Military tab
        </button>
      )}

      {pendingOccupation && !occupationVisible && (
        <button className="pending-hint" onClick={openPendingOccupation}>
          Occupation decision pending at {systemName(pendingOccupation.systemId)} — open its
          Political tab
        </button>
      )}

      {pendingDirectorateCombat && !directorateCombatVisible && (
        <button className="pending-hint" onClick={openPendingDirectorateCombat}>
          Directorate attack at {systemName(pendingDirectorateCombat.systemId)} — open its Military
          tab for combat orders
        </button>
      )}

      <main className="stage">
        <SystemMap
          daysElapsed={state.daysElapsed}
          selectedId={selectedId}
          pendingSystemId={pendingSystemId}
          pendingCombatSystemId={pendingCombat?.systemId ?? null}
          pendingOccupationSystemId={pendingOccupation?.systemId ?? null}
          directorateTargetSystemId={directorateAttack?.systemId ?? null}
          controllerOverrides={session.controllerOverrides}
          fleets={fleets}
          onSelect={setSelectedId}
        />
        <SystemPanel
          system={selected}
          daysElapsed={state.daysElapsed}
          materiel={state.materiel}
          manpower={state.manpower}
          pendingEventId={pendingSystemId === selected.id ? pendingEventId : null}
          pendingCombat={pendingCombat?.systemId === selected.id ? pendingCombat : null}
          pendingOccupation={pendingOccupation?.systemId === selected.id ? pendingOccupation : null}
          pendingDirectorateCombat={
            pendingDirectorateCombat?.systemId === selected.id ? pendingDirectorateCombat : null
          }
          directorateFleetStrength={directorateFleetStrength}
          garrisons={session.garrisons}
          groundDefenses={session.groundDefenses}
          controllerOverrides={session.controllerOverrides}
          fleets={fleets}
          buildQueue={session.buildQueue}
          taxPolicy={taxPolicy}
          completedFocusIds={completedFocusIds}
          activeFocus={activeFocus}
          leadershipPoints={state.leadershipPoints}
          tab={tab}
          onTabChange={setTab}
          onChoose={(choiceIndex) => dispatch({ type: 'choose', choiceIndex })}
          onAssignFleet={(fleetId, destinationId) =>
            dispatch({ type: 'assignFleet', fleetId, destinationId })
          }
          onBuildShip={(systemId, shipType) => dispatch({ type: 'buildShip', systemId, shipType })}
          onCommitAttack={(stance: CombatStance) => dispatch({ type: 'commitAttack', stance })}
          onCommitDirectorateDefense={(stance: CombatStance) =>
            dispatch({ type: 'commitDirectorateDefense', stance })
          }
          onCommitInvasion={(fleetId) => dispatch({ type: 'commitInvasion', fleetId })}
          onCommitOccupation={(choiceIndex) => dispatch({ type: 'commitOccupation', choiceIndex })}
          onSetTaxPolicy={(policy) => dispatch({ type: 'setTaxPolicy', policy })}
          onStartFocus={(focusId) => dispatch({ type: 'startFocus', focusId })}
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
          {(pendingEventId || pendingCombat || pendingOccupation || pendingDirectorateCombat) && (
            <p className="quiet">
              Clock paused. Resolve the pending{' '}
              {pendingEventId
                ? 'decision'
                : pendingCombat || pendingDirectorateCombat
                  ? 'combat'
                  : 'occupation decision'}{' '}
              to resume.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
