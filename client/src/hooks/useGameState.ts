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
  const { status, sendMessage } = useGameSocket(
    state.sessionId,
    (message: SocketMessage) => {
      dispatch({ type: 'SOCKET_MESSAGE', payload: message })
    },
  )

  useEffect(() => {
    dispatch({ type: 'SOCKET_STATUS', payload: status })
  }, [status])

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
  }
}
