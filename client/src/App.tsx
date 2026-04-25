import FeedScreen from './screens/FeedScreen'
import StartScreen from './screens/StartScreen'
import { useGameState } from './hooks/useGameState'

function App() {
  const {
    phase,
    sessionId,
    serverState,
    socketStatus,
    feedPosts,
    isCreatingSession,
    error,
    createSession,
    scrollFeed,
    advanceFeed,
  } = useGameState()

  if (phase === 'feed') {
    const score = typeof serverState?.score === 'number' ? serverState.score : 0
    return (
      <FeedScreen
        sessionId={sessionId}
        serverState={serverState}
        socketStatus={socketStatus}
        posts={feedPosts}
        score={score}
        onScroll={scrollFeed}
        onAdvance={advanceFeed}
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
