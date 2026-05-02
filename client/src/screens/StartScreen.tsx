import type { SocketStatus } from '../store/gameReducer'
import ASCIIText from '../components/ASCIIText.jsx'

interface StartScreenProps {
    onStart: () => void
    onHowToPlay: () => void
    isCreating: boolean
    error: string | null
    socketStatus: SocketStatus
}

function StartScreen({
                         onStart,
                         onHowToPlay,
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

                <p className="subtitle start-subtitle">
                    Scroll the feed. Survive the encounters.
                </p>

                <div className="start-menu-buttons">
                    <button
                        type="button"
                        className="start-play-button"
                        onClick={onStart}
                        disabled={isCreating}
                    >
                        {isCreating ? 'Booting...' : 'Play'}
                    </button>

                    <button type="button" className="start-menu-button" onClick={onHowToPlay}>
                        How to Play
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
