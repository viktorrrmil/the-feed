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
  const connectRef = useRef<(() => void) | null>(null)
  const reconnectRef = useRef<ReconnectState>({
    attempt: 0,
    timeoutId: null,
    manualClose: false,
  })

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current.timeoutId) {
      window.clearTimeout(reconnectRef.current.timeoutId)
      reconnectRef.current.timeoutId = null
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    clearReconnect()
    const attempt = reconnectRef.current.attempt + 1
    reconnectRef.current.attempt = attempt
    const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY)
    setStatus('reconnecting')
    reconnectRef.current.timeoutId = window.setTimeout(() => {
      connectRef.current?.()
    }, delay)
  }, [clearReconnect])

  const connect = useCallback(() => {
    if (!sessionId) {
      return
    }

    const socket = new WebSocket(buildSocketUrl(sessionId))
    socketRef.current = socket

    socket.onopen = () => {
      reconnectRef.current.attempt = 0
      setStatus('connected')
    }

    socket.onmessage = (event) => {
      if (!onMessage) {
        return
      }

      try {
        const payload = JSON.parse(event.data) as unknown
        if (payload && typeof payload === 'object') {
          onMessage(payload as SocketMessage)
        }
      } catch (error) {
        console.error('WS message parse failed', error)
      }
    }

    socket.onerror = (event) => {
      console.error('WS error', event)
      setStatus('error')
    }

    socket.onclose = () => {
      socketRef.current = null
      if (reconnectRef.current.manualClose) {
        setStatus('disconnected')
        return
      }
      scheduleReconnect()
    }
  }, [onMessage, scheduleReconnect, sessionId])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    const reconnectState = reconnectRef.current
    reconnectRef.current.manualClose = false
    reconnectRef.current.attempt = 0
    connect()

    return () => {
      reconnectState.manualClose = true
      clearReconnect()
      if (socketRef.current) {
        socketRef.current.close(1000, 'client shutdown')
      }
    }
  }, [clearReconnect, connect, sessionId])

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
