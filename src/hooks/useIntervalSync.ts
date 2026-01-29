'use client'

import { useEffect, useCallback } from 'react'
import { useSyncSettingsStore, type SyncInterval } from '@/lib/sync-settings-store'

export function useIntervalSync() {
  const {
    intervalSyncEnabled,
    syncInterval,
    lastSyncTime,
    setIntervalSyncEnabled,
    setSyncInterval,
    setLastSyncTime,
    load,
  } = useSyncSettingsStore()

  // Load settings on mount
  useEffect(() => {
    load()
  }, [load])

  // Sync settings to server when they change
  useEffect(() => {
    const updateServer = async () => {
      try {
        const res = await fetch('/api/sync-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intervalSyncEnabled,
            syncInterval,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.lastSyncTime) {
            setLastSyncTime(data.lastSyncTime)
          }
        }
      } catch {
        // Ignore server errors
      }
    }

    updateServer()
  }, [intervalSyncEnabled, syncInterval, setLastSyncTime])

  const triggerSync = useCallback(async () => {
    try {
      const res = await fetch('/api/interval-sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.lastSyncTime) {
          setLastSyncTime(data.lastSyncTime)
        }
      }
    } catch {
      // Ignore errors
    }
  }, [setLastSyncTime])

  const updateInterval = useCallback((interval: SyncInterval) => {
    setSyncInterval(interval)
  }, [setSyncInterval])

  const toggleEnabled = useCallback((enabled: boolean) => {
    setIntervalSyncEnabled(enabled)
  }, [setIntervalSyncEnabled])

  return {
    enabled: intervalSyncEnabled,
    interval: syncInterval,
    lastSyncTime,
    setEnabled: toggleEnabled,
    setInterval: updateInterval,
    triggerSync,
  }
}
