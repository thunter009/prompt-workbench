import { create } from 'zustand'

export const STORAGE_KEY = 'prompt-workbench-keyword-style-prefs'

export type CasePreference = 'lowercase' | 'UPPERCASE' | 'camelCase'

export interface KeywordStylePrefs {
  prefix: string      // e.g., "!", "@", "//", or ""
  maxLength: number   // default 6, range 2-12
  casePreference: CasePreference
}

export const DEFAULT_PREFS: KeywordStylePrefs = {
  prefix: '',
  maxLength: 6,
  casePreference: 'lowercase',
}

interface KeywordStyleStore extends KeywordStylePrefs {
  setPrefix: (prefix: string) => void
  setMaxLength: (length: number) => void
  setCasePreference: (pref: CasePreference) => void
  setAll: (prefs: Partial<KeywordStylePrefs>) => void
  load: () => void
  hasUserPrefs: () => boolean
}

function loadFromStorage(): Partial<KeywordStylePrefs> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveToStorage(prefs: KeywordStylePrefs): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage errors
  }
}

export const useKeywordStyleStore = create<KeywordStyleStore>((set, get) => ({
  ...DEFAULT_PREFS,

  setPrefix: (prefix) => {
    set({ prefix })
    saveToStorage({ prefix, maxLength: get().maxLength, casePreference: get().casePreference })
  },

  setMaxLength: (maxLength) => {
    const clamped = Math.max(2, Math.min(12, maxLength))
    set({ maxLength: clamped })
    saveToStorage({ prefix: get().prefix, maxLength: clamped, casePreference: get().casePreference })
  },

  setCasePreference: (casePreference) => {
    set({ casePreference })
    saveToStorage({ prefix: get().prefix, maxLength: get().maxLength, casePreference })
  },

  setAll: (prefs) => {
    const current = get()
    const merged = {
      prefix: prefs.prefix ?? current.prefix,
      maxLength: prefs.maxLength != null ? Math.max(2, Math.min(12, prefs.maxLength)) : current.maxLength,
      casePreference: prefs.casePreference ?? current.casePreference,
    }
    set(merged)
    saveToStorage(merged)
  },

  load: () => {
    const stored = loadFromStorage()
    set({
      prefix: stored.prefix ?? DEFAULT_PREFS.prefix,
      maxLength: stored.maxLength ?? DEFAULT_PREFS.maxLength,
      casePreference: stored.casePreference ?? DEFAULT_PREFS.casePreference,
    })
  },

  hasUserPrefs: () => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) !== null
  },
}))

/**
 * Analyze existing snippets and infer keyword style patterns
 */
export function analyzeKeywordPatterns(
  snippets: Array<{ keyword?: string }>
): KeywordStylePrefs {
  const keywords = snippets
    .map((s) => s.keyword?.trim())
    .filter((k): k is string => !!k && k.length > 0)

  if (keywords.length === 0) {
    return DEFAULT_PREFS
  }

  // Infer prefix: check first character patterns
  let prefix = ''
  const prefixCounts: Record<string, number> = {}
  for (const kw of keywords) {
    const firstChar = kw[0]
    if (/[!@#$%^&*\/]/.test(firstChar)) {
      // Check for multi-char prefixes like //
      if (kw.startsWith('//')) {
        prefixCounts['//'] = (prefixCounts['//'] || 0) + 1
      } else {
        prefixCounts[firstChar] = (prefixCounts[firstChar] || 0) + 1
      }
    }
  }

  const prefixEntries = Object.entries(prefixCounts)
  if (prefixEntries.length > 0) {
    // Use prefix if majority of keywords use it
    const [topPrefix, count] = prefixEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
    if (count >= keywords.length * 0.5) {
      prefix = topPrefix
    }
  }

  // Infer max length: use 90th percentile of existing keyword lengths
  const lengths = keywords.map((k) => k.length).sort((a, b) => a - b)
  const p90Index = Math.floor(lengths.length * 0.9)
  const maxLength = Math.max(2, Math.min(12, lengths[p90Index] || 6))

  // Infer case preference
  let casePreference: CasePreference = 'lowercase'
  const coreKeywords = keywords.map((k) => k.replace(/^[!@#$%^&*\/]+/, ''))

  const upperCount = coreKeywords.filter((k) => k === k.toUpperCase()).length
  const camelCount = coreKeywords.filter(
    (k) => /^[a-z][a-zA-Z0-9]*$/.test(k) && /[A-Z]/.test(k)
  ).length

  if (upperCount >= coreKeywords.length * 0.6) {
    casePreference = 'UPPERCASE'
  } else if (camelCount >= coreKeywords.length * 0.4) {
    casePreference = 'camelCase'
  }
  // else defaults to 'lowercase'

  return { prefix, maxLength, casePreference }
}
