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
  isOff?: boolean
  isTrap?: boolean
  tag?: string
  glitchLevel?: number
}

export interface FeedPost {
  id: string
  type: FeedPostType
  content: FeedPostContent
}

export interface CombatTurnEffect {
  target: 'player' | 'enemy' | string
  kind: string
  amount: number
  label: string
}

export interface CombatTurnResult {
  playerAction: string
  enemyAction: string
  playerDamage: number
  enemyDamage: number
  enemyHp: number
  enemyAttention?: number
  playerAttention: number
  playerActionCost?: number
  enemyActionCost?: number
  playerActionValue?: number
  enemyActionValue?: number
  playerATSpent?: number
  enemyATSpent?: number
  playerATRefund?: number
  enemyATRefund?: number
  playerPenaltyAT?: number
  enemyPenaltyAT?: number
  playerState?: string
  enemyState?: string
  effects: CombatTurnEffect[]
}

export interface CombatActionPreview {
  type: string
  label: string
  cost: number
  value: number
  exploitId?: string
}

export interface CombatEnemyAbility {
  id: string
  name: string
}

export interface CombatEnemy {
  id: string
  name: string
  maxHp: number
  baseAttack: number
  abilities?: CombatEnemyAbility[]
}

export interface CombatSnapshot {
  enemy?: CombatEnemy
  enemyHp?: number
  turn?: 'player' | 'enemy' | string
  turnPhase?: string
  turnCount?: number
  playerBlock?: boolean
  playerParry?: boolean
  enemyBlock?: boolean
  enemyParry?: boolean
  lastEnemyActionValue?: number
  lastEnemyActionCost?: number
  playerCooldowns?: Record<string, number>
  enemyCooldowns?: Record<string, number>
  pendingEnemyAction?: CombatActionPreview
  pendingPlayerAction?: CombatActionPreview
  disabledExploits?: Record<string, number>
  log?: CombatTurnResult[]
}

export interface PlayerExploit {
  id: string
  name: string
  kind?: string
  description?: string
  effects?: StatEffect[]
}

export interface StatEffect {
  stat: string
  amount: number
  description: string
}

export interface PlayerItem {
  id: string
  name: string
  description?: string
  image?: string
  effects?: StatEffect[]
  discardAttention?: number
}

export interface RewardItem {
  item?: PlayerItem | null
  decision?: string
}

export interface RewardState {
  enemyId?: string
  enemyName?: string
  phase?: 'exploit_choice' | 'item_choice' | 'complete' | string
  exploitOptions?: PlayerExploit[]
  selectedExploitId?: string
  itemRewards?: RewardItem[]
  currentItemIndex?: number
  discardAttentionSum?: number
}

export interface RunProgress {
  combatsWon?: number
  exploitsCollected?: number
  itemsKept?: number
  itemsDiscarded?: number
}

export interface ServerState {
  phase?: string
  outcome?: string
  score?: number
  attention?: number
  maxAttention?: number
  attack?: number
  block?: number
  parry?: number
  noise?: number
  exploits?: Array<PlayerExploit | null>
  inventory?: Array<PlayerExploit | null>
  items?: Array<PlayerItem | null>
  reward?: RewardState | null
  progress?: RunProgress | null
  combat?: CombatSnapshot | null
  [key: string]: unknown
}

export interface SessionCreateResponse {
  sessionId?: string | null
  state?: ServerState | null
}

export interface SocketMessage {
  type?: string
  phase?: string
  delayMs?: number
  enemyAction?: CombatActionPreview
  state?: ServerState
  post?: FeedPost
  enemy?: CombatEnemy
  turn?: CombatTurnResult
  result?: 'win' | 'lose' | string
  score?: number
  error?: string
  [key: string]: unknown
}

export interface GameState {
  phase: string
  sessionId: string | null
  serverState: ServerState | null
  feedPosts: FeedPost[]
  pendingCombatStart: boolean
  pendingCombatEnemyId: string | null
  combatSummaryPending: boolean
  socketStatus: SocketStatus
  isCreatingSession: boolean
  error: string | null
  latestCombatTurn: CombatTurnResult | null
  latestCombatResult: string | null
  gameOverScore: number | null
  combatTurnPhase: string | null
  revealedEnemyAction: CombatActionPreview | null
  pendingPlayerAction: CombatActionPreview | null
}

type GameAction =
  | { type: 'SESSION_CREATE_REQUEST' }
  | { type: 'SESSION_CREATE_SUCCESS'; payload: SessionCreateResponse }
  | { type: 'SESSION_CREATE_FAILURE'; payload?: string }
  | { type: 'FEED_SCROLL_FAILURE'; payload: string }
  | { type: 'FEED_ADVANCE' }
  | { type: 'COMBAT_ENTRANCE_COMPLETE' }
  | { type: 'COMBAT_SUMMARY_CONTINUE' }
  | { type: 'COMBAT_ACTION_QUEUED'; payload: CombatActionPreview | null }
  | { type: 'SOCKET_STATUS'; payload: SocketStatus }
  | { type: 'SOCKET_MESSAGE'; payload: SocketMessage }
  | { type: 'RETURN_TO_TITLE' }

export const initialGameState: GameState = {
  phase: 'start',
  sessionId: null,
  serverState: null,
  feedPosts: [],
  pendingCombatStart: false,
  pendingCombatEnemyId: null,
  combatSummaryPending: false,
  socketStatus: 'disconnected',
  isCreatingSession: false,
  error: null,
  latestCombatTurn: null,
  latestCombatResult: null,
  gameOverScore: null,
  combatTurnPhase: null,
  revealedEnemyAction: null,
  pendingPlayerAction: null,
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
        pendingCombatStart: false,
        pendingCombatEnemyId: null,
        combatSummaryPending: false,
        phase: typeof serverState?.phase === 'string' ? serverState.phase : 'feed',
        isCreatingSession: false,
        error: null,
        latestCombatTurn: null,
        latestCombatResult: null,
        gameOverScore: null,
        combatTurnPhase: null,
        revealedEnemyAction: null,
        pendingPlayerAction: null,
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
    case 'COMBAT_ENTRANCE_COMPLETE':
      return {
        ...state,
        phase: state.pendingCombatStart ? 'combat' : state.phase,
        pendingCombatStart: false,
        pendingCombatEnemyId: null,
        combatSummaryPending: false,
        latestCombatTurn: null,
        latestCombatResult: null,
        combatTurnPhase: null,
        revealedEnemyAction: null,
        pendingPlayerAction: null,
      }
    case 'COMBAT_SUMMARY_CONTINUE':
      return {
        ...state,
        combatSummaryPending: false,
        phase: state.phase === 'combat' ? 'feed' : state.phase,
        latestCombatTurn: null,
        latestCombatResult: null,
        combatTurnPhase: null,
        revealedEnemyAction: null,
      }
    case 'COMBAT_ACTION_QUEUED':
      return {
        ...state,
        pendingPlayerAction: action.payload,
      }
    case 'SOCKET_STATUS':
      return {
        ...state,
        socketStatus: action.payload,
      }
    case 'RETURN_TO_TITLE':
      return {
        ...initialGameState,
        socketStatus: state.socketStatus,
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
        const serverPhase = action.payload.state.phase
        const phase =
          serverPhase === 'game_over'
            ? 'game_over'
            : serverPhase === 'combat'
              ? state.pendingCombatStart
              ? state.phase
                : 'combat'
              : serverPhase === 'combat_resolved'
                ? 'combat_resolved'
              : serverPhase === 'reward_selection'
                ? 'reward_selection'
              : serverPhase === 'reward'
                ? 'reward'
              : serverPhase === 'feed'
                ? 'feed'
                : state.phase
        return {
          ...state,
          serverState: action.payload.state,
          phase,
          pendingCombatStart: serverPhase === 'combat' ? state.pendingCombatStart : false,
          pendingCombatEnemyId: serverPhase === 'combat' ? state.pendingCombatEnemyId : null,
          combatSummaryPending: false,
          latestCombatTurn:
            phase === 'combat' ||
            phase === 'combat_resolved' ||
            phase === 'reward_selection' ||
            phase === 'reward' ||
            state.pendingCombatStart
              ? state.latestCombatTurn
              : null,
          latestCombatResult:
            phase === 'combat' ||
            phase === 'combat_resolved' ||
            phase === 'reward_selection' ||
            phase === 'reward' ||
            phase === 'game_over' ||
            state.pendingCombatStart ||
            state.combatSummaryPending
              ? state.latestCombatResult
              : null,
          combatTurnPhase:
            typeof action.payload.state.combat?.turnPhase === 'string'
              ? action.payload.state.combat.turnPhase
              : phase === 'combat' || phase === 'combat_resolved' || phase === 'reward_selection'
                ? state.combatTurnPhase
                : null,
          pendingPlayerAction:
            action.payload.state.combat?.pendingPlayerAction ??
            (phase === 'combat' || phase === 'combat_resolved' || phase === 'reward_selection'
              ? state.pendingPlayerAction
              : null),
          revealedEnemyAction:
            action.payload.state.combat?.pendingEnemyAction ??
            (phase === 'combat' || phase === 'combat_resolved' || phase === 'reward_selection'
              ? state.revealedEnemyAction
              : null),
        }
      }

      if (action.payload?.type === 'COMBAT_START') {
        return {
          ...state,
          pendingCombatStart: true,
          pendingCombatEnemyId: action.payload.enemy?.id ?? null,
          error: null,
          combatTurnPhase: 'player_select',
          pendingPlayerAction: null,
          revealedEnemyAction: null,
        }
      }

      if (action.payload?.type === 'COMBAT_RESULT' && action.payload.turn) {
        return {
          ...state,
          latestCombatTurn: action.payload.turn,
          error: null,
          combatTurnPhase: 'player_select',
          pendingPlayerAction: null,
          revealedEnemyAction: null,
        }
      }

      if (action.payload?.type === 'COMBAT_PHASE') {
        return {
          ...state,
          combatTurnPhase: action.payload.phase ?? state.combatTurnPhase,
          pendingPlayerAction:
            action.payload.phase === 'enemy_thinking' || action.payload.phase === 'enemy_reveal'
              ? state.pendingPlayerAction
              : action.payload.phase?.startsWith('resolving')
                ? state.pendingPlayerAction
                : state.pendingPlayerAction,
          revealedEnemyAction: action.payload.enemyAction ?? state.revealedEnemyAction,
        }
      }

      if (action.payload?.type === 'COMBAT_END') {
        return {
          ...state,
          phase:
            action.payload.result === 'win'
              ? 'combat_resolved'
              : state.phase === 'combat'
                ? 'combat'
                : state.phase,
          combatSummaryPending: false,
          latestCombatResult: action.payload.result ?? null,
          error: null,
          combatTurnPhase: action.payload.result === 'win' ? 'resolved' : null,
          pendingPlayerAction: null,
          revealedEnemyAction: null,
        }
      }

      if (action.payload?.type === 'GAME_OVER') {
        return {
          ...state,
          phase: 'game_over',
          gameOverScore:
            typeof action.payload.score === 'number'
              ? action.payload.score
              : state.gameOverScore,
          combatSummaryPending: false,
          latestCombatResult: 'lose',
          combatTurnPhase: null,
          pendingPlayerAction: null,
          revealedEnemyAction: null,
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
