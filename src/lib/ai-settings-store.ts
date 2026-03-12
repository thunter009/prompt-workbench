import { create } from 'zustand'
import type { LLMProvider } from '@/lib/llm'
import { dbClient } from './db/client'

export const DEFAULT_AI_PROVIDER: LLMProvider = 'ollama'
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_OLLAMA_MODEL = 'llama3.2'
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
export const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
export const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-latest'
export const DEFAULT_META_SYSTEM_PROMPT = `You are a prompt engineering expert. Improve the given prompt to be clearer, more specific, and more effective. Return only the improved prompt text without explanation.`

interface AISettings {
  provider: LLMProvider
  ollamaUrl: string
  ollamaModel: string
  openaiBaseUrl: string
  openaiApiKey: string
  openaiModel: string
  anthropicBaseUrl: string
  anthropicApiKey: string
  anthropicModel: string
  metaSystemPrompt: string
}

interface AISettingsStore extends AISettings {
  setProvider: (provider: LLMProvider) => void
  setOllamaUrl: (url: string) => void
  setOllamaModel: (model: string) => void
  setOpenAIBaseUrl: (url: string) => void
  setOpenAIApiKey: (apiKey: string) => void
  setOpenAIModel: (model: string) => void
  setAnthropicBaseUrl: (url: string) => void
  setAnthropicApiKey: (apiKey: string) => void
  setAnthropicModel: (model: string) => void
  setMetaSystemPrompt: (prompt: string) => void
  hydrate: () => Promise<void>
}

const DEFAULT_SETTINGS: AISettings = {
  provider: DEFAULT_AI_PROVIDER,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  openaiBaseUrl: DEFAULT_OPENAI_BASE_URL,
  openaiApiKey: '',
  openaiModel: DEFAULT_OPENAI_MODEL,
  anthropicBaseUrl: DEFAULT_ANTHROPIC_BASE_URL,
  anthropicApiKey: '',
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  metaSystemPrompt: DEFAULT_META_SYSTEM_PROMPT,
}

export const useAISettingsStore = create<AISettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,

  setProvider: (provider) => {
    set({ provider })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), provider }))
  },

  setOllamaUrl: (ollamaUrl) => {
    set({ ollamaUrl })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), ollamaUrl }))
  },

  setOllamaModel: (ollamaModel) => {
    set({ ollamaModel })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), ollamaModel }))
  },

  setOpenAIBaseUrl: (openaiBaseUrl) => {
    set({ openaiBaseUrl })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), openaiBaseUrl }))
  },

  setOpenAIApiKey: (openaiApiKey) => {
    set({ openaiApiKey })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), openaiApiKey }))
  },

  setOpenAIModel: (openaiModel) => {
    set({ openaiModel })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), openaiModel }))
  },

  setAnthropicBaseUrl: (anthropicBaseUrl) => {
    set({ anthropicBaseUrl })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), anthropicBaseUrl }))
  },

  setAnthropicApiKey: (anthropicApiKey) => {
    set({ anthropicApiKey })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), anthropicApiKey }))
  },

  setAnthropicModel: (anthropicModel) => {
    set({ anthropicModel })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), anthropicModel }))
  },

  setMetaSystemPrompt: (metaSystemPrompt) => {
    set({ metaSystemPrompt })
    dbClient.saveSetting('aiSettings', extractSettings({ ...get(), metaSystemPrompt }))
  },

  hydrate: async () => {
    try {
      const settings = await dbClient.getSettings(['aiSettings'])
      const stored = settings.aiSettings as Partial<AISettings> | undefined
      if (!stored) return

      set({
        provider: stored.provider ?? DEFAULT_SETTINGS.provider,
        ollamaUrl: stored.ollamaUrl ?? DEFAULT_SETTINGS.ollamaUrl,
        ollamaModel: stored.ollamaModel ?? DEFAULT_SETTINGS.ollamaModel,
        openaiBaseUrl: stored.openaiBaseUrl ?? DEFAULT_SETTINGS.openaiBaseUrl,
        openaiApiKey: stored.openaiApiKey ?? DEFAULT_SETTINGS.openaiApiKey,
        openaiModel: stored.openaiModel ?? DEFAULT_SETTINGS.openaiModel,
        anthropicBaseUrl: stored.anthropicBaseUrl ?? DEFAULT_SETTINGS.anthropicBaseUrl,
        anthropicApiKey: stored.anthropicApiKey ?? DEFAULT_SETTINGS.anthropicApiKey,
        anthropicModel: stored.anthropicModel ?? DEFAULT_SETTINGS.anthropicModel,
        metaSystemPrompt: stored.metaSystemPrompt ?? DEFAULT_SETTINGS.metaSystemPrompt,
      })
    } catch {
      // DB not available
    }
  },
}))

function extractSettings(state: AISettings): AISettings {
  return {
    provider: state.provider,
    ollamaUrl: state.ollamaUrl,
    ollamaModel: state.ollamaModel,
    openaiBaseUrl: state.openaiBaseUrl,
    openaiApiKey: state.openaiApiKey,
    openaiModel: state.openaiModel,
    anthropicBaseUrl: state.anthropicBaseUrl,
    anthropicApiKey: state.anthropicApiKey,
    anthropicModel: state.anthropicModel,
    metaSystemPrompt: state.metaSystemPrompt,
  }
}
