import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
  type PointerEventHandler,
} from 'react'
import EvilPost from '../components/EvilPost'
import ProfileCard from '../components/ProfileCard'
import Post from '../components/Post'
import type {
  CombatActionPreview,
  CombatTurnResult,
  FeedPost,
  PlayerExploit,
  ServerState,
  SocketStatus,
} from '../store/gameReducer'

interface FeedScreenProps {
  phase: string
  sessionId: string | null
  serverState: ServerState | null
  socketStatus: SocketStatus
  posts: FeedPost[]
  score: number
  onScroll: () => boolean
  onAdvance: () => void
  onCombatEntranceComplete: () => void
  onCombatSummaryContinue: () => void
  latestCombatTurn: CombatTurnResult | null
  latestCombatResult: string | null
  pendingCombatStart: boolean
  pendingCombatEnemyId: string | null
  combatSummaryPending: boolean
  combatTurnPhase: string | null
  revealedEnemyAction: CombatActionPreview | null
  onCombatAction: (action: 'attack' | 'block' | 'parry' | 'exploit', exploitId?: string) => boolean
}

type SwipeAnimation = 'none' | 'snap-forward' | 'snap-back'
type CombatActionType = 'attack' | 'block' | 'parry' | 'exploit'
type ActionDetailKind = 'basic' | 'exploit'
const ENCOUNTER_LOCK_MS = 2000
const ENCOUNTER_TOTAL_MS = 2860
const ENCOUNTER_START_DELAY_MS = 70
const COMBAT_RETURN_MS = 760
const BEST_SCORE_STORAGE_KEY = 'the-feed-best-score'
const EMPTY_COMBAT_LOG: CombatTurnResult[] = []
const EMPTY_INVENTORY: Array<{ id?: string; name?: string } | null> = []
const ACTION_COSTS: Record<CombatActionType, number> = {
  attack: 9,
  block: 5,
  parry: 4,
  exploit: 8,
}
const ACTION_LABELS: Record<CombatActionType, string> = {
  attack: 'Attack',
  block: 'Block',
  parry: 'Parry',
  exploit: 'Exploit',
}
const ACTION_ICONS: Record<CombatActionType, string> = {
  attack: '/attack.png',
  block: '/block.png',
  parry: '/parry.png',
  exploit: '/exploit.png',
}
const EXPLOIT_LIBRARY = [
  { id: 'focused_reply', name: 'Focused Reply', effect: 'Reliable strike. Consistent output.' },
  { id: 'growth_hack', name: 'Growth Hack', effect: 'Variable hit. High upside with noise.' },
  { id: 'volatility_engine', name: 'Volatility Engine', effect: 'Swingy burst. Wide damage spread.' },
  { id: 'bait_loop', name: 'Bait Loop', effect: 'Pressure move. Scales with noise.' },
]
const LOCKED_EXPLOIT_SLOTS = 2
interface CombatSummaryData {
  result: 'win' | 'lose'
  enemyName: string
  turns: number
  totalDamageDealt: number
  totalDamageTaken: number
  rewards: string[]
}
interface ActionDetail {
  id: string
  name: string
  kind: ActionDetailKind
  costLabel: string
  damageLabel: string
  effect: string
}
interface HoverCloudState {
  x: number
  y: number
  actionId?: string
  historyIndex?: number
}

function getExploitDamageRange(exploitId: string | undefined, noise: number) {
  if (!exploitId) {
    return { min: 0, max: 0 }
  }
  if (exploitId === 'focused_reply') {
    const value = 11 + noise
    return { min: value, max: value }
  }
  if (exploitId === 'growth_hack') {
    return { min: 8 + noise, max: 11 + noise }
  }
  if (exploitId === 'volatility_engine') {
    const base = 6 + noise
    return { min: base, max: base + 7 }
  }
  if (exploitId === 'bait_loop') {
    const value = 10 + noise
    return { min: value, max: value }
  }
  const fallback = 9 + noise
  return { min: fallback, max: fallback }
}

function formatDamageRange(min: number, max: number) {
  if (max <= 0) {
    return '0'
  }
  return min === max ? `${max}` : `${min}-${max}`
}

function FeedScreen({
  phase,
  sessionId,
  serverState,
  socketStatus,
  posts,
  score,
  onScroll,
  onAdvance,
  onCombatEntranceComplete,
  onCombatSummaryContinue,
  latestCombatTurn,
  latestCombatResult,
  pendingCombatStart,
  pendingCombatEnemyId,
  combatSummaryPending,
  combatTurnPhase,
  revealedEnemyAction,
  onCombatAction,
}: FeedScreenProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const startYRef = useRef<number | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const dragOffsetRef = useRef(0)
  const lastPointerYRef = useRef(0)
  const lastPointerTimeRef = useRef(0)
  const velocityRef = useRef(0)
  const pendingPostsRef = useRef(0)
  const previousLengthRef = useRef(posts.length)
  const settleTimerRef = useRef<number | null>(null)
  const lockTimerRef = useRef<number | null>(null)
  const encounterTimerRef = useRef<number | null>(null)
  const encounterStartTimerRef = useRef<number | null>(null)
  const summaryReadyRef = useRef(false)
  const returnTimerRef = useRef<number | null>(null)
  const visiblePostIdRef = useRef<string | null>(null)
  const combatInventoryBaselineRef = useRef<string[]>([])
  const combatSummaryRef = useRef<CombatSummaryData>({
    result: 'win',
    enemyName: 'Signal Reaper',
    turns: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    rewards: [],
  })
  const lastTriggeredEvilPostIdRef = useRef<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [swipeAnimation, setSwipeAnimation] = useState<SwipeAnimation>('none')
  const [isEncounterActive, setIsEncounterActive] = useState(false)
  const [isEncounterLockPhase, setIsEncounterLockPhase] = useState(false)
  const [postCombatSummary, setPostCombatSummary] = useState<CombatSummaryData | null>(null)
  const [isCombatReturnActive, setIsCombatReturnActive] = useState(false)
  const [isInputLocked, setIsInputLocked] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [selectedExploitId, setSelectedExploitId] = useState('focused_reply')
  const [selectedCombatAction, setSelectedCombatAction] = useState<CombatActionType | null>(null)
  const [hoveredHistoryIndex, setHoveredHistoryIndex] = useState(0)
  const [hoverCloud, setHoverCloud] = useState<HoverCloudState | null>(null)
  const [storedBestScore] = useState(() => {
    const persistedBestScore = Number.parseInt(
      window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) ?? '0',
      10,
    )
    return Number.isFinite(persistedBestScore) && persistedBestScore > 0 ? persistedBestScore : 0
  })
  const [impactFrame, setImpactFrame] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  })

  const currentPost = posts[0] ?? null
  const nextPost = posts[1] ?? null
  const connected = socketStatus === 'connected'
  const isCombatPhase = phase === 'combat'
  const combat = serverState?.combat ?? null
  const combatEnemy = combat?.enemy
  const combatEnemyMaxHp = typeof combatEnemy?.maxHp === 'number' ? combatEnemy.maxHp : 1
  const combatEnemyHp = typeof combat?.enemyHp === 'number' ? combat.enemyHp : combatEnemyMaxHp
  const currentNoise =
    typeof serverState?.noise === 'number' ? Math.max(1, Math.min(serverState.noise, 9)) : 1
  const combatEnemyHpPercent = Math.max(
    0,
    Math.min(100, Math.round((combatEnemyHp / combatEnemyMaxHp) * 100)),
  )
  const combatLog = Array.isArray(combat?.log) ? combat.log : EMPTY_COMBAT_LOG
  const combatTurn = combat?.turn
  const inventory = (Array.isArray(serverState?.inventory)
    ? serverState.inventory
    : EMPTY_INVENTORY) as Array<{ id?: string; name?: string } | null>
  const inventoryIds = inventory
    .filter((entry): entry is { id: string; name?: string } => Boolean(entry?.id))
    .map((entry) => entry.id)
  const equippedExploits = useMemo(
    () =>
      (Array.isArray(serverState?.exploits)
        ? serverState.exploits
        : []) as Array<PlayerExploit | null>,
    [serverState],
  )
  const disabledExploits = (combat?.disabledExploits ?? {}) as Record<string, number>
  const availableExploitIds = equippedExploits
    .filter((exploit): exploit is PlayerExploit => Boolean(exploit?.id))
    .map((exploit) => exploit.id)
  const effectiveSelectedExploitId = selectedExploitId || (availableExploitIds[0] ?? '')
  const isReturnTransitionActive = isCombatReturnActive
  const isPostCombatSummaryActive = combatSummaryPending && !isReturnTransitionActive
  const isBattleMockupActive =
    isCombatPhase || isEncounterActive || isPostCombatSummaryActive || isReturnTransitionActive
  const activeTurnPhase = combatTurnPhase ?? (typeof combat?.turnPhase === 'string' ? combat.turnPhase : null)
  const isEnemyThinkingPhase = activeTurnPhase === 'enemy_thinking'
  const isEnemyRevealPhase = activeTurnPhase === 'enemy_reveal'
  const isResolvingPhase = activeTurnPhase === 'resolving'
  const canActInCombat =
    connected &&
    isCombatPhase &&
    (activeTurnPhase === null || activeTurnPhase === 'player_select') &&
    combatTurn === 'player' &&
    !isEncounterActive &&
    !isPostCombatSummaryActive &&
    !isReturnTransitionActive
  const isInteractionLocked = isInputLocked || isMenuOpen
  const isFeedInteractionLocked =
    isInteractionLocked || isCombatPhase || isPostCombatSummaryActive || isReturnTransitionActive
  const maxAttention =
    typeof serverState?.maxAttention === 'number' && serverState.maxAttention > 0
      ? serverState.maxAttention
      : 100
  const currentAttention =
    typeof serverState?.attention === 'number'
      ? Math.max(0, Math.min(serverState.attention, maxAttention))
      : maxAttention
  const selectedActionCost = selectedCombatAction ? ACTION_COSTS[selectedCombatAction] : 0
  const projectedAttention = Math.max(currentAttention - selectedActionCost, 0)
  const attentionPreviewOffsetPercent = Math.max(
    0,
    Math.min(100, Math.round((projectedAttention / maxAttention) * 100)),
  )
  const attentionFillPercent = Math.max(
    0,
    Math.min(100, Math.round((currentAttention / maxAttention) * 100)),
  )
  const attentionPreviewPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round((Math.min(currentAttention, selectedActionCost) / maxAttention) * 100),
    ),
  )
  const canUseExploitAction =
    Boolean(effectiveSelectedExploitId) &&
    (effectiveSelectedExploitId ? (disabledExploits[effectiveSelectedExploitId] ?? 0) === 0 : false)
  const hasEnoughATForSelectedAction =
    selectedCombatAction !== null ? currentAttention >= ACTION_COSTS[selectedCombatAction] : false
  const canCommitSelectedAction =
    canActInCombat &&
    Boolean(selectedCombatAction) &&
    hasEnoughATForSelectedAction &&
    (selectedCombatAction === 'exploit' ? canUseExploitAction : true)
  const selectedExploitDamageRange = useMemo(
    () => getExploitDamageRange(effectiveSelectedExploitId, currentNoise),
    [currentNoise, effectiveSelectedExploitId],
  )
  const selectedActionDamageRange = useMemo(() => {
    if (!selectedCombatAction) {
      return { min: 0, max: 0 }
    }
    if (selectedCombatAction === 'attack') {
      return {
        min: 12 + currentNoise * 2,
        max: 15 + currentNoise * 2,
      }
    }
    if (selectedCombatAction === 'exploit') {
      return selectedExploitDamageRange
    }
    return { min: 0, max: 0 }
  }, [currentNoise, selectedCombatAction, selectedExploitDamageRange])
  const selectedActionDamagePreview = Math.round(
    (selectedActionDamageRange.min + selectedActionDamageRange.max) / 2,
  )
  const projectedEnemyHp = Math.max(combatEnemyHp - selectedActionDamagePreview, 0)
  const enemyPreviewOffsetPercent = Math.max(
    0,
    Math.min(100, Math.round((projectedEnemyHp / combatEnemyMaxHp) * 100)),
  )
  const enemyPreviewPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(((Math.min(combatEnemyHp, selectedActionDamagePreview) || 0) / combatEnemyMaxHp) * 100),
    ),
  )
  const selectedActionDamageText = formatDamageRange(selectedActionDamageRange.min, selectedActionDamageRange.max)
  const exploitSlots = useMemo(() => {
    const equipped = equippedExploits
      .filter((exploit): exploit is PlayerExploit => Boolean(exploit?.id))
      .slice(0, 2)
      .map((exploit) => ({
        id: exploit.id,
        name: exploit.name,
        kind: exploit.kind,
        locked: false,
      }))

    if (equipped.length < 2) {
      for (const fallback of EXPLOIT_LIBRARY) {
        if (equipped.some((slot) => slot.id === fallback.id)) {
          continue
        }
        equipped.push({ id: fallback.id, name: fallback.name, kind: 'mock', locked: false })
        if (equipped.length >= 2) {
          break
        }
      }
    }

    const locked = EXPLOIT_LIBRARY.filter((exploit) => !equipped.some((slot) => slot.id === exploit.id))
      .slice(0, LOCKED_EXPLOIT_SLOTS)
      .map((exploit) => ({
        id: `locked-${exploit.id}`,
        baseId: exploit.id,
        name: exploit.name,
        kind: 'locked',
        locked: true,
      }))

    return [...equipped, ...locked]
  }, [equippedExploits])
  const battleActionDetails = useMemo(() => {
    const details: Record<string, ActionDetail> = {
      attack: {
        id: 'attack',
        name: 'Attack',
        kind: 'basic',
        costLabel: `${ACTION_COSTS.attack} AT`,
        damageLabel: formatDamageRange(12 + currentNoise * 2, 15 + currentNoise * 2),
        effect: 'Direct damage. Strong and reliable.',
      },
      block: {
        id: 'block',
        name: 'Block',
        kind: 'basic',
        costLabel: `${ACTION_COSTS.block} AT`,
        damageLabel: '0',
        effect: 'Mitigates incoming damage this turn.',
      },
      parry: {
        id: 'parry',
        name: 'Parry',
        kind: 'basic',
        costLabel: `${ACTION_COSTS.parry} AT`,
        damageLabel: '0',
        effect: 'Counters enemy tempo and can punish.',
      },
    }
    for (const slot of exploitSlots) {
      if (slot.locked) {
        details[slot.id] = {
          id: slot.id,
          name: `${slot.name} (Locked)`,
          kind: 'exploit',
          costLabel: '--',
          damageLabel: '--',
          effect: 'Unlock this exploit to use it in combat.',
        }
        continue
      }
      const range = getExploitDamageRange(slot.id, currentNoise)
      const fallbackMeta = EXPLOIT_LIBRARY.find((exploit) => exploit.id === slot.id)
      details[slot.id] = {
        id: slot.id,
        name: slot.name,
        kind: 'exploit',
        costLabel: `${ACTION_COSTS.exploit} AT`,
        damageLabel: formatDamageRange(range.min, range.max),
        effect: fallbackMeta?.effect ?? 'Exploit action. Scales with current noise.',
      }
    }
    return details
  }, [currentNoise, exploitSlots])
  const combatHistory = useMemo(() => combatLog.slice(-8).reverse(), [combatLog])
  const hoveredCloudActionDetail =
    hoverCloud?.actionId ? (battleActionDetails[hoverCloud.actionId] ?? null) : null
  const hoveredCloudHistoryTurn =
    typeof hoverCloud?.historyIndex === 'number'
      ? (combatHistory[hoverCloud.historyIndex] ?? combatHistory[0] ?? null)
      : null
  const isActionCloudVisible = Boolean(hoveredCloudActionDetail && !hoveredCloudHistoryTurn)
  const isHistoryCloudVisible = Boolean(hoveredCloudHistoryTurn)
  const hoverCloudWidth = 280
  const hoverCloudHeight = 180
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const hoverCloudStyle: CSSProperties | undefined = hoverCloud
    ? {
        left: Math.min(Math.max(hoverCloud.x + 16, 10), viewportWidth - hoverCloudWidth - 10),
        top: Math.min(Math.max(hoverCloud.y + 14, 10), viewportHeight - hoverCloudHeight - 10),
      }
    : undefined
  const enemyVisibleAction =
    revealedEnemyAction ??
    (latestCombatTurn
      ? {
          type: latestCombatTurn.enemyState === 'block' ? 'block' : latestCombatTurn.enemyState === 'parry' ? 'parry' : 'attack',
          label: latestCombatTurn.enemyAction,
          cost: latestCombatTurn.enemyActionCost ?? 0,
          value: latestCombatTurn.enemyActionValue ?? 0,
        }
      : null)
  const enemyStatusLabel =
    enemyVisibleAction?.type === 'block'
      ? `BLOCK ${enemyVisibleAction.value}`
      : enemyVisibleAction?.type === 'parry'
        ? `PARRY ${enemyVisibleAction.value}`
        : ''
  const latestEffects = latestCombatTurn?.effects ?? []
  const didEnemyBlock = latestEffects.some(
    (effect) => effect.target === 'enemy' && effect.label.toLowerCase().includes('blocked'),
  )
  const didPlayerBlock = latestEffects.some(
    (effect) => effect.target === 'player' && effect.label.toLowerCase().includes('blocked'),
  )
  const didEnemyParry = latestEffects.some(
    (effect) => effect.target === 'enemy' && effect.label.toLowerCase().includes('parried'),
  )
  const didPlayerParry = latestEffects.some(
    (effect) => effect.target === 'player' && effect.label.toLowerCase().includes('parried'),
  )
  const bestScore = Math.max(score, storedBestScore)

  const setOffset = useCallback((value: number) => {
    dragOffsetRef.current = value
    setDragOffset(value)
  }, [])

  const clearEncounterTimers = useCallback(() => {
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current)
      lockTimerRef.current = null
    }
    if (encounterTimerRef.current !== null) {
      window.clearTimeout(encounterTimerRef.current)
      encounterTimerRef.current = null
    }
  }, [])

  const shouldStartEncounterForPost = useCallback(
    (post: FeedPost) => {
      if (post.type !== 'evil' || !pendingCombatStart) {
        return false
      }
      if (!pendingCombatEnemyId) {
        return true
      }
      return post.content.enemyId === pendingCombatEnemyId
    },
    [pendingCombatEnemyId, pendingCombatStart],
  )
  const isCurrentPostCombatTrigger =
    currentPost !== null ? shouldStartEncounterForPost(currentPost) : false

  const startEvilEncounter = useCallback(
    (postId: string, onComplete?: () => void) => {
      if (lastTriggeredEvilPostIdRef.current === postId) {
        return
      }

      lastTriggeredEvilPostIdRef.current = postId
      clearEncounterTimers()

      draggingRef.current = false
      setIsDragging(false)
      velocityRef.current = 0
      setSwipeAnimation('none')
      setOffset(0)
      setPostCombatSummary(null)
      setIsCombatReturnActive(false)
      setSelectedCombatAction(null)

      setIsEncounterActive(true)
      setIsEncounterLockPhase(true)
      setIsInputLocked(true)

      lockTimerRef.current = window.setTimeout(() => {
        setIsEncounterLockPhase(false)
        lockTimerRef.current = null
      }, ENCOUNTER_LOCK_MS)

      encounterTimerRef.current = window.setTimeout(() => {
        setIsEncounterActive(false)
        setIsEncounterLockPhase(false)
        setIsInputLocked(false)
        onComplete?.()
        encounterTimerRef.current = null
      }, ENCOUNTER_TOTAL_MS)
    },
    [clearEncounterTimers, setOffset],
  )

  useEffect(() => {
    visiblePostIdRef.current = currentPost?.id ?? null
  }, [currentPost?.id])

  useEffect(() => {
    if (!isCombatPhase) {
      return
    }
    if (!combatInventoryBaselineRef.current.length) {
      combatInventoryBaselineRef.current = inventoryIds
    }
    const totalDamageDealt = combatLog.reduce((total, turn) => total + turn.playerDamage, 0)
    const totalDamageTaken = combatLog.reduce((total, turn) => total + turn.enemyDamage, 0)
    combatSummaryRef.current = {
      result: latestCombatResult === 'lose' ? 'lose' : 'win',
      enemyName: combatEnemy?.name ?? 'Signal Reaper',
      turns: combatLog.length,
      totalDamageDealt,
      totalDamageTaken,
      rewards: [],
    }
  }, [combatEnemy?.name, combatLog, inventoryIds, isCombatPhase, latestCombatResult])

  useEffect(() => {
    const diff = posts.length - previousLengthRef.current
    if (diff > 0) {
      pendingPostsRef.current = Math.max(0, pendingPostsRef.current - diff)
    }
    previousLengthRef.current = posts.length
  }, [posts.length])

  useEffect(() => {
    if (!connected || isMenuOpen || isCombatPhase || pendingCombatStart) {
      pendingPostsRef.current = 0
      previousLengthRef.current = posts.length
      return
    }

    const missingPosts = 2 - (posts.length + pendingPostsRef.current)
    for (let index = 0; index < missingPosts; index += 1) {
      const sent = onScroll()
      if (!sent) {
        break
      }
      pendingPostsRef.current += 1
    }
  }, [connected, isCombatPhase, isMenuOpen, onScroll, pendingCombatStart, posts.length])

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current)
      }
      if (encounterStartTimerRef.current !== null) {
        window.clearTimeout(encounterStartTimerRef.current)
      }
      if (returnTimerRef.current !== null) {
        window.clearTimeout(returnTimerRef.current)
      }
      clearEncounterTimers()
    },
    [clearEncounterTimers],
  )

  useEffect(() => {
    if (!combatSummaryPending) {
      summaryReadyRef.current = false
      combatInventoryBaselineRef.current = []
      return
    }
    if (summaryReadyRef.current) {
      return
    }

    const baselineIds = new Set(combatInventoryBaselineRef.current)
    const newRewards = inventory
      .filter((entry): entry is { id: string; name?: string } => Boolean(entry?.id))
      .filter((entry) => !baselineIds.has(entry.id))
      .map((entry) => entry.name ?? entry.id)

    setPostCombatSummary({
      ...combatSummaryRef.current,
      result: latestCombatResult === 'lose' ? 'lose' : 'win',
      rewards: newRewards,
    })
    summaryReadyRef.current = true
  }, [combatSummaryPending, inventory, latestCombatResult])

  useEffect(() => {
    if (encounterStartTimerRef.current !== null) {
      window.clearTimeout(encounterStartTimerRef.current)
      encounterStartTimerRef.current = null
    }

    if (
      !currentPost ||
      isCombatPhase ||
      isEncounterActive ||
      isPostCombatSummaryActive ||
      isCombatReturnActive
    ) {
      return
    }
    if (!shouldStartEncounterForPost(currentPost)) {
      return
    }
    if (
      isDragging ||
      swipeAnimation !== 'none' ||
      settleTimerRef.current !== null ||
      Math.abs(dragOffsetRef.current) > 0.5
    ) {
      return
    }

    const postId = currentPost.id
    encounterStartTimerRef.current = window.setTimeout(() => {
      encounterStartTimerRef.current = null
      if (visiblePostIdRef.current !== postId) {
        return
      }
      if (draggingRef.current || Math.abs(dragOffsetRef.current) > 0.5) {
        return
      }
      startEvilEncounter(postId, onCombatEntranceComplete)
    }, ENCOUNTER_START_DELAY_MS)
  }, [
    currentPost,
    isDragging,
    isCombatPhase,
    isEncounterActive,
    isPostCombatSummaryActive,
    isCombatReturnActive,
    onCombatEntranceComplete,
    shouldStartEncounterForPost,
    swipeAnimation,
    startEvilEncounter,
  ])

  useEffect(() => {
    if (!isInteractionLocked) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const preventDefault = (event: Event) => {
      event.preventDefault()
    }
    const preventKeyboardInput = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('wheel', preventDefault, { passive: false })
    window.addEventListener('touchmove', preventDefault, { passive: false })
    window.addEventListener('keydown', preventKeyboardInput)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('wheel', preventDefault)
      window.removeEventListener('touchmove', preventDefault)
      window.removeEventListener('keydown', preventKeyboardInput)
    }
  }, [isInteractionLocked])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (bestScore <= storedBestScore) {
      return
    }
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(bestScore))
  }, [bestScore, storedBestScore])

  useEffect(() => {
    if (!isEncounterActive) {
      return
    }

    const updateImpactOrigin = () => {
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }
      const bounds = viewport.getBoundingClientRect()
      setImpactFrame({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        width: bounds.width,
        height: bounds.height,
        left: bounds.left,
        top: bounds.top,
        right: Math.max(window.innerWidth - (bounds.left + bounds.width), 0),
        bottom: Math.max(window.innerHeight - (bounds.top + bounds.height), 0),
      })
    }

    updateImpactOrigin()
    window.addEventListener('resize', updateImpactOrigin)

    return () => {
      window.removeEventListener('resize', updateImpactOrigin)
    }
  }, [isEncounterActive])

  const handleToggleMenu = useCallback(() => {
    setIsMenuOpen((isOpen) => {
      if (!isOpen) {
        draggingRef.current = false
        setIsDragging(false)
        velocityRef.current = 0
        setSwipeAnimation('none')
        setOffset(0)
      }
      return !isOpen
    })
  }, [setOffset])

  const handleResumeGame = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const handleRestartSession = useCallback(() => {
    window.location.reload()
  }, [])

  const handleContinueAfterSummary = useCallback(() => {
    if (isCombatReturnActive) {
      return
    }
    setIsCombatReturnActive(true)
    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current)
    }
    returnTimerRef.current = window.setTimeout(() => {
      setIsCombatReturnActive(false)
      setPostCombatSummary(null)
      setSelectedCombatAction(null)
      onCombatSummaryContinue()
      returnTimerRef.current = null
    }, COMBAT_RETURN_MS)
  }, [isCombatReturnActive, onCombatSummaryContinue])

  const handleSelectCombatAction = useCallback(
    (action: CombatActionType) => {
      if (!canActInCombat) {
        return false
      }
      if (currentAttention < ACTION_COSTS[action]) {
        return false
      }
      if (action === 'exploit' && !canUseExploitAction) {
        return false
      }
      setSelectedCombatAction(action)
      return true
    },
    [canActInCombat, canUseExploitAction, currentAttention],
  )

  const handleCycleExploit = useCallback(() => {
    if (!isCombatPhase || !availableExploitIds.length) {
      return false
    }
    const currentIndex = availableExploitIds.indexOf(effectiveSelectedExploitId)
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % availableExploitIds.length
    setSelectedExploitId(availableExploitIds[nextIndex])
    return true
  }, [availableExploitIds, effectiveSelectedExploitId, isCombatPhase])
  const handleSelectExploitSlot = useCallback(
    (exploitId: string) => {
      if (!canActInCombat || currentAttention < ACTION_COSTS.exploit) {
        return false
      }
      setSelectedExploitId(exploitId)
      setSelectedCombatAction('exploit')
      return true
    },
    [canActInCombat, currentAttention],
  )

  const handleEndTurn = useCallback(() => {
    if (!canCommitSelectedAction || !selectedCombatAction) {
      return false
    }
    const sent =
      selectedCombatAction === 'exploit'
        ? onCombatAction('exploit', effectiveSelectedExploitId || undefined)
        : onCombatAction(selectedCombatAction)
    if (sent) {
      setSelectedCombatAction(null)
    }
    return sent
  }, [canCommitSelectedAction, effectiveSelectedExploitId, onCombatAction, selectedCombatAction])
  const handleActionHoverStart = useCallback(
    (detail: ActionDetail | null, event: ReactMouseEvent<HTMLElement>) => {
      if (!detail) {
        return
      }
      setHoverCloud({
        x: event.clientX,
        y: event.clientY,
        actionId: detail.id,
      })
    },
    [],
  )
  const handleHistoryHoverStart = useCallback(
    (index: number, event: ReactMouseEvent<HTMLElement>) => {
      setHoveredHistoryIndex(index)
      setHoverCloud({
        x: event.clientX,
        y: event.clientY,
        historyIndex: index,
      })
    },
    [],
  )
  const handleHoverMove = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    setHoverCloud((previous) => (previous ? { ...previous, x: event.clientX, y: event.clientY } : previous))
  }, [])
  const handleHoverClear = useCallback(() => {
    setHoverCloud(null)
  }, [])

  useEffect(() => {
    if (
      !isBattleMockupActive ||
      !isCombatPhase ||
      isPostCombatSummaryActive ||
      isReturnTransitionActive ||
      isInteractionLocked
    ) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const eventTarget = event.target as HTMLElement | null
      if (
        eventTarget &&
        (eventTarget.tagName === 'INPUT' ||
          eventTarget.tagName === 'TEXTAREA' ||
          eventTarget.tagName === 'SELECT' ||
          eventTarget.isContentEditable)
      ) {
        return
      }

      const key = event.key.toLowerCase()
      let handled = false

      if (key === 'q') {
        handled = handleSelectCombatAction('attack')
      } else if (key === 'w') {
        handled = handleSelectCombatAction('block')
      } else if (key === 'e') {
        handled = handleSelectCombatAction('parry')
      } else if (key === 'r') {
        handled = effectiveSelectedExploitId ? handleSelectExploitSlot(effectiveSelectedExploitId) : false
      } else if (key === 't') {
        handled = handleCycleExploit()
      } else if (key === ' ' || key === 'spacebar') {
        handled = handleEndTurn()
      }

      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [
    handleCycleExploit,
    handleEndTurn,
    handleSelectExploitSlot,
    handleSelectCombatAction,
    isBattleMockupActive,
    isCombatPhase,
    isInteractionLocked,
    isPostCombatSummaryActive,
    isReturnTransitionActive,
    effectiveSelectedExploitId,
  ])

  const finalizeSwipe = useCallback(() => {
    if (!connected || isFeedInteractionLocked) {
      setOffset(0)
      return
    }
    if (!nextPost) {
      setOffset(0)
      return
    }

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }

    const cardHeight = viewportRef.current?.clientHeight ?? 1
    setSwipeAnimation('snap-forward')
    setOffset(-cardHeight)
    settleTimerRef.current = window.setTimeout(() => {
      setSwipeAnimation('none')
      onAdvance()
      setOffset(0)
      settleTimerRef.current = null
    }, 220)
  }, [connected, isFeedInteractionLocked, nextPost, onAdvance, setOffset])

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!currentPost || !connected || isFeedInteractionLocked || isCurrentPostCombatTrigger) {
      return
    }
    const eventTarget = event.target as HTMLElement
    if (eventTarget.closest('button')) {
      return
    }
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }

    draggingRef.current = true
    setIsDragging(true)
    setSwipeAnimation('none')
    activePointerRef.current = event.pointerId
    startYRef.current = event.clientY
    lastPointerYRef.current = event.clientY
    lastPointerTimeRef.current = performance.now()
    velocityRef.current = 0
    setOffset(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!draggingRef.current || activePointerRef.current !== event.pointerId) {
      return
    }

    const startY = startYRef.current
    if (startY === null) {
      return
    }

    const now = performance.now()
    const dt = Math.max(now - lastPointerTimeRef.current, 1)
    const stepDistance = event.clientY - lastPointerYRef.current
    const instantVelocity = stepDistance / dt
    velocityRef.current = velocityRef.current * 0.72 + instantVelocity * 0.28
    lastPointerYRef.current = event.clientY
    lastPointerTimeRef.current = now

    const deltaY = event.clientY - startY
    const cardHeight = viewportRef.current?.clientHeight ?? 1
    const upwardDistance = Math.max(0, -deltaY)
    const softLimit = cardHeight * 0.85
    const effectiveDistance =
      upwardDistance <= softLimit
        ? upwardDistance
        : softLimit + (upwardDistance - softLimit) * 0.28
    setOffset(-Math.min(effectiveDistance, cardHeight))
  }

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!draggingRef.current || activePointerRef.current !== event.pointerId) {
      return
    }

    draggingRef.current = false
    setIsDragging(false)
    activePointerRef.current = null
    startYRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const cardHeight = viewportRef.current?.clientHeight ?? 1
    const advancedByDistance = dragOffsetRef.current <= -(cardHeight * 0.22)
    const advancedByVelocity = velocityRef.current <= -0.55
    velocityRef.current = 0
    if (advancedByDistance || advancedByVelocity) {
      finalizeSwipe()
      return
    }

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    setSwipeAnimation('snap-back')
    setOffset(0)
    settleTimerRef.current = window.setTimeout(() => {
      setSwipeAnimation('none')
      settleTimerRef.current = null
    }, 180)
  }

  const handlePointerCancel: PointerEventHandler<HTMLDivElement> = (event) => {
    if (activePointerRef.current !== event.pointerId) {
      return
    }
    draggingRef.current = false
    setIsDragging(false)
    activePointerRef.current = null
    startYRef.current = null
    velocityRef.current = 0
    setSwipeAnimation('none')
    setOffset(0)
  }

  const transition =
    isDragging
      ? 'none'
      : swipeAnimation === 'snap-forward'
        ? 'transform 220ms linear'
        : swipeAnimation === 'snap-back'
          ? 'transform 180ms linear'
          : 'none'

  const currentStyle: CSSProperties = {
    transform: `translate3d(0, ${dragOffset}px, 0)`,
    transition,
  }

  const nextStyle: CSSProperties = {
    transform: `translate3d(0, calc(100% + ${dragOffset}px), 0)`,
    transition,
  }

  const feedScreenClassName = [
    'screen',
    'feed-screen',
    isEncounterActive ? 'feed-screen-encounter' : '',
    isEncounterLockPhase ? 'feed-screen-lock-phase' : '',
    isBattleMockupActive && !isEncounterActive ? 'feed-screen-battle-mockup' : '',
    isReturnTransitionActive ? 'feed-screen-returning' : '',
    isMenuOpen ? 'feed-screen-menu-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const encounterBurstStyle: CSSProperties = {
    '--impact-x': `${impactFrame.x}px`,
    '--impact-y': `${impactFrame.y}px`,
    '--impact-w': `${impactFrame.width}px`,
    '--impact-h': `${impactFrame.height}px`,
    '--impact-left': `${impactFrame.left}px`,
    '--impact-top': `${impactFrame.top}px`,
    '--impact-right': `${impactFrame.right}px`,
    '--impact-bottom': `${impactFrame.bottom}px`,
  } as CSSProperties

  return (
    <main className={feedScreenClassName}>
      <div className="feed-shell">
        <div className="walking-bg" aria-hidden />
        <div className="encounter-chaos-layer" aria-hidden />
        {isEncounterActive ? (
          <div className="encounter-laser-burst" style={encounterBurstStyle} aria-hidden>
            <div className="encounter-chaos-lines encounter-chaos-lines-a" />
            <div className="encounter-chaos-lines encounter-chaos-lines-b" />
            <div className="encounter-impact-skull">☠</div>
          </div>
        ) : null}

        <header className="feed-top-bar">
          <button
            type="button"
            className="menu-toggle"
            onClick={handleToggleMenu}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            ☰
          </button>
          {!isBattleMockupActive ? (
            <div className="score-ribbon">
              <span>SCORE {score}</span>
              <span>BEST {bestScore}</span>
            </div>
          ) : null}
        </header>

        <div className="phone-rig-anchor">
          <div className="phone-rig">
            <section className="phone-frame">
              <header className="phone-camera-rail" aria-hidden="true">
                <span className="phone-camera-module">
                  <span className="phone-camera-lens" />
                </span>
              </header>

            <div
              className="phone-feed phone-feed-viewport"
              ref={viewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            >
              {!currentPost ? <p className="feed-hint">Connecting to the feed…</p> : null}

              {currentPost ? (
                <div className="feed-page feed-page-current" style={currentStyle}>
                  {currentPost.type === 'evil' ? (
                    <EvilPost post={currentPost} isActive />
                  ) : (
                    <Post post={currentPost} />
                  )}
                </div>
              ) : null}

              {nextPost ? (
                <div className="feed-page feed-page-next" style={nextStyle}>
                  {nextPost.type === 'evil' ? (
                    <EvilPost post={nextPost} isActive={false} />
                  ) : (
                    <Post post={nextPost} />
                  )}
                </div>
              ) : null}
            </div>

              <footer className="phone-home-nav" aria-hidden="true">
                <span className="phone-home-button">
                  <span className="phone-home-glyph" />
                </span>
              </footer>
            </section>
          </div>
        </div>

        {isBattleMockupActive ? (
            <section
              className={`battle-mockup ${
                isEncounterActive
                  ? 'battle-mockup-transition'
                  : isReturnTransitionActive
                    ? 'battle-mockup-return'
                    : 'battle-mockup-live'
            } ${latestCombatTurn?.enemyDamage ? 'battle-mockup-player-hit' : ''} ${
              latestCombatTurn?.playerDamage ? 'battle-mockup-enemy-hit' : ''
            }`}
            style={encounterBurstStyle}
            aria-label="Battle interface mockup"
          >
            <header className="battle-hud">
              <div className="battle-health">
                <div className="battle-health-meta">
                  <span className="battle-label">
                    ENEMY //{' '}
                    {(
                      isPostCombatSummaryActive
                        ? postCombatSummary?.enemyName
                        : combatEnemy?.name
                    )?.toUpperCase() ?? 'SIGNAL_REAPER'}
                  </span>
                  <span className="battle-enemy-at">
                    ENEMY AT {projectedEnemyHp}/{combatEnemyMaxHp}
                  </span>
                </div>
            <div className="battle-health-track" role="img" aria-label="Enemy health">
                  <span
                    className="battle-health-fill"
                    style={{ width: `${isPostCombatSummaryActive ? 0 : combatEnemyHpPercent}%` }}
                  />
                  {selectedCombatAction && enemyPreviewPercent > 0 ? (
                    <span
                      className="battle-health-preview"
                      style={{
                        width: `${enemyPreviewPercent}%`,
                        left: `${enemyPreviewOffsetPercent}%`,
                      }}
                    />
                  ) : null}
            </div>
            {latestCombatTurn?.playerDamage ? (
              <span key={`enemy-dmg-${combatLog.length}`} className="damage-number damage-number-enemy">
                -{latestCombatTurn.playerDamage}
              </span>
            ) : null}
            {didEnemyBlock ? <span className="battle-state-pop battle-state-pop-enemy">BLOCK</span> : null}
            {didEnemyParry ? <span className="battle-state-pop battle-state-pop-enemy">PARRY</span> : null}
            {!isPostCombatSummaryActive ? (
              <>
                    <p className="battle-enemy-preview-text">
                      On commit: -{selectedActionDamageText} HP
                    </p>
                    <p className="battle-enemy-preview-text">
                      Enemy action:{' '}
                      {enemyVisibleAction
                        ? `${enemyVisibleAction.label} (${enemyVisibleAction.value} AT, cost ${enemyVisibleAction.cost})`
                        : isEnemyThinkingPhase
                          ? 'thinking...'
                          : 'pending'}
                    </p>
                  </>
                ) : null}
              </div>
            </header>

            <ProfileCard
                className="battle-profile-card"
                name=""
                title=""
                handle=""
                status=""
                contactText=""
                avatarUrl="../../public/top_b.png"
                showUserInfo={false}
                enableTilt={true}
                enableMobileTilt={false}
                onContactClick={() => console.log('Contact clicked')}
                behindGlowColor="rgba(125, 190, 255, 0.67)"
                behindGlowEnabled={false}
                innerGradient="linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)"
            />
            {latestCombatTurn?.enemyDamage ? (
              <span key={`player-dmg-${combatLog.length}`} className="damage-number damage-number-player">
                -{latestCombatTurn.enemyDamage}
              </span>
            ) : null}
            {didPlayerBlock ? <span className="battle-state-pop battle-state-pop-player">BLOCK</span> : null}
            {didPlayerParry ? <span className="battle-state-pop battle-state-pop-player">PARRY</span> : null}
            {!isPostCombatSummaryActive && enemyStatusLabel ? (
              <div className="battle-enemy-state" aria-label="Current selected combat stance">
                Stance: {enemyStatusLabel}
              </div>
            ) : null}

            <aside
              className={`battle-history ${isPostCombatSummaryActive ? 'battle-history-summary' : ''}`}
              aria-label="Action history"
            >
              {isPostCombatSummaryActive && postCombatSummary ? (
                <div className="battle-summary-panel">
                  <p className="battle-summary-title">
                    {postCombatSummary.result === 'lose' ? 'DEFEAT' : 'VICTORY'}
                  </p>
                  <p className="battle-summary-subtitle">COMBAT REPORT</p>
                  <p>TARGET // {postCombatSummary.enemyName.toUpperCase()}</p>
                  <p>TURNS // {postCombatSummary.turns}</p>
                  <p>DAMAGE DEALT // {postCombatSummary.totalDamageDealt}</p>
                  <p>DAMAGE TAKEN // {postCombatSummary.totalDamageTaken}</p>
                  <p>
                    REWARDS //{' '}
                    {postCombatSummary.rewards.length > 0
                      ? postCombatSummary.rewards.map((reward) => reward.toUpperCase()).join(', ')
                      : 'NONE'}
                  </p>
                </div>
              ) : (
                <div className="battle-history-content">
                  <p className="battle-history-title">Action History</p>
                  <div className="battle-history-list">
                    {combatHistory.length === 0 ? (
                      <p className="battle-history-empty">No turns yet.</p>
                    ) : (
                      combatHistory.map((turn, index) => (
                        <button
                          key={`history-${combatHistory.length}-${index}-${turn.playerAction}-${turn.enemyAction}`}
                          type="button"
                          className={`battle-history-item ${hoveredHistoryIndex === index ? 'battle-history-item-active' : ''}`}
                          onMouseEnter={(event) => handleHistoryHoverStart(index, event)}
                          onMouseMove={handleHoverMove}
                          onMouseLeave={handleHoverClear}
                          onFocus={(event) => handleHistoryHoverStart(index, event)}
                          onBlur={handleHoverClear}
                        >
                          <span className="battle-history-item-turn">T{combatLog.length - index}</span>
                          <span className="battle-history-item-text">
                            {turn.playerAction} vs {turn.enemyAction}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </aside>

            <footer className="battle-actions">
              {isPostCombatSummaryActive ? (
                <button
                  type="button"
                  className="battle-summary-continue"
                  onClick={handleContinueAfterSummary}
                  disabled={isCombatReturnActive}
                >
                  {isCombatReturnActive ? 'Returning...' : 'Continue to Feed'}
                </button>
              ) : (
                <>
                  <div className="battle-action-groups">
                    <p className="battle-action-section-title">Exploits</p>
                    <div className="battle-exploit-grid" aria-label="Exploit actions">
                      {exploitSlots.map((slot, index) => {
                        const isLocked = slot.locked
                        const isSelected =
                          !isLocked && selectedCombatAction === 'exploit' && effectiveSelectedExploitId === slot.id
                        const exploitDisabled =
                          isLocked ||
                          !canActInCombat ||
                          currentAttention < ACTION_COSTS.exploit ||
                          (slot.id ? (disabledExploits[slot.id] ?? 0) > 0 : true)
                        const keybind = index === 0 ? '[R]' : index === 1 ? '[T]' : ''
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            className={`battle-action-button battle-action-button-exploit ${
                              isSelected ? 'battle-action-button-selected' : ''
                            } ${isLocked ? 'battle-action-button-locked' : ''}`}
                            onClick={() => {
                              if (!isLocked) {
                                handleSelectExploitSlot(slot.id)
                              }
                            }}
                            disabled={exploitDisabled}
                            aria-pressed={isSelected}
                            aria-label={isLocked ? `${slot.name} locked` : `${slot.name} exploit`}
                            onMouseEnter={(event) =>
                              handleActionHoverStart(battleActionDetails[slot.id] ?? null, event)
                            }
                            onMouseMove={handleHoverMove}
                            onMouseLeave={handleHoverClear}
                            onFocus={(event) =>
                              handleActionHoverStart(battleActionDetails[slot.id] ?? null, event)
                            }
                            onBlur={handleHoverClear}
                          >
                            <span className="battle-action-icon-wrap" aria-hidden>
                              {isLocked ? (
                                <span className="battle-lock-icon">🔒</span>
                              ) : (
                                <img
                                  src={ACTION_ICONS.exploit}
                                  alt=""
                                  className="battle-action-icon"
                                  draggable={false}
                                />
                              )}
                            </span>
                            <span className="battle-action-label">
                              {slot.name}
                              {keybind ? <span className="battle-action-keybind">{keybind}</span> : null}
                            </span>
                            <span className="battle-action-cost">
                              {isLocked ? 'LOCKED' : `${ACTION_COSTS.exploit} AT`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="battle-action-section-title battle-action-section-title-secondary">
                      Basic Actions
                    </p>
                    <div className="battle-basic-actions" aria-label="Basic actions">
                      {(['attack', 'block', 'parry'] as CombatActionType[]).map((action) => {
                        const disabled = !canActInCombat || currentAttention < ACTION_COSTS[action]
                        return (
                          <button
                            key={action}
                            type="button"
                            className={`battle-action-button battle-action-button-basic ${
                              selectedCombatAction === action ? 'battle-action-button-selected' : ''
                            }`}
                            onClick={() => handleSelectCombatAction(action)}
                            disabled={disabled}
                            aria-pressed={selectedCombatAction === action}
                            aria-keyshortcuts={
                              action === 'attack' ? 'Q' : action === 'block' ? 'W' : 'E'
                            }
                            onMouseEnter={(event) => handleActionHoverStart(battleActionDetails[action], event)}
                            onMouseMove={handleHoverMove}
                            onMouseLeave={handleHoverClear}
                            onFocus={(event) => handleActionHoverStart(battleActionDetails[action], event)}
                            onBlur={handleHoverClear}
                          >
                            <span className="battle-action-icon-wrap" aria-hidden>
                              <img src={ACTION_ICONS[action]} alt="" className="battle-action-icon" draggable={false} />
                            </span>
                            <span className="battle-action-label">
                              {ACTION_LABELS[action]}
                              <span className="battle-action-keybind">
                                [{action === 'attack' ? 'Q' : action === 'block' ? 'W' : 'E'}]
                              </span>
                            </span>
                            <span className="battle-action-cost">{ACTION_COSTS[action]} AT</span>
                          </button>
                        )
                      })}

                    </div>
                  </div>
                  <button
                      type="button"
                      className="battle-end-turn"
                      disabled={!canCommitSelectedAction}
                      onClick={handleEndTurn}
                      aria-keyshortcuts="Space"
                  >
                    FINISH TURN
                    [SPACE]
                  </button>
                </>

              )}

            </footer>
            {!isPostCombatSummaryActive ? (
              <p className="battle-turn-phase">
                {isEnemyThinkingPhase
                  ? 'Enemy is thinking...'
                  : isEnemyRevealPhase
                    ? 'Enemy action revealed'
                    : isResolvingPhase
                      ? 'Resolving actions...'
                      : 'Select action and End Turn'}
              </p>
            ) : null}
            {!isPostCombatSummaryActive ? (
              <>
                <div className="battle-attention-panel" aria-label="Player attention">
                  <div className="battle-attention-title-row">
                    <span className="battle-attention-title">AT</span>
                    <span className="battle-attention-value">
                      {projectedAttention}/{maxAttention}
                    </span>
                  </div>
                  <div className="battle-player-stats">
                    <span>DMG {selectedActionDamageText}</span>
                    <span>NOISE {currentNoise}</span>
                    <span>SPENT {latestCombatTurn?.playerATSpent ?? 0}</span>
                    <span>REFUND {latestCombatTurn?.playerATRefund ?? 0}</span>
                  </div>
                  <div
                    className="battle-attention-track"
                    role="img"
                    aria-label={`Attention ${projectedAttention} of ${maxAttention}`}
                  >
                    <span
                      className="battle-attention-fill"
                      style={{ width: `${attentionFillPercent}%` }}
                    />
                    {selectedCombatAction && attentionPreviewPercent > 0 ? (
                      <span
                        className="battle-attention-preview"
                        style={{
                          width: `${attentionPreviewPercent}%`,
                          left: `${attentionPreviewOffsetPercent}%`,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
            {!isPostCombatSummaryActive && hoverCloud && (isActionCloudVisible || isHistoryCloudVisible) ? (
              <div className="battle-hover-cloud" style={hoverCloudStyle} aria-live="polite">
                {isActionCloudVisible && hoveredCloudActionDetail ? (
                  <>
                    <p className="battle-hover-cloud-title">
                      {hoveredCloudActionDetail.kind === 'exploit' ? 'Exploit' : 'Basic'} •{' '}
                      {hoveredCloudActionDetail.name}
                    </p>
                    <p>Cost: {hoveredCloudActionDetail.costLabel}</p>
                    <p>Damage: {hoveredCloudActionDetail.damageLabel}</p>
                    <p>Effect: {hoveredCloudActionDetail.effect}</p>
                  </>
                ) : null}
                {isHistoryCloudVisible && hoveredCloudHistoryTurn ? (
                  <>
                    <p className="battle-hover-cloud-title">
                      {hoveredCloudHistoryTurn.playerAction} vs {hoveredCloudHistoryTurn.enemyAction}
                    </p>
                    <p>
                      Damage: dealt {hoveredCloudHistoryTurn.playerDamage}, taken{' '}
                      {hoveredCloudHistoryTurn.enemyDamage}
                    </p>
                    <p>
                      Costs: you {hoveredCloudHistoryTurn.playerActionCost ?? 0} AT, enemy{' '}
                      {hoveredCloudHistoryTurn.enemyActionCost ?? 0} AT
                    </p>
                    <p>
                      Effects:{' '}
                      {hoveredCloudHistoryTurn.effects.length
                        ? hoveredCloudHistoryTurn.effects.map((effect) => effect.label).join(', ')
                        : 'None'}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
        {isMenuOpen ? (
          <section className="pause-menu-overlay" role="dialog" aria-modal="true" aria-label="Game menu">
            <div className="pause-menu-panel">
              <p className="pause-menu-title">PAUSED</p>
              <p className="pause-menu-meta">SESSION {sessionId ? sessionId.slice(0, 8) : 'pending'}</p>
              <button type="button" onClick={handleResumeGame}>
                Resume
              </button>
              <button type="button" onClick={handleRestartSession}>
                Restart Session
              </button>
              <button type="button" onClick={handleResumeGame}>
                Close Menu
              </button>
            </div>
          </section>
        ) : null}
      </div>
      {isInputLocked ? <div className="input-lock-shield" aria-hidden /> : null}
    </main>
  )
}

export default FeedScreen
