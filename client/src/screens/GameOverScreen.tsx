interface GameOverScreenProps {
  score: number
  outcome: string
  exploitsCollected: number
  onRestart: () => void
}

function GameOverScreen({ score, outcome, exploitsCollected, onRestart }: GameOverScreenProps) {
  const isVictory = outcome === 'victory'

  return (
    <main className="screen game-over-screen">
      <section className={`panel game-over-panel ${isVictory ? 'game-over-panel-victory' : ''}`}>
        <p className="eyebrow">The Feed</p>
        <h1>{isVictory ? 'YOU ESCAPED THE FEED' : 'Attention depleted'}</h1>
        <p className="subtitle">
          {isVictory ? `Posts survived: ${score}` : `Signal collapsed. Final score: ${score}`}
        </p>
        {isVictory ? <p className="subtitle">Exploits collected: {exploitsCollected}</p> : null}
        <button type="button" onClick={onRestart}>
          Play Again
        </button>
      </section>
    </main>
  )
}

export default GameOverScreen
