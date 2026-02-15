import { create } from 'zustand'
import { dbClient } from './db/client'

export type CasePreference = 'lowercase' | 'UPPERCASE' | 'camelCase'

export interface KeywordStylePrefs {
  prefix: string
  maxLength: number
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
  hydrate: () => Promise<void>
  hasUserPrefs: () => boolean
  _loaded: boolean
}

export const useKeywordStyleStore = create<KeywordStyleStore>((set, get) => ({
  ...DEFAULT_PREFS,
  _loaded: false,

  setPrefix: (prefix) => {
    set({ prefix })
    dbClient.saveSetting('keywordStylePrefs', extractPrefs({ ...get(), prefix }))
  },

  setMaxLength: (maxLength) => {
    const clamped = Math.max(2, Math.min(12, maxLength))
    set({ maxLength: clamped })
    dbClient.saveSetting('keywordStylePrefs', extractPrefs({ ...get(), maxLength: clamped }))
  },

  setCasePreference: (casePreference) => {
    set({ casePreference })
    dbClient.saveSetting('keywordStylePrefs', extractPrefs({ ...get(), casePreference }))
  },

  setAll: (prefs) => {
    const current = get()
    const merged = {
      prefix: prefs.prefix ?? current.prefix,
      maxLength: prefs.maxLength != null ? Math.max(2, Math.min(12, prefs.maxLength)) : current.maxLength,
      casePreference: prefs.casePreference ?? current.casePreference,
    }
    set(merged)
    dbClient.saveSetting('keywordStylePrefs', merged)
  },

  hydrate: async () => {
    try {
      const settings = await dbClient.getSettings(['keywordStylePrefs'])
      const stored = settings.keywordStylePrefs as Partial<KeywordStylePrefs> | undefined
      if (stored) {
        set({
          prefix: stored.prefix ?? DEFAULT_PREFS.prefix,
          maxLength: stored.maxLength ?? DEFAULT_PREFS.maxLength,
          casePreference: stored.casePreference ?? DEFAULT_PREFS.casePreference,
          _loaded: true,
        })
      } else {
        set({ _loaded: true })
      }
    } catch {
      set({ _loaded: true })
    }
  },

  hasUserPrefs: () => {
    return get()._loaded
  },
}))

function extractPrefs(state: KeywordStylePrefs): KeywordStylePrefs {
  return {
    prefix: state.prefix,
    maxLength: state.maxLength,
    casePreference: state.casePreference,
  }
}

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

  let prefix = ''
  const prefixCounts: Record<string, number> = {}
  for (const kw of keywords) {
    const firstChar = kw[0]
    if (/[!@#$%^&*\/]/.test(firstChar)) {
      if (kw.startsWith('//')) {
        prefixCounts['//'] = (prefixCounts['//'] || 0) + 1
      } else {
        prefixCounts[firstChar] = (prefixCounts[firstChar] || 0) + 1
      }
    }
  }

  const prefixEntries = Object.entries(prefixCounts)
  if (prefixEntries.length > 0) {
    const [topPrefix, count] = prefixEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
    if (count >= keywords.length * 0.5) {
      prefix = topPrefix
    }
  }

  const lengths = keywords.map((k) => k.length).sort((a, b) => a - b)
  const p90Index = Math.floor(lengths.length * 0.9)
  const maxLength = Math.max(2, Math.min(12, lengths[p90Index] || 6))

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

  return { prefix, maxLength, casePreference }
}
