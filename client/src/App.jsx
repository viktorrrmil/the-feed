import FeedScreen from './screens/FeedScreen.jsx'
import StartScreen from './screens/StartScreen.jsx'
import { useGameState } from './hooks/useGameState.js'

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
