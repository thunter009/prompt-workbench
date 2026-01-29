import { create } from 'zustand'

export type SyncInterval = '5m' | '15m' | '30m' | '1h' | '4h'

export const SYNC_INTERVALS: { value: SyncInterval; label: string }[] = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
]

export const DEFAULT_INTERVAL: SyncInterval = '30m'

const STORAGE_KEY = 'prompt-workbench-sync-settings'

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
  load: () => void
}

function loadFromStorage(): Partial<SyncSettings> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveToStorage(settings: SyncSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

export const useSyncSettingsStore = create<SyncSettingsStore>((set, get) => ({
  fileWatcherEnabled: true,
  intervalSyncEnabled: true,
  syncInterval: DEFAULT_INTERVAL,
  lastSyncTime: null,

  setFileWatcherEnabled: (enabled) => {
    set({ fileWatcherEnabled: enabled })
    saveToStorage(get())
  },

  setIntervalSyncEnabled: (enabled) => {
    set({ intervalSyncEnabled: enabled })
    saveToStorage(get())
  },

  setSyncInterval: (interval) => {
    set({ syncInterval: interval })
    saveToStorage(get())
  },

  setLastSyncTime: (time) => {
    set({ lastSyncTime: time })
    // Don't persist lastSyncTime to storage
  },

  load: () => {
    const stored = loadFromStorage()
    set({
      fileWatcherEnabled: stored.fileWatcherEnabled ?? true,
      intervalSyncEnabled: stored.intervalSyncEnabled ?? true,
      syncInterval: stored.syncInterval ?? DEFAULT_INTERVAL,
    })
  },
}))
