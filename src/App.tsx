import { useEffect, useReducer, useRef, useState } from 'react';
import DecisionCard from './components/DecisionCard';
import EndScreen from './components/EndScreen';
import SpeedControls from './components/SpeedControls';
import SystemMap from './components/SystemMap';
import SystemPanel from './components/SystemPanel';
import type { Tab } from './components/SystemPanel';
import { NAVAL_INTELLIGENCE } from './game/directorate';
import { findEvent } from './game/events';
import { formatMoney, formatPopulation } from './game/scale';
import { dayLabel, deserializeSession, initialSession, reducer, serializeSession } from './game/state';
import { HOME_SYSTEM_ID, SYSTEMS, scopeOf, systemById, systemName } from './game/systems';
import type { CombatStance } from './game/stance';
import type { GameSession, Speed } from './game/types';

/** How often the clock is settled against the wall clock. Elapsed real time is
 *  measured each time, so the interval's own jitter cannot accumulate. */
const TICK_MS = 100;

/** The single save slot's key in localStorage — one slot, overwritten each
 *  time, not a list of named saves. */
const SAVE_KEY = 'tcr-save';

/** How long a save/load status message ("Saved.", "No saved game found.")
 *  stays on screen before clearing itself. */
const SAVE_STATUS_MS = 4000;

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
    queuedPanels,
    taxPolicy,
    fleets,
    completedFocusIds,
    activeFocus,
    directorateAttack,
    directorateFleetStrength,
    pendingDirectorateAlert,
    pendingDirectorateCombat,
    warTotals,
    lastCombatReport,
    gameOver,
  } = session;

  const pendingSystemId = pendingSystemOf(pendingEventId);
  const globalEvent = pendingEventId && !pendingSystemId ? findEvent(pendingEventId) : undefined;

  const [selectedId, setSelectedId] = useState<string>(
    () => pendingSystemOf(session.pendingEventId) ?? HOME_SYSTEM_ID,
  );
  const [tab, setTab] = useState<Tab>('Political');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

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
    if (speed === 0) return;
    const id = window.setInterval(
      () => dispatch({ type: 'tick', now: performance.now() }),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [speed]);

  // The Directorate alert clears itself a few seconds after it appears — no
  // player action required, unlike every other pending panel. It no longer
  // touches the clock's speed at all, just its own visibility.
  useEffect(() => {
    if (!pendingDirectorateAlert) return;
    const id = window.setTimeout(() => {
      dispatch({ type: 'acknowledgeDirectorateAlert', now: performance.now() });
    }, 4500);
    return () => window.clearTimeout(id);
  }, [pendingDirectorateAlert]);

  useEffect(() => {
    if (!saveStatus) return;
    const id = window.setTimeout(() => setSaveStatus(null), SAVE_STATUS_MS);
    return () => window.clearTimeout(id);
  }, [saveStatus]);

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

  /** Points the map/panel selection at whatever the just-loaded session has
   *  pending, the same landing spot a fresh game gets, rather than leaving
   *  it on whatever system happened to be selected before the load. */
  const selectForLoadedSession = (loaded: GameSession) => {
    setSelectedId(pendingSystemOf(loaded.pendingEventId) ?? HOME_SYSTEM_ID);
    setTab('Political');
  };

  const saveGame = () => {
    try {
      window.localStorage.setItem(SAVE_KEY, serializeSession(session));
      setSaveStatus(`Saved at Day ${dayLabel(state.daysElapsed)}.`);
    } catch {
      // Quota exceeded, storage disabled by the browser, etc. — nothing the
      // player can fix mid-game, just say so rather than crash.
      setSaveStatus('Could not save — browser storage is unavailable.');
    }
  };

  const loadGame = () => {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(SAVE_KEY);
    } catch {
      setSaveStatus('Could not read a saved game — browser storage is unavailable.');
      return;
    }
    if (!raw) {
      setSaveStatus('No saved game found.');
      return;
    }
    const loaded = deserializeSession(raw);
    if (!loaded) {
      setSaveStatus('Save data is invalid or from an incompatible version.');
      return;
    }
    dispatch({ type: 'load', session: loaded });
    selectForLoadedSession(loaded);
    setSaveStatus(`Loaded save from Day ${dayLabel(loaded.state.daysElapsed)}.`);
  };

  if (gameOver) {
    return (
      <EndScreen gameOver={gameOver} onRestart={restart} onLoad={loadGame} saveStatus={saveStatus} />
    );
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
          <p className="speed-label">Speed</p>
          <SpeedControls speed={speed} locked={Boolean(pendingOccupation)} onChange={setSpeed} />
        </div>

        <div className="briefing-block">
          <p className="module-label">Briefing</p>
          <dl className="briefing">
            <div>
              <dt>Materiel</dt>
              <dd>{formatMoney(state.materiel)}</dd>
            </div>
            <div>
              <dt>Population</dt>
              <dd>{formatPopulation(state.population)}</dd>
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
            <div>
              <dt>War Dead</dt>
              <dd>
                {formatPopulation(
                  warTotals.ownKilled + warTotals.enemyKilledEstimate + warTotals.civilianDeaths,
                )}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {(globalEvent ||
        (pendingDirectorateAlert && directorateAttack) ||
        (pendingSystemId && !decisionVisible) ||
        (pendingCombat && !combatVisible) ||
        (pendingOccupation && !occupationVisible) ||
        (pendingDirectorateCombat && !directorateCombatVisible) ||
        queuedPanels.length > 0) && (
        <section className="alert-rail" aria-label="Alerts and pending decisions">
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
              Directorate attack at {systemName(pendingDirectorateCombat.systemId)} — open its
              Military tab for combat orders
            </button>
          )}

          {queuedPanels.length > 0 && (
            <p className="queue-indicator" role="status">
              +{queuedPanels.length} more waiting
            </p>
          )}
        </section>
      )}

      <main className="stage">
        <div className="map-module">
          <p className="module-label">Sector Map</p>
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
        </div>
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
          lastCombatReport={lastCombatReport}
          garrisons={session.garrisons}
          groundDefenses={session.groundDefenses}
          controllerOverrides={session.controllerOverrides}
          fleets={fleets}
          buildQueue={session.buildQueue}
          standingShipOrders={session.standingShipOrders}
          trainingQueue={session.trainingQueue}
          groundTroopPool={session.groundTroopPool}
          buildings={session.buildings}
          buildingQueue={session.buildingQueue}
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
          onMergeFleets={(fleetIds, keepFleetId) =>
            dispatch({ type: 'mergeFleets', fleetIds, keepFleetId })
          }
          onBuildShip={(systemId, shipType) => dispatch({ type: 'buildShip', systemId, shipType })}
          onSetStandingShipOrder={(systemId, sequence) =>
            dispatch({ type: 'setStandingShipOrder', systemId, sequence })
          }
          onCancelStandingShipOrder={(systemId) =>
            dispatch({ type: 'cancelStandingShipOrder', systemId })
          }
          onQueueBuilding={(systemId, buildingType) =>
            dispatch({ type: 'queueBuilding', systemId, buildingType })
          }
          onTrainTroops={(systemId) => dispatch({ type: 'trainTroops', systemId })}
          onLoadTroops={(fleetId) => dispatch({ type: 'loadTroops', fleetId })}
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
        <h2>Mission Log</h2>
        <dl className="war-ledger" aria-label="Running war totals">
          <div>
            <dt>Republic dead / wounded</dt>
            <dd>
              {formatPopulation(warTotals.ownKilled)} / {formatPopulation(warTotals.ownWounded)}
            </dd>
          </div>
          <div>
            <dt>Republic ships lost</dt>
            <dd>{warTotals.ownShipsLost}</dd>
          </div>
          <div>
            <dt>Directorate dead / wounded (est.)</dt>
            <dd>
              {formatPopulation(warTotals.enemyKilledEstimate)} /{' '}
              {formatPopulation(warTotals.enemyWoundedEstimate)}
            </dd>
          </div>
          <div>
            <dt>Civilians dead</dt>
            <dd>{formatPopulation(warTotals.civilianDeaths)}</dd>
          </div>
        </dl>
        <div className="log" ref={logRef}>
          {state.log.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="actions">
          <button className="secondary" onClick={saveGame}>
            Save Game
          </button>
          <button className="secondary" onClick={loadGame}>
            Load Game
          </button>
          <button className="secondary" onClick={restart}>
            Restart
          </button>
          {saveStatus && (
            <p className="quiet" role="status">
              {saveStatus}
            </p>
          )}
          {pendingOccupation && (
            <p className="quiet">Clock paused. Resolve the pending occupation decision to resume.</p>
          )}
          {!pendingOccupation &&
            (pendingEventId || pendingCombat || pendingDirectorateAlert || pendingDirectorateCombat) && (
              <p className="quiet">
                A decision is pending. The clock keeps running at whatever speed you've set —
                resolve it whenever you're ready.
              </p>
            )}
        </div>
      </footer>
    </div>
  );
}
