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
      <div className="panel">
        <p className="eyebrow">The Feed</p>
        <h1>Enter the scroll loop</h1>
        <p className="subtitle">
          Each session creates a fresh feed and opens a live combat socket.
        </p>
        <button type="button" onClick={onStart} disabled={isCreating}>
          {isCreating ? 'Creating session...' : 'Start session'}
        </button>
        <p className="status">Socket: {socketStatus}</p>
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
