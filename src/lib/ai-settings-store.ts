import { create } from 'zustand'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_OLLAMA_MODEL = 'llama3.2'

const STORAGE_KEY = 'prompt-workbench-ai-settings'

interface AISettings {
  ollamaUrl: string
  ollamaModel: string
}

interface AISettingsStore extends AISettings {
  setOllamaUrl: (url: string) => void
  setOllamaModel: (model: string) => void
  load: () => void
}

function loadFromStorage(): Partial<AISettings> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveToStorage(settings: AISettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

export const useAISettingsStore = create<AISettingsStore>((set, get) => ({
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,

  setOllamaUrl: (url) => {
    set({ ollamaUrl: url })
    saveToStorage(get())
  },

  setOllamaModel: (model) => {
    set({ ollamaModel: model })
    saveToStorage(get())
  },

  load: () => {
    const stored = loadFromStorage()
    set({
      ollamaUrl: stored.ollamaUrl ?? DEFAULT_OLLAMA_URL,
      ollamaModel: stored.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
    })
  },
}))
