export type SocketStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export type FeedPostType = 'normal' | 'evil'

export interface FeedPostContent {
  author?: string
  handle?: string
  message?: string
  likes?: number
  enemyId?: string
  enemyName?: string
}

export interface FeedPost {
  id: string
  type: FeedPostType
  content: FeedPostContent
}

export interface ServerState {
  phase?: string
  score?: number
  [key: string]: unknown
}

export interface SessionCreateResponse {
  sessionId?: string | null
  state?: ServerState | null
}

export interface SocketMessage {
  type?: string
  state?: ServerState
  post?: FeedPost
  error?: string
  [key: string]: unknown
}

export interface GameState {
  phase: string
  sessionId: string | null
  serverState: ServerState | null
  feedPosts: FeedPost[]
  socketStatus: SocketStatus
  isCreatingSession: boolean
  error: string | null
}

type GameAction =
  | { type: 'SESSION_CREATE_REQUEST' }
  | { type: 'SESSION_CREATE_SUCCESS'; payload: SessionCreateResponse }
  | { type: 'SESSION_CREATE_FAILURE'; payload?: string }
  | { type: 'FEED_SCROLL_FAILURE'; payload: string }
  | { type: 'FEED_ADVANCE' }
  | { type: 'SOCKET_STATUS'; payload: SocketStatus }
  | { type: 'SOCKET_MESSAGE'; payload: SocketMessage }

export const initialGameState: GameState = {
  phase: 'start',
  sessionId: null,
  serverState: null,
  feedPosts: [],
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
        feedPosts: [],
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
    case 'FEED_SCROLL_FAILURE':
      return {
        ...state,
        error: action.payload,
      }
    case 'FEED_ADVANCE':
      return {
        ...state,
        feedPosts: state.feedPosts.slice(1),
      }
    case 'SOCKET_STATUS':
      return {
        ...state,
        socketStatus: action.payload,
      }
    case 'SOCKET_MESSAGE': {
      if (action.payload?.type === 'FEED_POST' && action.payload.post) {
        return {
          ...state,
          feedPosts: [...state.feedPosts, action.payload.post].slice(-2),
          error: null,
        }
      }

      if (action.payload?.type === 'STATE_UPDATE' && action.payload.state) {
        return {
          ...state,
          serverState: action.payload.state,
          phase: action.payload.state.phase ?? state.phase,
        }
      }

      if (action.payload?.type === 'ERROR') {
        return {
          ...state,
          error: action.payload.error ?? 'Unexpected websocket error',
        }
      }

      return state
    }
    default:
      return state
  }
}
