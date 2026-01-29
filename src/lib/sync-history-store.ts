import { create } from 'zustand'
import type { SyncEvent, SyncDirection, SyncEventType, SyncEventDetails } from '@/types'

const STORAGE_KEY = 'prompt-workbench-sync-history'
const MAX_EVENTS = 50

interface SyncHistoryStore {
  events: SyncEvent[]
  addEvent: (
    direction: SyncDirection,
    type: SyncEventType,
    count: number,
    details?: SyncEventDetails
  ) => void
  clearHistory: () => void
  load: () => void
}

function loadFromStorage(): SyncEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveToStorage(events: SyncEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // Ignore storage errors
  }
}

export const useSyncHistoryStore = create<SyncHistoryStore>((set, get) => ({
  events: [],

  addEvent: (direction, type, count, details) => {
    const newEvent: SyncEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      direction,
      type,
      count,
      details,
    }
    const events = [newEvent, ...get().events].slice(0, MAX_EVENTS)
    set({ events })
    saveToStorage(events)
  },

  clearHistory: () => {
    set({ events: [] })
    saveToStorage([])
  },

  load: () => {
    const events = loadFromStorage()
    set({ events })
  },
}))
