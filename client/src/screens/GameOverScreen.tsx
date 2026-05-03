interface GameOverScreenProps {
  score: number
  outcome: string
  exploitsCollected: number
  onRestart: () => void
  onMainMenu: () => void
}

function GameOverScreen({
  score,
  outcome,
  exploitsCollected,
  onRestart,
  onMainMenu,
}: GameOverScreenProps) {
  const isVictory = outcome === 'victory'

  return (
    <main className="screen game-over-screen">
      <section
        className={`game-over-arcade ${isVictory ? 'game-over-arcade-win' : 'game-over-arcade-loss'}`}
        aria-labelledby="game-over-title"
      >
        <div className="game-over-scanlines" aria-hidden />
        <p className="game-over-kicker">THE FEED</p>
        <h1 id="game-over-title" className="game-over-title">
          {isVictory ? 'YOU ESCAPED THE FEED' : 'ATTENTION DEPLETED'}
        </h1>
        {!isVictory ? <p className="game-over-tagline">You lost the run</p> : null}
        <dl className="game-over-stats">
          <div>
            <dt>Score</dt>
            <dd>{score}</dd>
          </div>
          {isVictory ? (
            <div>
              <dt>Exploits collected</dt>
              <dd>{exploitsCollected}</dd>
            </div>
          ) : null}
        </dl>
        <div className="game-over-actions">
          {isVictory ? (
            <button type="button" className="game-over-btn game-over-btn-primary" onClick={onRestart}>
              Play Again
            </button>
          ) : (
            <>
              <button type="button" className="game-over-btn game-over-btn-primary" onClick={onRestart}>
                Retry
              </button>
              <button type="button" className="game-over-btn game-over-btn-secondary" onClick={onMainMenu}>
                Main Menu
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default GameOverScreen
