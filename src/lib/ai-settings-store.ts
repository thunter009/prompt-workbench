import { create } from 'zustand'
import { dbClient } from './db/client'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_OLLAMA_MODEL = 'llama3.2'
export const DEFAULT_META_SYSTEM_PROMPT = `You are a prompt engineering expert. Improve the given prompt to be clearer, more specific, and more effective. Return only the improved prompt text without explanation.`

interface AISettings {
  ollamaUrl: string
  ollamaModel: string
  metaSystemPrompt: string
}

interface AISettingsStore extends AISettings {
  setOllamaUrl: (url: string) => void
  setOllamaModel: (model: string) => void
  setMetaSystemPrompt: (prompt: string) => void
  hydrate: () => Promise<void>
}

export const useAISettingsStore = create<AISettingsStore>((set, get) => ({
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  metaSystemPrompt: DEFAULT_META_SYSTEM_PROMPT,

  setOllamaUrl: (url) => {
    set({ ollamaUrl: url })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), ollamaUrl: url }))
  },

  setOllamaModel: (model) => {
    set({ ollamaModel: model })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), ollamaModel: model }))
  },

  setMetaSystemPrompt: (prompt) => {
    set({ metaSystemPrompt: prompt })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), metaSystemPrompt: prompt }))
  },

  hydrate: async () => {
    try {
      const settings = await dbClient.getSettings(['aiSettings'])
      const stored = settings.aiSettings as Partial<AISettings> | undefined
      if (stored) {
        set({
          ollamaUrl: stored.ollamaUrl ?? DEFAULT_OLLAMA_URL,
          ollamaModel: stored.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
          metaSystemPrompt: stored.metaSystemPrompt ?? DEFAULT_META_SYSTEM_PROMPT,
        })
      }
    } catch {
      // DB not available
    }
  },
}))

function extractSettings(state: AISettings): AISettings {
  return {
    ollamaUrl: state.ollamaUrl,
    ollamaModel: state.ollamaModel,
    metaSystemPrompt: state.metaSystemPrompt,
  }
}
