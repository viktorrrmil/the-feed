import type { SocketStatus } from '../store/gameReducer'

interface StartScreenProps {
  onStart: () => void
  isCreating: boolean
  error: string | null
  socketStatus: SocketStatus
}

function StartScreen({
  onStart,
  isCreating,
  error,
  socketStatus,
}: StartScreenProps) {
  return (
    <main className="screen start-screen">
      <div className="start-bg" aria-hidden>
        <div className="start-bg-layer start-bg-layer-a" />
        <div className="start-bg-layer start-bg-layer-b" />
        <div className="start-bg-layer start-bg-layer-c" />
      </div>

      <div className="panel start-panel">
        <p className="eyebrow start-eyebrow">Neural Loop // Main Menu</p>
        <h1 className="start-title" aria-label="The Feed">
          <span className="start-title-layer start-title-back">THE FEED</span>
          <span className="start-title-layer start-title-mid">THE FEED</span>
          <span className="start-title-layer start-title-front">THE FEED</span>
        </h1>
        <p className="subtitle start-subtitle">
          Scroll the signal. Survive the encounter. Break the loop.
        </p>
        <button
          type="button"
          className="start-play-button"
          onClick={onStart}
          disabled={isCreating}
        >
          {isCreating ? 'Booting...' : 'Play'}
        </button>
        <p className="status start-status">Socket: {socketStatus}</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  )
}

export default StartScreen
