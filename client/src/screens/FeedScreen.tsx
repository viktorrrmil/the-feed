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
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [swipeAnimation, setSwipeAnimation] = useState<SwipeAnimation>('none')

  const currentPost = posts[0] ?? null
  const nextPost = posts[1] ?? null
  const connected = socketStatus === 'connected'

  const setOffset = useCallback((value: number) => {
    dragOffsetRef.current = value
    setDragOffset(value)
  }, [])

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
    },
    [],
  )

  const finalizeSwipe = useCallback(() => {
    if (!connected) {
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
  }, [connected, nextPost, onAdvance, setOffset])

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!currentPost || !connected) {
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

  return (
    <main className="screen feed-screen">
      <div className="feed-shell">
        <div className="walking-bg" aria-hidden />

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
    </main>
  )
}

export default FeedScreen
