'use client'

import { useEffect, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useSyncSettingsStore, type SyncInterval } from '@/lib/sync-settings-store'

export function useIntervalSync() {
  const [isSyncing, setIsSyncing] = useState(false)
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
    setIsSyncing(true)
    try {
      const res = await fetch('/api/interval-sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.lastSyncTime) {
          setLastSyncTime(data.lastSyncTime)
        }
        toast.success('Sync triggered')
      } else {
        toast.error('Sync failed')
      }
    } catch {
      toast.error('Sync failed')
    } finally {
      setIsSyncing(false)
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
    isSyncing,
    setEnabled: toggleEnabled,
    setInterval: updateInterval,
    triggerSync,
  }
}
