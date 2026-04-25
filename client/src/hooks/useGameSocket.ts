import { useCallback, useEffect, useRef, useState } from 'react'
import type { SocketMessage, SocketStatus } from '../store/gameReducer'

const MAX_RECONNECT_DELAY = 10000

interface ReconnectState {
  attempt: number
  timeoutId: number | null
  manualClose: boolean
}

const buildSocketUrl = (sessionId: string): string => {
  const envBase = import.meta.env.VITE_WS_BASE
  if (typeof envBase === 'string' && envBase.length > 0) {
    return `${envBase.replace(/\/$/, '')}/ws/${sessionId}`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/${sessionId}`
}

export const useGameSocket = (
  sessionId: string | null,
  onMessage?: (message: SocketMessage) => void,
) => {
  const [status, setStatus] = useState<SocketStatus>('disconnected')
  const socketRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const reconnectRef = useRef<ReconnectState>({
    attempt: 0,
    timeoutId: null,
    manualClose: false,
  })

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current.timeoutId) {
      window.clearTimeout(reconnectRef.current.timeoutId)
      reconnectRef.current.timeoutId = null
    }
  }, [])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    let isActive = true
    const reconnectState = reconnectRef.current

    const connect = () => {
      if (!isActive) {
        return
      }

      const socket = new WebSocket(buildSocketUrl(sessionId))
      socketRef.current = socket

      socket.onopen = () => {
        if (!isActive || socketRef.current !== socket) {
          return
        }
        reconnectState.attempt = 0
        setStatus('connected')
      }

      socket.onmessage = (event) => {
        if (!isActive || !onMessageRef.current) {
          return
        }

        try {
          const payload = JSON.parse(event.data) as unknown
          if (payload && typeof payload === 'object') {
            onMessageRef.current(payload as SocketMessage)
          }
        } catch (error) {
          console.error('WS message parse failed', error)
        }
      }

      socket.onerror = (event) => {
        if (!isActive || socketRef.current !== socket) {
          return
        }
        console.error('WS error', event)
        setStatus('error')
      }

      socket.onclose = () => {
        if (socketRef.current !== socket) {
          return
        }

        socketRef.current = null
        if (reconnectState.manualClose) {
          setStatus('disconnected')
          return
        }
        if (!isActive) {
          return
        }

        clearReconnect()
        const attempt = reconnectState.attempt + 1
        reconnectState.attempt = attempt
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY)
        setStatus('reconnecting')
        reconnectState.timeoutId = window.setTimeout(() => {
          connect()
        }, delay)
      }
    }

    reconnectState.manualClose = false
    reconnectState.attempt = 0
    connect()

    return () => {
      isActive = false
      reconnectState.manualClose = true
      clearReconnect()
      const activeSocket = socketRef.current
      if (activeSocket) {
        activeSocket.close(1000, 'client shutdown')
      }
    }
  }, [clearReconnect, sessionId])

  const sendMessage = useCallback((payload: unknown): boolean => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WS send dropped: socket not connected')
      return false
    }

    socketRef.current.send(JSON.stringify(payload))
    return true
  }, [])

  return { status, sendMessage }
}
