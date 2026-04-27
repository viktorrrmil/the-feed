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
    dispatch({ type: 'FEED_ADVANCE' })
  }, [])

  const sendCombatAction = useCallback(
    (action: 'attack' | 'block' | 'parry' | 'exploit', exploitId?: string): boolean => {
      const sent = sendMessage({ type: 'COMBAT_ACTION', action, exploitId })
      if (!sent) {
        dispatch({
          type: 'FEED_SCROLL_FAILURE',
          payload: 'Combat action failed: socket is not connected',
        })
      }
      return sent
    },
    [sendMessage],
  )

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
    scrollFeed,
    advanceFeed,
    sendCombatAction,
  }
}
