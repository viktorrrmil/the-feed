import { useCallback, useEffect, useReducer } from 'react'
import {
  gameReducer,
  initialGameState,
  type SessionCreateResponse,
  type SocketMessage,
} from '../store/gameReducer'
import { useGameSocket } from './useGameSocket'

export const useGameState = () => {
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const handleSocketMessage = useCallback((message: SocketMessage) => {
    dispatch({ type: 'SOCKET_MESSAGE', payload: message })
  }, [])
  const { status, sendMessage } = useGameSocket(state.sessionId, handleSocketMessage)

  useEffect(() => {
    dispatch({ type: 'SOCKET_STATUS', payload: status })
  }, [status])

  const scrollFeed = useCallback((): boolean => {
    const sent = sendMessage({ type: 'SCROLL' })
    if (!sent) {
      dispatch({
        type: 'FEED_SCROLL_FAILURE',
        payload: 'Feed scroll failed: socket is not connected',
      })
    }
    return sent
  }, [sendMessage])

  const advanceFeed = useCallback(() => {
    const currentPostId = state.feedPosts[0]?.id
    if (currentPostId) {
      sendMessage({ type: 'ADVANCE_FEED', postId: currentPostId })
    }
    dispatch({ type: 'FEED_ADVANCE' })
  }, [sendMessage, state.feedPosts])

  const likePost = useCallback(
    (postId: string): boolean => {
      const sent = sendMessage({ type: 'LIKE_POST', postId })
      if (!sent) {
        dispatch({
          type: 'FEED_SCROLL_FAILURE',
          payload: 'Post like failed: socket is not connected',
        })
      }
      return sent
    },
    [sendMessage],
  )

  const completeCombatEntrance = useCallback(() => {
    dispatch({ type: 'COMBAT_ENTRANCE_COMPLETE' })
  }, [])

  const continueAfterCombatSummary = useCallback(() => {
    dispatch({ type: 'COMBAT_SUMMARY_CONTINUE' })
  }, [])

  const sendCombatAction = useCallback(
    (action: 'attack' | 'block' | 'parry' | 'exploit', exploitId?: string): boolean => {
      const previewValue =
        action === 'attack'
          ? state.serverState?.attack ?? 9
          : action === 'block'
            ? state.serverState?.block ?? 5
            : action === 'parry'
              ? state.serverState?.parry ?? 4
              : 0
      dispatch({
        type: 'COMBAT_ACTION_QUEUED',
        payload: {
          type: action,
          label: action === 'exploit' ? 'Exploit' : action[0].toUpperCase() + action.slice(1),
          cost: action === 'attack' ? 9 : action === 'block' ? 5 : action === 'parry' ? 4 : 8,
          value: previewValue,
          exploitId,
        },
      })
      const sent = sendMessage({ type: 'COMBAT_ACTION', action, exploitId })
      if (!sent) {
        dispatch({ type: 'COMBAT_ACTION_QUEUED', payload: null })
        dispatch({
          type: 'FEED_SCROLL_FAILURE',
          payload: 'Combat action failed: socket is not connected',
        })
      }
      return sent
    },
    [sendMessage, state.serverState?.attack, state.serverState?.block, state.serverState?.parry],
  )

  const selectRewardExploit = useCallback(
    (exploitId: string): boolean => {
      const sent = sendMessage({ type: 'SELECT_REWARD_EXPLOIT', exploitId })
      if (!sent) {
        dispatch({
          type: 'FEED_SCROLL_FAILURE',
          payload: 'Reward selection failed: socket is not connected',
        })
      }
      return sent
    },
    [sendMessage],
  )

  const resolveRewardItem = useCallback(
    (itemId: string, decision: 'keep' | 'discard'): boolean => {
      const sent = sendMessage({ type: 'RESOLVE_REWARD_ITEM', itemId, decision })
      if (!sent) {
        dispatch({
          type: 'FEED_SCROLL_FAILURE',
          payload: 'Reward item decision failed: socket is not connected',
        })
      }
      return sent
    },
    [sendMessage],
  )

  const completeRewards = useCallback((): boolean => {
    const sent = sendMessage({ type: 'COMPLETE_REWARDS' })
    if (!sent) {
      dispatch({
        type: 'FEED_SCROLL_FAILURE',
        payload: 'Reward completion failed: socket is not connected',
      })
    }
    return sent
  }, [sendMessage])

  const updateLoadout = useCallback(
    (exploitIds: string[]): boolean => {
      const sent = sendMessage({ type: 'UPDATE_LOADOUT', exploitIds })
      if (!sent) {
        dispatch({
          type: 'FEED_SCROLL_FAILURE',
          payload: 'Inventory update failed: socket is not connected',
        })
      }
      return sent
    },
    [sendMessage],
  )

  const returnToTitle = useCallback(() => {
    dispatch({ type: 'RETURN_TO_TITLE' })
  }, [])

  const createSession = useCallback(async () => {
    dispatch({ type: 'SESSION_CREATE_REQUEST' })

    try {
      const response = await fetch('/api/session/new', { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Failed to create session (${response.status})`)
      }
      const data = (await response.json()) as SessionCreateResponse
      dispatch({ type: 'SESSION_CREATE_SUCCESS', payload: data })
    } catch (error) {
      dispatch({
        type: 'SESSION_CREATE_FAILURE',
        payload:
          error instanceof Error ? error.message : 'Failed to create session',
      })
    }
  }, [])

  return {
    ...state,
    socketStatus: state.socketStatus,
    sendMessage,
    createSession,
    returnToTitle,
    scrollFeed,
    advanceFeed,
    likePost,
    completeCombatEntrance,
    continueAfterCombatSummary,
    sendCombatAction,
    selectRewardExploit,
    resolveRewardItem,
    completeRewards,
    updateLoadout,
  }
}
