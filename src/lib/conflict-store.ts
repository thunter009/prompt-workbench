import { create } from 'zustand'
import type { SnippetConflict } from '@/types'

interface ConflictStore {
  // State
  conflicts: SnippetConflict[]
  panelOpen: boolean

  // Actions
  setConflicts: (conflicts: SnippetConflict[]) => void
  addConflicts: (conflicts: SnippetConflict[]) => void
  removeConflict: (id: string) => void
  clearConflicts: () => void
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void

  // Computed
  hasConflicts: () => boolean
  getConflictCount: () => number
}

export const useConflictStore = create<ConflictStore>((set, get) => ({
  conflicts: [],
  panelOpen: false,

  setConflicts: (conflicts) => set({ conflicts }),

  addConflicts: (newConflicts) =>
    set((state) => ({
      conflicts: [...state.conflicts, ...newConflicts],
      // Auto-open panel when conflicts detected
      panelOpen: newConflicts.length > 0 ? true : state.panelOpen,
    })),

  removeConflict: (id) =>
    set((state) => ({
      conflicts: state.conflicts.filter((c) => c.id !== id),
    })),

  clearConflicts: () => set({ conflicts: [], panelOpen: false }),

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

  hasConflicts: () => get().conflicts.length > 0,
  getConflictCount: () => get().conflicts.length,
}))
