interface GameOverScreenProps {
  score: number
  onRestart: () => void
}

function GameOverScreen({ score, onRestart }: GameOverScreenProps) {
  return (
    <main className="screen game-over-screen">
      <section className="panel game-over-panel">
        <p className="eyebrow">The Feed</p>
        <h1>Attention depleted</h1>
        <p className="subtitle">Signal collapsed. Final score: {score}</p>
        <button type="button" onClick={onRestart}>
          Restart session
        </button>
      </section>
    </main>
  )
}

export default GameOverScreen
