import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEventHandler,
} from 'react'
import EvilPost from '../components/EvilPost'
import Post from '../components/Post'
import type { FeedPost, ServerState, SocketStatus } from '../store/gameReducer'

interface FeedScreenProps {
  sessionId: string | null
  serverState: ServerState | null
  socketStatus: SocketStatus
  posts: FeedPost[]
  score: number
  onScroll: () => boolean
  onAdvance: () => void
}

type SwipeAnimation = 'none' | 'snap-forward' | 'snap-back'
const ENCOUNTER_LOCK_MS = 2000
const ENCOUNTER_TOTAL_MS = 2860
const RETURN_TO_FEED_MS = 760

function FeedScreen({
  sessionId,
  serverState,
  socketStatus,
  posts,
  score,
  onScroll,
  onAdvance,
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
  const returnToFeedTimerRef = useRef<number | null>(null)
  const lastTriggeredEvilPostIdRef = useRef<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [swipeAnimation, setSwipeAnimation] = useState<SwipeAnimation>('none')
  const [isEncounterActive, setIsEncounterActive] = useState(false)
  const [isEncounterLockPhase, setIsEncounterLockPhase] = useState(false)
  const [isBattleMockupActive, setIsBattleMockupActive] = useState(false)
  const [isReturningToFeed, setIsReturningToFeed] = useState(false)
  const [isInputLocked, setIsInputLocked] = useState(false)
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
    if (returnToFeedTimerRef.current !== null) {
      window.clearTimeout(returnToFeedTimerRef.current)
      returnToFeedTimerRef.current = null
    }
  }, [])

  const startEvilEncounter = useCallback(
    (postId: string) => {
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

      setIsEncounterActive(true)
      setIsEncounterLockPhase(true)
      setIsBattleMockupActive(true)
      setIsReturningToFeed(false)
      setIsInputLocked(true)

      lockTimerRef.current = window.setTimeout(() => {
        setIsEncounterLockPhase(false)
        lockTimerRef.current = null
      }, ENCOUNTER_LOCK_MS)

      encounterTimerRef.current = window.setTimeout(() => {
        setIsEncounterActive(false)
        setIsEncounterLockPhase(false)
        setIsInputLocked(false)
        encounterTimerRef.current = null
      }, ENCOUNTER_TOTAL_MS)
    },
    [clearEncounterTimers, setOffset],
  )

  useEffect(() => {
    const diff = posts.length - previousLengthRef.current
    if (diff > 0) {
      pendingPostsRef.current = Math.max(0, pendingPostsRef.current - diff)
    }
    previousLengthRef.current = posts.length
  }, [posts.length])

  useEffect(() => {
    if (!connected) {
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
  }, [connected, onScroll, posts.length])

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current)
      }
      clearEncounterTimers()
    },
    [clearEncounterTimers],
  )

  useEffect(() => {
    if (!isInputLocked) {
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
  }, [isInputLocked])

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

  const handleReturnToFeed = useCallback(() => {
    if (!isBattleMockupActive || isEncounterActive || isReturningToFeed) {
      return
    }

    setIsReturningToFeed(true)
    setIsInputLocked(true)

    returnToFeedTimerRef.current = window.setTimeout(() => {
      setIsBattleMockupActive(false)
      setIsReturningToFeed(false)
      setIsInputLocked(false)
      returnToFeedTimerRef.current = null
    }, RETURN_TO_FEED_MS)
  }, [isBattleMockupActive, isEncounterActive, isReturningToFeed])

  const finalizeSwipe = useCallback(() => {
    if (!connected || isInputLocked) {
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
    const nextPostToTrigger = nextPost.type === 'evil' ? nextPost : null
    setSwipeAnimation('snap-forward')
    setOffset(-cardHeight)
    settleTimerRef.current = window.setTimeout(() => {
      setSwipeAnimation('none')
      onAdvance()
      setOffset(0)
      if (nextPostToTrigger) {
        startEvilEncounter(nextPostToTrigger.id)
      }
      settleTimerRef.current = null
    }, 220)
  }, [connected, isInputLocked, nextPost, onAdvance, setOffset, startEvilEncounter])

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!currentPost || !connected || isInputLocked) {
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
    isReturningToFeed ? 'feed-screen-returning' : '',
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

        <div className="phone-rig">
          <section className="phone-frame">
            <header className="phone-status">
              <span>THE FEED</span>
              <span>SCORE {score}</span>
              <span>{socketStatus}</span>
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
                    <EvilPost post={currentPost} />
                  ) : (
                    <Post post={currentPost} />
                  )}
                </div>
              ) : null}

              {nextPost ? (
                <div className="feed-page feed-page-next" style={nextStyle}>
                  {nextPost.type === 'evil' ? <EvilPost post={nextPost} /> : <Post post={nextPost} />}
                </div>
              ) : null}
            </div>

            <footer className="phone-nav">
              <span>SID {sessionId ? sessionId.slice(0, 8) : 'pending'}</span>
              <span>DRAG UP TO SCROLL</span>
              <span>PHASE {serverState?.phase ?? 'feed'}</span>
            </footer>
          </section>
        </div>

        {isBattleMockupActive ? (
          <section
            className={`battle-mockup ${
              isReturningToFeed
                ? 'battle-mockup-return'
                : isEncounterActive
                  ? 'battle-mockup-transition'
                  : 'battle-mockup-live'
            }`}
            style={encounterBurstStyle}
            aria-label="Battle interface mockup"
          >
            <header className="battle-hud">
              <div className="battle-health">
                <span className="battle-label">ENEMY // SIGNAL_REAPER</span>
                <div className="battle-health-track" role="img" aria-label="Enemy health">
                  <span className="battle-health-fill" />
                </div>
              </div>
            </header>

            <aside className="battle-chat" aria-label="Combat chat">
              <p>SYS: hostile channel stabilized.</p>
              <p>VOID: I can see you scrolling.</p>
              <p>SYS: input profile corrupted.</p>
              <p>VOID: prove you can survive.</p>
            </aside>

            <footer className="battle-actions">
              <button type="button">Block</button>
              <button type="button">Parry</button>
              <button type="button">Idle</button>
              <button type="button">Exploit</button>
              <button type="button" onClick={handleReturnToFeed} disabled={isReturningToFeed}>
                Return to Feed
              </button>
            </footer>
          </section>
        ) : null}
      </div>
      {isInputLocked ? <div className="input-lock-shield" aria-hidden /> : null}
    </main>
  )
}

export default FeedScreen
