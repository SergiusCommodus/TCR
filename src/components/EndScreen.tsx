import type { GameEndState } from '../game/types';

interface Props {
  gameOver: GameEndState;
  onRestart: () => void;
}

/** Replaces the entire main view once a win or loss condition triggers —
 *  the game is over, permanently, so there is nothing else to show but the
 *  outcome and a way to start again. */
export default function EndScreen({ gameOver, onRestart }: Props) {
  const isVictory = gameOver.result === 'victory';

  return (
    <div className="app end-screen">
      <div className={`end-card ${isVictory ? 'end-victory' : 'end-defeat'}`}>
        <p className="end-eyebrow">Continental Republic — War Command</p>
        <h1 className="end-result">{isVictory ? 'Victory' : 'Defeat'}</h1>
        <p className="end-reason">{gameOver.reason}</p>
        <p className="end-day">Day {gameOver.day}</p>
        <button className="end-restart" onClick={onRestart}>
          Restart
        </button>
      </div>
    </div>
  );
}
