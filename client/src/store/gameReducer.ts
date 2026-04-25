export type SocketStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface ServerState {
  phase?: string
  [key: string]: unknown
}

export interface SessionCreateResponse {
  sessionId?: string | null
  state?: ServerState | null
}

export interface SocketMessage {
  type?: string
  state?: ServerState
  [key: string]: unknown
}

export interface GameState {
  phase: string
  sessionId: string | null
  serverState: ServerState | null
  socketStatus: SocketStatus
  isCreatingSession: boolean
  error: string | null
}

type GameAction =
  | { type: 'SESSION_CREATE_REQUEST' }
  | { type: 'SESSION_CREATE_SUCCESS'; payload: SessionCreateResponse }
  | { type: 'SESSION_CREATE_FAILURE'; payload?: string }
  | { type: 'SOCKET_STATUS'; payload: SocketStatus }
  | { type: 'SOCKET_MESSAGE'; payload: SocketMessage }

export const initialGameState: GameState = {
  phase: 'start',
  sessionId: null,
  serverState: null,
  socketStatus: 'disconnected',
  isCreatingSession: false,
  error: null,
}

export const gameReducer = (state: GameState, action: GameAction): GameState => {
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
        phase: typeof serverState?.phase === 'string' ? serverState.phase : 'feed',
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
