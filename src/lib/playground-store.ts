import { create } from 'zustand'
import { findPlaceholders } from '@/lib/raycast/placeholder-parser'
import type { ParsedPlaceholder } from '@/lib/raycast/placeholder-parser'

type ActiveTab = 'preview' | 'playground'

const STORAGE_KEY = 'prompt-workbench-playground'
const TEST_VALUES_KEY = 'prompt-workbench-test-values'
const HISTORY_KEY = 'prompt-workbench-run-history'
const MAX_RUNS = 5

export interface PlaygroundRun {
  timestamp: number
  model: string
  testValues: Record<string, string>
  assembledPrompt: string
  response: string
  tokenCount: number
  durationMs: number
}

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

interface ResponseMeta {
  model: string
  tokenCount: number
  elapsedMs: number
}

interface PlaygroundStore {
  activeTab: ActiveTab
  testValues: TestValues
  isRunning: boolean
  currentResponse: string
  responseMeta: ResponseMeta | null
  abortController: AbortController | null
  runHistory: Record<string, PlaygroundRun[]>

  setActiveTab: (tab: ActiveTab) => void
  setTestValue: (snippetId: string, key: string, value: string) => void
  getTestValues: (snippetId: string) => Record<string, string>
  clearResponse: () => void
  addRun: (snippetId: string, run: PlaygroundRun) => void
  getHistory: (snippetId: string) => PlaygroundRun[]
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

function loadRunHistory(): Record<string, PlaygroundRun[]> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(HISTORY_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveRunHistory(history: Record<string, PlaygroundRun[]>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage errors
  }
}

export const usePlaygroundStore = create<PlaygroundStore>((set, get) => ({
  activeTab: 'preview',
  testValues: {},
  isRunning: false,
  currentResponse: '',
  responseMeta: null,
  abortController: null,
  runHistory: {},

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

  clearResponse: () => {
    set({ currentResponse: '', responseMeta: null })
  },

  addRun: (snippetId, run) => {
    const history = { ...get().runHistory }
    const existing = history[snippetId] ?? []
    history[snippetId] = [run, ...existing].slice(0, MAX_RUNS)
    set({ runHistory: history })
    saveRunHistory(history)
  },

  getHistory: (snippetId) => {
    return get().runHistory[snippetId] ?? []
  },

  load: () => {
    const stored = loadFromStorage()
    const testValues = loadTestValues()
    const runHistory = loadRunHistory()
    set({
      ...(stored.activeTab ? { activeTab: stored.activeTab } : {}),
      testValues,
      runHistory,
    })
  },

  run: async ({ text, snippetId, ollamaUrl, model, systemPrompt }) => {
    const controller = new AbortController()
    const values = get().getTestValues(snippetId)
    const prompt = substitutePlaceholders(text, values)
    const startTime = Date.now()

    set({ isRunning: true, currentResponse: '', responseMeta: null, abortController: controller })

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
      let tokenCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line) as { response?: string; done?: boolean; eval_count?: number }
            if (parsed.response) {
              accumulated += parsed.response
              set({ currentResponse: accumulated })
            }
            if (parsed.done && parsed.eval_count) {
              tokenCount = parsed.eval_count
            }
          } catch {
            // partial JSON line, skip
          }
        }
      }

      const elapsedMs = Date.now() - startTime
      set({
        isRunning: false,
        abortController: null,
        responseMeta: { model, tokenCount, elapsedMs },
      })

      if (accumulated) {
        get().addRun(snippetId, {
          timestamp: Date.now(),
          model,
          testValues: values,
          assembledPrompt: prompt,
          response: accumulated,
          tokenCount,
          durationMs: elapsedMs,
        })
      }
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
