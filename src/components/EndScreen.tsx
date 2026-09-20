import type { GameEndState } from '../game/types';

interface Props {
  gameOver: GameEndState;
  onRestart: () => void;
  /** Loads the single save slot, replacing this ended game outright —
   *  the only way back into play from here besides starting over. */
  onLoad: () => void;
  /** The same transient save/load status message the main screen shows,
   *  so a failed or successful load is visible here too. */
  saveStatus: string | null;
}

/** Replaces the entire main view once a win or loss condition triggers —
 *  the game is over, permanently, so there is nothing else to show but the
 *  outcome and a way to start again or load an earlier save. */
export default function EndScreen({ gameOver, onRestart, onLoad, saveStatus }: Props) {
  const isVictory = gameOver.result === 'victory';

  return (
    <div className="app end-screen">
      <div className={`end-card ${isVictory ? 'end-victory' : 'end-defeat'}`}>
        <p className="end-eyebrow">Continental Republic — War Command</p>
        <h1 className="end-result">{isVictory ? 'Victory' : 'Defeat'}</h1>
        <p className="end-reason">{gameOver.reason}</p>
        <p className="end-day">Day {gameOver.day}</p>
        <div className="end-actions">
          <button className="end-restart" onClick={onRestart}>
            Restart
          </button>
          <button className="end-restart end-secondary" onClick={onLoad}>
            Load Game
          </button>
        </div>
        {saveStatus && (
          <p className="quiet" role="status">
            {saveStatus}
          </p>
        )}
      </div>
    </div>
  );
}
