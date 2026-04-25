import { useCallback, useEffect, useReducer } from 'react'
import { gameReducer, initialGameState } from '../store/gameReducer.js'
import { useGameSocket } from './useGameSocket.js'

export const useGameState = () => {
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const { status, sendMessage } = useGameSocket(state.sessionId, (message) => {
    dispatch({ type: 'SOCKET_MESSAGE', payload: message })
  })

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
      const data = await response.json()
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
