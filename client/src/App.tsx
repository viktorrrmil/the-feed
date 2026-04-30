import FeedScreen from './screens/FeedScreen'
import GameOverScreen from './screens/GameOverScreen'
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
    completeCombatEntrance,
    continueAfterCombatSummary,
    sendCombatAction,
    latestCombatTurn,
    latestCombatResult,
    gameOverScore,
    pendingCombatStart,
    pendingCombatEnemyId,
    combatSummaryPending,
    combatTurnPhase,
    revealedEnemyAction,
  } = useGameState()

  if (phase === 'feed' || phase === 'combat') {
    const score = typeof serverState?.score === 'number' ? serverState.score : 0
    return (
      <FeedScreen
        phase={phase}
        sessionId={sessionId}
        serverState={serverState}
        socketStatus={socketStatus}
        posts={feedPosts}
        score={score}
        onScroll={scrollFeed}
        onAdvance={advanceFeed}
        onCombatEntranceComplete={completeCombatEntrance}
        onCombatSummaryContinue={continueAfterCombatSummary}
        latestCombatTurn={latestCombatTurn}
        latestCombatResult={latestCombatResult}
        pendingCombatStart={pendingCombatStart}
        pendingCombatEnemyId={pendingCombatEnemyId}
        combatSummaryPending={combatSummaryPending}
        combatTurnPhase={combatTurnPhase}
        revealedEnemyAction={revealedEnemyAction}
        onCombatAction={sendCombatAction}
      />
    )
  }

  if (phase === 'game_over') {
    const score =
      gameOverScore ?? (typeof serverState?.score === 'number' ? serverState.score : 0)
    return <GameOverScreen score={score} onRestart={createSession} />
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
