import { create } from 'zustand'

type ActiveTab = 'preview' | 'playground'

const STORAGE_KEY = 'prompt-workbench-playground'
const TEST_VALUES_KEY = 'prompt-workbench-test-values'

// testValues keyed by snippetId, then by placeholder key (e.g. "clipboard", "argument:Name")
type TestValues = Record<string, Record<string, string>>

interface PlaygroundStore {
  activeTab: ActiveTab
  testValues: TestValues
  setActiveTab: (tab: ActiveTab) => void
  setTestValue: (snippetId: string, key: string, value: string) => void
  getTestValues: (snippetId: string) => Record<string, string>
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

function loadTestValues(): TestValues {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(TEST_VALUES_KEY)
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

function saveTestValues(testValues: TestValues): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TEST_VALUES_KEY, JSON.stringify(testValues))
  } catch {
    // Ignore storage errors
  }
}

export const usePlaygroundStore = create<PlaygroundStore>((set, get) => ({
  activeTab: 'preview',
  testValues: {},

  setActiveTab: (tab) => {
    set({ activeTab: tab })
    saveToStorage(tab)
  },

  setTestValue: (snippetId, key, value) => {
    const current = get().testValues
    const snippetValues = { ...current[snippetId], [key]: value }
    const next = { ...current, [snippetId]: snippetValues }
    set({ testValues: next })
    saveTestValues(next)
  },

  getTestValues: (snippetId) => {
    return get().testValues[snippetId] ?? {}
  },

  load: () => {
    const stored = loadFromStorage()
    const testValues = loadTestValues()
    set({
      ...(stored.activeTab ? { activeTab: stored.activeTab } : {}),
      testValues,
    })
  },
}))
