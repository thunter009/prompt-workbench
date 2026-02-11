import { create } from 'zustand'
import { findPlaceholders } from '@/lib/raycast/placeholder-parser'
import type { ParsedPlaceholder } from '@/lib/raycast/placeholder-parser'
import { resolveSnippetIncludes, type ResolutionError } from '@/lib/raycast/snippet-resolver'
import type { Snippet } from '@/types'

type ActiveTab = 'preview' | 'playground'

const STORAGE_KEY = 'prompt-workbench-playground'
const TEST_VALUES_KEY = 'prompt-workbench-test-values'
const HISTORY_KEY = 'prompt-workbench-run-history'
const COMPARE_MODELS_KEY = 'prompt-workbench-compare-models'
const MAX_RUNS = 5
const MAX_COMPARE_MODELS = 3

export interface PlaygroundRun {
  timestamp: number
  model: string
  testValues: Record<string, string>
  assembledPrompt: string
  response: string
  tokenCount: number
  durationMs: number
  /** If part of a comparison, all models in the group */
  compareGroup?: string[]
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

export interface CompareResponse {
  model: string
  response: string
  tokenCount: number
  elapsedMs: number
  isRunning: boolean
  error?: string
}

interface PlaygroundStore {
  activeTab: ActiveTab
  testValues: TestValues
  isRunning: boolean
  currentResponse: string
  responseMeta: ResponseMeta | null
  abortController: AbortController | null
  runHistory: Record<string, PlaygroundRun[]>

  // Multi-model comparison
  compareModels: string[]
  compareResponses: Record<string, CompareResponse>
  isComparing: boolean
  compareAbortControllers: AbortController[]

  setActiveTab: (tab: ActiveTab) => void
  setTestValue: (snippetId: string, key: string, value: string) => void
  getTestValues: (snippetId: string) => Record<string, string>
  clearResponse: () => void
  addRun: (snippetId: string, run: PlaygroundRun) => void
  getHistory: (snippetId: string) => PlaygroundRun[]
  load: () => void
  snippetErrors: ResolutionError[]
  checkSnippetErrors: (text: string, snippets: Snippet[]) => ResolutionError[]
  run: (params: {
    text: string
    snippetId: string
    ollamaUrl: string
    model: string
    snippets?: Snippet[]
    systemPrompt?: string
  }) => Promise<void>
  stop: () => void

  // Compare
  toggleCompareModel: (model: string) => void
  setCompareModels: (models: string[]) => void
  clearCompareResponses: () => void
  compareRun: (params: {
    text: string
    snippetId: string
    ollamaUrl: string
    snippets?: Snippet[]
    systemPrompt?: string
  }) => Promise<void>
  stopCompare: () => void
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

function loadCompareModels(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(COMPARE_MODELS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveCompareModels(models: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COMPARE_MODELS_KEY, JSON.stringify(models))
  } catch {
    // Ignore storage errors
  }
}

/** Stream a single model's response, updating compareResponses in place */
async function streamModelResponse(
  model: string,
  prompt: string,
  ollamaUrl: string,
  systemPrompt: string | undefined,
  signal: AbortSignal,
  set: (fn: (s: PlaygroundStore) => Partial<PlaygroundStore>) => void,
): Promise<void> {
  const startTime = Date.now()

  // Init this model's response entry
  set((s) => ({
    compareResponses: {
      ...s.compareResponses,
      [model]: { model, response: '', tokenCount: 0, elapsedMs: 0, isRunning: true },
    },
  }))

  try {
    const res = await fetch('/api/playground/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model, ollamaUrl, systemPrompt }),
      signal,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }))
      set((s) => ({
        compareResponses: {
          ...s.compareResponses,
          [model]: { ...s.compareResponses[model], isRunning: false, error: data.error ?? res.statusText },
        },
      }))
      return
    }

    if (!res.body) {
      set((s) => ({
        compareResponses: {
          ...s.compareResponses,
          [model]: { ...s.compareResponses[model], isRunning: false, error: 'No response body' },
        },
      }))
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
            set((s) => ({
              compareResponses: {
                ...s.compareResponses,
                [model]: { ...s.compareResponses[model], response: accumulated },
              },
            }))
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
    set((s) => ({
      compareResponses: {
        ...s.compareResponses,
        [model]: { ...s.compareResponses[model], isRunning: false, tokenCount, elapsedMs },
      },
    }))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      set((s) => ({
        compareResponses: {
          ...s.compareResponses,
          [model]: { ...s.compareResponses[model], isRunning: false },
        },
      }))
      return
    }
    const msg = err instanceof Error ? err.message : 'Run failed'
    set((s) => ({
      compareResponses: {
        ...s.compareResponses,
        [model]: { ...s.compareResponses[model], isRunning: false, error: msg },
      },
    }))
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

  snippetErrors: [],
  compareModels: [],
  compareResponses: {},
  isComparing: false,
  compareAbortControllers: [],

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
    const compareModels = loadCompareModels()
    set({
      ...(stored.activeTab ? { activeTab: stored.activeTab } : {}),
      testValues,
      runHistory,
      compareModels,
    })
  },

  checkSnippetErrors: (text, snippets) => {
    const { errors } = resolveSnippetIncludes(text, snippets)
    set({ snippetErrors: errors })
    return errors
  },

  run: async ({ text, snippetId, ollamaUrl, model, snippets, systemPrompt }) => {
    const controller = new AbortController()
    const values = get().getTestValues(snippetId)

    // Resolve snippet includes if snippets provided
    let resolvedText = text
    if (snippets && snippets.length > 0) {
      const { text: resolved, errors } = resolveSnippetIncludes(text, snippets)
      if (errors.length > 0) {
        set({ snippetErrors: errors })
        return
      }
      set({ snippetErrors: [] })
      resolvedText = resolved
    }

    const prompt = substitutePlaceholders(resolvedText, values)
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

  toggleCompareModel: (model) => {
    const current = get().compareModels
    let next: string[]
    if (current.includes(model)) {
      next = current.filter((m) => m !== model)
    } else {
      if (current.length >= MAX_COMPARE_MODELS) return
      next = [...current, model]
    }
    set({ compareModels: next })
    saveCompareModels(next)
  },

  setCompareModels: (models) => {
    const clamped = models.slice(0, MAX_COMPARE_MODELS)
    set({ compareModels: clamped })
    saveCompareModels(clamped)
  },

  clearCompareResponses: () => {
    set({ compareResponses: {} })
  },

  compareRun: async ({ text, snippetId, ollamaUrl, snippets, systemPrompt }) => {
    const models = get().compareModels
    if (models.length === 0) return

    const values = get().getTestValues(snippetId)

    // Resolve snippet includes if snippets provided
    let resolvedText = text
    if (snippets && snippets.length > 0) {
      const { text: resolved, errors } = resolveSnippetIncludes(text, snippets)
      if (errors.length > 0) {
        set({ snippetErrors: errors })
        return
      }
      set({ snippetErrors: [] })
      resolvedText = resolved
    }

    const prompt = substitutePlaceholders(resolvedText, values)
    const controllers = models.map(() => new AbortController())

    set({
      isComparing: true,
      compareResponses: {},
      compareAbortControllers: controllers,
      // Clear single-run state
      currentResponse: '',
      responseMeta: null,
    })

    // Run all models in parallel
    await Promise.allSettled(
      models.map((model, i) =>
        streamModelResponse(model, prompt, ollamaUrl, systemPrompt, controllers[i].signal, set)
      )
    )

    set({ isComparing: false, compareAbortControllers: [] })

    // Save each completed response as a grouped history entry
    const responses = get().compareResponses
    const timestamp = Date.now()
    for (const model of models) {
      const r = responses[model]
      if (r && r.response && !r.error) {
        get().addRun(snippetId, {
          timestamp,
          model,
          testValues: values,
          assembledPrompt: prompt,
          response: r.response,
          tokenCount: r.tokenCount,
          durationMs: r.elapsedMs,
          compareGroup: models,
        })
      }
    }
  },

  stopCompare: () => {
    for (const c of get().compareAbortControllers) {
      c.abort()
    }
    set({ isComparing: false, compareAbortControllers: [] })
  },
}))
