import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
type ChatBubbleSide = 'left' | 'right'
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
interface CombatSummaryData {
  result: 'win' | 'lose'
  enemyName: string
  turns: number
  totalDamageDealt: number
  totalDamageTaken: number
  rewards: string[]
}
interface CombatChatEntry {
  id: string
  side: ChatBubbleSide
  speaker: string
  text: string
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
  const equippedExploits = (Array.isArray(serverState?.exploits)
    ? serverState.exploits
    : []) as Array<PlayerExploit | null>
  const disabledExploits = (combat?.disabledExploits ?? {}) as Record<string, number>
  const availableExploitIds = equippedExploits
    .filter((exploit): exploit is PlayerExploit => Boolean(exploit?.id))
    .map((exploit) => exploit.id)
  const effectiveSelectedExploitId = availableExploitIds.includes(selectedExploitId)
    ? selectedExploitId
    : (availableExploitIds[0] ?? '')
  const selectedExploit =
    equippedExploits.find((exploit) => exploit?.id === effectiveSelectedExploitId) ?? null
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
    Boolean(selectedExploit?.id) &&
    (selectedExploit?.id ? (disabledExploits[selectedExploit.id] ?? 0) === 0 : false)
  const hasEnoughATForSelectedAction =
    selectedCombatAction !== null ? currentAttention >= ACTION_COSTS[selectedCombatAction] : false
  const canCommitSelectedAction =
    canActInCombat &&
    Boolean(selectedCombatAction) &&
    hasEnoughATForSelectedAction &&
    (selectedCombatAction === 'exploit' ? canUseExploitAction : true)
  const selectedExploitDamageRange = useMemo(() => {
    const exploitId = selectedExploit?.id
    if (!exploitId) {
      return { min: 0, max: 0 }
    }
    if (exploitId === 'focused_reply') {
      const value = 11 + currentNoise
      return { min: value, max: value }
    }
    if (exploitId === 'growth_hack') {
      return { min: 8 + currentNoise, max: 11 + currentNoise }
    }
    if (exploitId === 'volatility_engine') {
      const base = 6 + currentNoise
      return {
        min: base,
        max: base + 7,
      }
    }
    if (exploitId === 'bait_loop') {
      const value = 10 + currentNoise
      return { min: value, max: value }
    }
    const fallback = 9 + currentNoise
    return { min: fallback, max: fallback }
  }, [currentNoise, selectedExploit?.id])
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
  const selectedActionDamageText =
    selectedActionDamageRange.max <= 0
      ? '0'
      : selectedActionDamageRange.min === selectedActionDamageRange.max
        ? `${selectedActionDamageRange.max}`
        : `${selectedActionDamageRange.min}-${selectedActionDamageRange.max}`
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
  const combatChatEntries = useMemo<CombatChatEntry[]>(() => {
    if (combatLog.length === 0) {
      return [
        { id: 'intro-1', side: 'left', speaker: 'SYS', text: 'hostile channel stabilized.' },
        { id: 'intro-2', side: 'right', speaker: 'YOU', text: 'ready to engage.' },
        { id: 'intro-3', side: 'left', speaker: 'VOID', text: 'I can see you scrolling.' },
        { id: 'intro-4', side: 'right', speaker: 'YOU', text: 'prove it.' },
      ]
    }

    const turns = combatLog.slice(-4)
    const startIndex = Math.max(0, combatLog.length - turns.length)

    return turns.flatMap((turn, index) => {
      const turnNumber = startIndex + index + 1
      const turnId = `turn-${turnNumber}-${turn.playerAction}-${turn.enemyAction}`
      return [
        {
          id: `${turnId}-enemy`,
          side: 'left',
          speaker: (combatEnemy?.name ?? 'Enemy').toUpperCase(),
          text: `${turn.enemyAction} (${turn.enemyActionValue ?? 0} AT, cost ${turn.enemyActionCost ?? 0})`,
        },
        {
          id: `${turnId}-player`,
          side: 'right',
          speaker: 'YOU',
          text: `${turn.playerAction} (${turn.playerActionValue ?? 0} AT, cost ${turn.playerActionCost ?? 0})`,
        },
      ]
    })
  }, [combatEnemy?.name, combatLog])
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

  const handleEndTurn = useCallback(() => {
    if (!canCommitSelectedAction || !selectedCombatAction) {
      return false
    }
    const sent =
      selectedCombatAction === 'exploit'
        ? onCombatAction('exploit', selectedExploit?.id)
        : onCombatAction(selectedCombatAction)
    if (sent) {
      setSelectedCombatAction(null)
    }
    return sent
  }, [canCommitSelectedAction, onCombatAction, selectedCombatAction, selectedExploit?.id])

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
        handled = handleSelectCombatAction('exploit')
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
    handleSelectCombatAction,
    isBattleMockupActive,
    isCombatPhase,
    isInteractionLocked,
    isPostCombatSummaryActive,
    isReturnTransitionActive,
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
              className={`battle-chat ${isPostCombatSummaryActive ? 'battle-chat-summary' : ''}`}
              aria-label="Combat chat"
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
                <div className="battle-chat-thread">
                  {isEnemyThinkingPhase ? (
                    <article className="battle-chat-bubble battle-chat-bubble-left battle-chat-bubble-system">
                      <p className="battle-chat-speaker">{(combatEnemy?.name ?? 'Enemy').toUpperCase()}</p>
                      <p className="battle-chat-text">Enemy is thinking...</p>
                    </article>
                  ) : null}
                  {isEnemyRevealPhase && enemyVisibleAction ? (
                    <article className="battle-chat-bubble battle-chat-bubble-left battle-chat-bubble-system">
                      <p className="battle-chat-speaker">{(combatEnemy?.name ?? 'Enemy').toUpperCase()}</p>
                      <p className="battle-chat-text">
                        chooses {enemyVisibleAction.label} ({enemyVisibleAction.value} AT)
                      </p>
                    </article>
                  ) : null}
                  {isResolvingPhase ? (
                    <article className="battle-chat-bubble battle-chat-bubble-right battle-chat-bubble-system">
                      <p className="battle-chat-speaker">SYS</p>
                      <p className="battle-chat-text">Resolving actions...</p>
                    </article>
                  ) : null}
                  {combatChatEntries.map((entry, index) => (
                    <article
                      key={entry.id}
                      className={`battle-chat-bubble battle-chat-bubble-${entry.side}`}
                      style={{ '--chat-pop-delay': `${index * 60}ms` } as CSSProperties}
                    >
                      <p className="battle-chat-speaker">{entry.speaker}</p>
                      <p className="battle-chat-text">{entry.text}</p>
                    </article>
                  ))}
                  {latestCombatTurn?.effects?.slice(-6).map((effect, index) => (
                    <article
                      key={`effect-${effect.kind}-${effect.label}-${index}`}
                      className={`battle-chat-bubble ${
                        effect.target === 'enemy' ? 'battle-chat-bubble-right' : 'battle-chat-bubble-left'
                      } battle-chat-bubble-system`}
                      style={
                        {
                          '--chat-pop-delay': `${(combatChatEntries.length + index) * 45}ms`,
                        } as CSSProperties
                      }
                    >
                      <p className="battle-chat-speaker">RESOLVE</p>
                      <p className="battle-chat-text">{effect.label}</p>
                    </article>
                  ))}
                  {latestCombatTurn ? (
                    <article
                      className="battle-chat-bubble battle-chat-bubble-left battle-chat-bubble-system"
                      style={{ '--chat-pop-delay': `${combatChatEntries.length * 60}ms` } as CSSProperties}
                    >
                      <p className="battle-chat-speaker">SYS</p>
                      <p className="battle-chat-text">
                        hit Δ enemy -{latestCombatTurn.playerDamage} / you -{latestCombatTurn.enemyDamage}
                      </p>
                    </article>
                  ) : null}
                  {latestCombatResult === 'win' ? (
                    <article className="battle-chat-bubble battle-chat-bubble-right battle-chat-bubble-system">
                      <p className="battle-chat-speaker">SYS</p>
                      <p className="battle-chat-text">target neutralized.</p>
                    </article>
                  ) : null}
                  {latestCombatResult === 'lose' ? (
                    <article className="battle-chat-bubble battle-chat-bubble-left battle-chat-bubble-system">
                      <p className="battle-chat-speaker">SYS</p>
                      <p className="battle-chat-text">attention collapse detected.</p>
                    </article>
                  ) : null}
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
                  {(['attack', 'block', 'parry', 'exploit'] as CombatActionType[]).map((action) => {
                    const disabled =
                      action === 'exploit'
                        ? !canActInCombat || !canUseExploitAction || currentAttention < ACTION_COSTS[action]
                        : !canActInCombat || currentAttention < ACTION_COSTS[action]
                    return (
                      <button
                        key={action}
                        type="button"
                        className={`battle-action-button ${
                          selectedCombatAction === action ? 'battle-action-button-selected' : ''
                        }`}
                        onClick={() => handleSelectCombatAction(action)}
                        disabled={disabled}
                        aria-pressed={selectedCombatAction === action}
                        aria-keyshortcuts={
                          action === 'attack'
                            ? 'Q'
                            : action === 'block'
                              ? 'W'
                              : action === 'parry'
                                ? 'E'
                                : 'R'
                        }
                      >
                        <span className="battle-action-icon-wrap" aria-hidden>
                          <img
                            src={ACTION_ICONS[action]}
                            alt=""
                            className="battle-action-icon"
                            draggable={false}
                          />
                        </span>
                        <span className="battle-action-label">
                          {ACTION_LABELS[action]}
                          <span className="battle-action-keybind">
                            [{action === 'attack' ? 'Q' : action === 'block' ? 'W' : action === 'parry' ? 'E' : 'R'}]
                          </span>
                        </span>
                        <span className="battle-action-cost">{ACTION_COSTS[action]} AT</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className="battle-end-turn"
                    disabled={!canCommitSelectedAction}
                    onClick={handleEndTurn}
                    aria-keyshortcuts="Space"
                  >
                    End Turn [Space]
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
                    <span className="battle-attention-title">Attention (AT)</span>
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
                <button
                  type="button"
                  className="battle-exploit-picker"
                  disabled={!isCombatPhase}
                  onClick={handleCycleExploit}
                  aria-keyshortcuts="T"
                >
                  Exploit [T]: {selectedExploit?.name ?? 'Select Exploit'}
                </button>
              </>
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
