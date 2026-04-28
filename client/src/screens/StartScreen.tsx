import type { SocketStatus } from '../store/gameReducer'
import ASCIIText from '../components/ASCIIText'

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

      <div className="start-logo-wrap" aria-hidden>
        <ASCIIText text="The Feed" enableWaves={false} asciiFontSize={6} />
      </div>

      <div className="panel start-panel">
        <p className="eyebrow start-eyebrow">Main Menu</p>
        {/*<h1 className="start-title" aria-label="The Feed">*/}
        {/*  <span className="start-title-layer start-title-back">THE FEED</span>*/}
        {/*  <span className="start-title-layer start-title-mid">THE FEED</span>*/}
        {/*  <span className="start-title-layer start-title-front">THE FEED</span>*/}
        {/*</h1>*/}

        <p className="subtitle start-subtitle">
          Scroll the feed. Survive the encounters.
        </p>
        <button
          type="button"
          className="start-play-button"
          onClick={onStart}
          disabled={isCreating}
        >
          {isCreating ? 'Booting...' : 'Play'}
        </button>
        <div className="start-menu-buttons" aria-label="Main menu actions">
          <button type="button" className="start-menu-button" disabled>
            Options
          </button>
          <button type="button" className="start-menu-button" disabled>
            How to Play
          </button>
          <button type="button" className="start-menu-button" disabled>
            Leaderboard
          </button>
          <a
            className="start-menu-button start-menu-button-github"
            href="https://github.com/viktorrrmil/the-feed"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
        <p className="status start-status">[DEBUG] Socket: {socketStatus}</p>
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
