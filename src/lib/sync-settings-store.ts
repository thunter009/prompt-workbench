import { create } from 'zustand'
import { dbClient } from './db/client'

export type SyncInterval = '5m' | '15m' | '30m' | '1h' | '4h'

export const SYNC_INTERVALS: { value: SyncInterval; label: string }[] = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
]

export const DEFAULT_INTERVAL: SyncInterval = '30m'

interface SyncSettings {
  fileWatcherEnabled: boolean
  intervalSyncEnabled: boolean
  syncInterval: SyncInterval
  lastSyncTime: number | null
}

interface SyncSettingsStore extends SyncSettings {
  setFileWatcherEnabled: (enabled: boolean) => void
  setIntervalSyncEnabled: (enabled: boolean) => void
  setSyncInterval: (interval: SyncInterval) => void
  setLastSyncTime: (time: number | null) => void
  hydrate: () => Promise<void>
}

export const useSyncSettingsStore = create<SyncSettingsStore>((set, get) => ({
  fileWatcherEnabled: true,
  intervalSyncEnabled: true,
  syncInterval: DEFAULT_INTERVAL,
  lastSyncTime: null,

  setFileWatcherEnabled: (enabled) => {
    set({ fileWatcherEnabled: enabled })
    dbClient.saveSetting('syncSettings', { ...extractSettings(get()), fileWatcherEnabled: enabled })
  },

  setIntervalSyncEnabled: (enabled) => {
    set({ intervalSyncEnabled: enabled })
    dbClient.saveSetting('syncSettings', { ...extractSettings(get()), intervalSyncEnabled: enabled })
  },

  setSyncInterval: (interval) => {
    set({ syncInterval: interval })
    dbClient.saveSetting('syncSettings', { ...extractSettings(get()), syncInterval: interval })
  },

  setLastSyncTime: (time) => {
    set({ lastSyncTime: time })
  },

  hydrate: async () => {
    try {
      const settings = await dbClient.getSettings(['syncSettings'])
      const stored = settings.syncSettings as Partial<SyncSettings> | undefined
      if (stored) {
        set({
          fileWatcherEnabled: stored.fileWatcherEnabled ?? true,
          intervalSyncEnabled: stored.intervalSyncEnabled ?? true,
          syncInterval: stored.syncInterval ?? DEFAULT_INTERVAL,
        })
      }
    } catch {
      // DB not available
    }
  },
}))

function extractSettings(state: SyncSettings): SyncSettings {
  return {
    fileWatcherEnabled: state.fileWatcherEnabled,
    intervalSyncEnabled: state.intervalSyncEnabled,
    syncInterval: state.syncInterval,
    lastSyncTime: state.lastSyncTime,
  }
}
