import { useState } from 'react'
import FeedScreen from './screens/FeedScreen'
import GameOverScreen from './screens/GameOverScreen'
import HowToPlayScreen from './screens/HowToPlayScreen'
import StartScreen from './screens/StartScreen'
import { useGameState } from './hooks/useGameState'

function App() {
  const [menuScreen, setMenuScreen] = useState<'start' | 'how-to-play'>('start')

  const {
    phase,
    sessionId,
    serverState,
    socketStatus,
    feedPosts,
    isCreatingSession,
    error,
    createSession,
    returnToTitle,
    scrollFeed,
    advanceFeed,
    likePost,
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
    pendingPlayerAction,
    selectRewardExploit,
    resolveRewardItem,
    completeRewards,
    updateLoadout,
  } = useGameState()

  if (
    phase === 'feed' ||
    phase === 'combat' ||
    phase === 'combat_resolved' ||
    phase === 'reward_selection' ||
    phase === 'reward'
  ) {
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
            onLikePost={likePost}
            onCombatEntranceComplete={completeCombatEntrance}
            onCombatSummaryContinue={continueAfterCombatSummary}
            latestCombatTurn={latestCombatTurn}
            latestCombatResult={latestCombatResult}
            pendingCombatStart={pendingCombatStart}
            pendingCombatEnemyId={pendingCombatEnemyId}
            combatSummaryPending={combatSummaryPending}
            combatTurnPhase={combatTurnPhase}
            revealedEnemyAction={revealedEnemyAction}
            pendingPlayerAction={pendingPlayerAction}
            onCombatAction={sendCombatAction}
            onRewardExploitSelect={selectRewardExploit}
            onRewardItemDecision={resolveRewardItem}
            onRewardComplete={completeRewards}
            onLoadoutChange={updateLoadout}
        />
    )
  }

  if (phase === 'game_over') {
    const score =
        gameOverScore ?? (typeof serverState?.score === 'number' ? serverState.score : 0)
    return (
      <GameOverScreen
        score={score}
        outcome={typeof serverState?.outcome === 'string' ? serverState.outcome : 'defeat'}
        exploitsCollected={serverState?.progress?.exploitsCollected ?? 0}
        onRestart={createSession}
        onMainMenu={returnToTitle}
      />
    )
  }

  if (menuScreen === 'how-to-play') {
    return <HowToPlayScreen onBack={() => setMenuScreen('start')} />
  }

  return (
      <StartScreen
          onStart={createSession}
          onHowToPlay={() => setMenuScreen('how-to-play')}
          isCreating={isCreatingSession}
          error={error}
          socketStatus={socketStatus}
      />
  )
}

export default App
