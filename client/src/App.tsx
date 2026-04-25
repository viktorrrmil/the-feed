import FeedScreen from './screens/FeedScreen'
import StartScreen from './screens/StartScreen'
import { useGameState } from './hooks/useGameState'

function App() {
  const {
    phase,
    sessionId,
    serverState,
    socketStatus,
    isCreatingSession,
    error,
    createSession,
  } = useGameState()

  if (phase === 'feed') {
    return (
      <FeedScreen
        sessionId={sessionId}
        serverState={serverState}
        socketStatus={socketStatus}
      />
    )
  }

  return (
    <StartScreen
      onStart={createSession}
      isCreating={isCreatingSession}
      error={error}
      socketStatus={socketStatus}
    />
  )
}

export default App
