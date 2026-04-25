export const initialGameState = {
  phase: 'start',
  sessionId: null,
  serverState: null,
  socketStatus: 'disconnected',
  isCreatingSession: false,
  error: null,
}

export const gameReducer = (state, action) => {
  switch (action.type) {
    case 'SESSION_CREATE_REQUEST':
      return {
        ...state,
        isCreatingSession: true,
        error: null,
      }
    case 'SESSION_CREATE_SUCCESS': {
      const serverState = action.payload?.state ?? null
      return {
        ...state,
        sessionId: action.payload?.sessionId ?? null,
        serverState,
        phase: serverState?.phase ?? 'feed',
        isCreatingSession: false,
        error: null,
      }
    }
    case 'SESSION_CREATE_FAILURE':
      return {
        ...state,
        isCreatingSession: false,
        error: action.payload ?? 'Failed to create session',
      }
    case 'SOCKET_STATUS':
      return {
        ...state,
        socketStatus: action.payload,
      }
    case 'SOCKET_MESSAGE': {
      if (action.payload?.type === 'STATE_UPDATE' && action.payload.state) {
        return {
          ...state,
          serverState: action.payload.state,
          phase: action.payload.state.phase ?? state.phase,
        }
      }
      return state
    }
    default:
      return state
  }
}
