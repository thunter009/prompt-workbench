import { create } from 'zustand'
import { findPlaceholders } from '@/lib/raycast/placeholder-parser'
import type { ParsedPlaceholder } from '@/lib/raycast/placeholder-parser'

type ActiveTab = 'preview' | 'playground'

const STORAGE_KEY = 'prompt-workbench-playground'
const TEST_VALUES_KEY = 'prompt-workbench-test-values'

// testValues keyed by snippetId, then by placeholder key (e.g. "clipboard", "argument:Name")
type TestValues = Record<string, Record<string, string>>

function placeholderKey(p: ParsedPlaceholder): string {
  if (p.type === 'argument') return `argument:${p.argumentName ?? ''}`
  if (p.type === 'snippet') return `snippet:${p.snippetRef ?? ''}`
  return p.type
}

/** Replace all placeholders in text with their test values */
export function substitutePlaceholders(
  text: string,
  values: Record<string, string>,
): string {
  const matches = findPlaceholders(text)
  if (matches.length === 0) return text

  // Replace from end to start so positions stay valid
  let result = text
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    const key = placeholderKey(m.placeholder)
    const replacement = values[key] ?? ''
    result = result.slice(0, m.start) + replacement + result.slice(m.end)
  }
  return result
}

interface PlaygroundStore {
  activeTab: ActiveTab
  testValues: TestValues
  isRunning: boolean
  currentResponse: string
  abortController: AbortController | null

  setActiveTab: (tab: ActiveTab) => void
  setTestValue: (snippetId: string, key: string, value: string) => void
  getTestValues: (snippetId: string) => Record<string, string>
  load: () => void
  run: (params: {
    text: string
    snippetId: string
    ollamaUrl: string
    model: string
    systemPrompt?: string
  }) => Promise<void>
  stop: () => void
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
  isRunning: false,
  currentResponse: '',
  abortController: null,

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

  run: async ({ text, snippetId, ollamaUrl, model, systemPrompt }) => {
    const controller = new AbortController()
    const values = get().getTestValues(snippetId)
    const prompt = substitutePlaceholders(text, values)

    set({ isRunning: true, currentResponse: '', abortController: controller })

    try {
      const res = await fetch('/api/playground/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, ollamaUrl, systemPrompt }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        set({ currentResponse: `Error: ${data.error ?? res.statusText}`, isRunning: false, abortController: null })
        return
      }

      if (!res.body) {
        set({ currentResponse: 'Error: No response body', isRunning: false, abortController: null })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        // Ollama streams NDJSON - each line is a JSON object with a "response" field
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line) as { response?: string }
            if (parsed.response) {
              accumulated += parsed.response
              set({ currentResponse: accumulated })
            }
          } catch {
            // partial JSON line, skip
          }
        }
      }

      set({ isRunning: false, abortController: null })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        set({ isRunning: false, abortController: null })
        return
      }
      const msg = err instanceof Error ? err.message : 'Run failed'
      set({ currentResponse: `Error: ${msg}`, isRunning: false, abortController: null })
    }
  },

  stop: () => {
    const controller = get().abortController
    controller?.abort()
    set({ isRunning: false, abortController: null })
  },
}))
