import type { ServerState, SocketStatus } from '../store/gameReducer'

interface FeedScreenProps {
  sessionId: string | null
  serverState: ServerState | null
  socketStatus: SocketStatus
}

function FeedScreen({ sessionId, serverState, socketStatus }: FeedScreenProps) {
  return (
    <main className="screen feed-screen">
      <div className="panel">
        <p className="eyebrow">Feed online</p>
        <h1>Session active</h1>
        <div className="meta">
          <p>
            <span>Session</span>
            {sessionId || 'pending'}
          </p>
          <p>
            <span>Socket</span>
            {socketStatus}
          </p>
        </div>
        <div className="state">
          <p>Server state snapshot</p>
          <pre>{JSON.stringify(serverState, null, 2)}</pre>
        </div>
      </div>
    </main>
  )
}

export default FeedScreen
