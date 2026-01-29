'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  timestamp: number
}

export interface UseFileWatcherOptions {
  onChanges?: (events: FileChangeEvent[]) => void
  enabled?: boolean
}

export function useFileWatcher({ onChanges, enabled = true }: UseFileWatcherOptions = {}) {
  const [connected, setConnected] = useState(false)
  const [lastEvents, setLastEvents] = useState<FileChangeEvent[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const onChangesRef = useRef(onChanges)

  // Keep callback ref in sync
  onChangesRef.current = onChanges

  const connect = useCallback(() => {
    if (eventSourceRef.current) return

    const es = new EventSource('/api/watch')
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
    }

    es.onmessage = (event) => {
      try {
        const events: FileChangeEvent[] = JSON.parse(event.data)
        setLastEvents(events)
        onChangesRef.current?.(events)
      } catch {
        // Ignore parse errors (e.g., ping comments)
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      eventSourceRef.current = null
      // Reconnect after delay
      setTimeout(connect, 3000)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return { connected, lastEvents }
}
