import { create } from 'zustand'

type ActiveTab = 'preview' | 'playground'

const STORAGE_KEY = 'prompt-workbench-playground'

interface PlaygroundStore {
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  load: () => void
}

function loadFromStorage(): Partial<{ activeTab: ActiveTab }> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveToStorage(tab: ActiveTab): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeTab: tab }))
  } catch {
    // Ignore storage errors
  }
}

export const usePlaygroundStore = create<PlaygroundStore>((set) => ({
  activeTab: 'preview',

  setActiveTab: (tab) => {
    set({ activeTab: tab })
    saveToStorage(tab)
  },

  load: () => {
    const stored = loadFromStorage()
    if (stored.activeTab) {
      set({ activeTab: stored.activeTab })
    }
  },
}))
