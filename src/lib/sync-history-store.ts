import { create } from 'zustand'
import type { SyncEvent, SyncDirection, SyncEventType, SyncEventDetails } from '@/types'
import { generateId } from './utils/id'
import { dbClient } from './db/client'

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
  hydrate: () => Promise<void>
}

export const useSyncHistoryStore = create<SyncHistoryStore>((set, get) => ({
  events: [],

  addEvent: (direction, type, count, details) => {
    const newEvent: SyncEvent = {
      id: generateId(),
      timestamp: Date.now(),
      direction,
      type,
      count,
      details,
    }
    const events = [newEvent, ...get().events].slice(0, MAX_EVENTS)
    set({ events })
    dbClient.createSyncEvent(newEvent)
  },

  clearHistory: () => {
    set({ events: [] })
    dbClient.clearSyncHistory()
  },

  hydrate: async () => {
    try {
      const events = await dbClient.getSyncHistory()
      set({ events })
    } catch {
      // DB not available
    }
  },
}))
