'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, Sparkles, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { checkKeywordConflicts, type KeywordConflict } from '@/lib/keyword-analysis'
import { useKeywordStyleStore } from '@/lib/keyword-style-store'

const DEBOUNCE_MS = 1500
const MIN_TEXT_LENGTH = 10

interface KeywordSuggestionsProps {
  snippetId?: string
  snippetName: string
  snippetText: string
  currentKeyword: string
  onSelect: (keyword: string) => void
}

interface StyleGuide {
  prefix?: string
  maxLength?: number
  case?: 'lower' | 'upper' | 'camel'
  examples: Array<{ name: string; keyword: string }>
}

interface UserStylePrefs {
  prefix: string
  maxLength: number
  casePreference: 'lowercase' | 'UPPERCASE' | 'camelCase'
  hasUserPrefs: boolean
}

function deriveStyleGuide(
  snippets: Array<{ name: string; keyword?: string }>,
  userPrefs: UserStylePrefs
): StyleGuide {
  const examples = snippets
    .filter((s) => s.keyword && s.keyword.trim())
    .map((s) => ({ name: s.name, keyword: s.keyword! }))
    .slice(0, 5)

  // If user has saved preferences, use those
  if (userPrefs.hasUserPrefs) {
    const caseMap: Record<string, 'lower' | 'upper' | 'camel'> = {
      lowercase: 'lower',
      UPPERCASE: 'upper',
      camelCase: 'camel',
    }
    return {
      prefix: userPrefs.prefix || undefined,
      maxLength: userPrefs.maxLength,
      case: caseMap[userPrefs.casePreference],
      examples,
    }
  }

  // Otherwise infer from existing keywords
  let prefix: string | undefined
  const keywords = examples.map((e) => e.keyword)
  if (keywords.length > 0) {
    const firstChars = keywords.map((k) => k[0])
    const allSamePrefix = firstChars.every((c) => c === firstChars[0] && /[!@#]/.test(c))
    if (allSamePrefix) {
      prefix = firstChars[0]
    }
  }

  // Detect case pattern
  let caseType: 'lower' | 'upper' | 'camel' | undefined
  if (keywords.length > 0) {
    const allLower = keywords.every((k) => k === k.toLowerCase())
    const allUpper = keywords.every((k) => k === k.toUpperCase())
    if (allLower) caseType = 'lower'
    else if (allUpper) caseType = 'upper'
  }

  return {
    prefix,
    case: caseType,
    maxLength: 15,
    examples,
  }
}

export function KeywordSuggestions({
  snippetId,
  snippetName,
  snippetText,
  currentKeyword,
  onSelect,
}: KeywordSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestRef = useRef<string>('')
  const snippets = useSnippetStore((s) => s.snippets)

  // User keyword style preferences
  const keywordPrefix = useKeywordStyleStore((s) => s.prefix)
  const keywordMaxLength = useKeywordStyleStore((s) => s.maxLength)
  const keywordCase = useKeywordStyleStore((s) => s.casePreference)
  const hasUserPrefs = useKeywordStyleStore((s) => s.hasUserPrefs)

  // Check conflicts for all current suggestions
  const conflicts = useMemo<Map<string, KeywordConflict>>(() => {
    if (suggestions.length === 0) return new Map()
    return checkKeywordConflicts(suggestions, snippetId)
  }, [suggestions, snippetId])

  const fetchSuggestions = useCallback(async () => {
    // Don't fetch if keyword already set, text too short, or dismissed
    if (currentKeyword?.trim() || snippetText.length < MIN_TEXT_LENGTH || dismissed) {
      return
    }

    const requestKey = `${snippetName}::${snippetText}`
    if (requestKey === lastRequestRef.current) {
      return
    }
    lastRequestRef.current = requestKey

    setLoading(true)
    setError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const userPrefs: UserStylePrefs = {
        prefix: keywordPrefix,
        maxLength: keywordMaxLength,
        casePreference: keywordCase,
        hasUserPrefs: hasUserPrefs(),
      }
      const styleGuide = deriveStyleGuide(snippets, userPrefs)
      const res = await fetch('/api/suggest-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: snippetName,
          text: snippetText,
          styleGuide,
        }),
        signal: controller.signal,
      })

      const data = await res.json()
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions)
      } else {
        setSuggestions([])
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Is Ollama running?')
      } else {
        setError(`Could not fetch suggestions: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
      setSuggestions([])
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [snippetName, snippetText, currentKeyword, dismissed, snippets, keywordPrefix, keywordMaxLength, keywordCase, hasUserPrefs])

  // Debounced fetch when name/text changes
  useEffect(() => {
    // Reset dismissed state when snippet changes significantly
    setDismissed(false)
    setSuggestions([])

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Don't schedule if conditions not met
    if (currentKeyword?.trim() || snippetText.length < MIN_TEXT_LENGTH) {
      return
    }

    debounceRef.current = setTimeout(fetchSuggestions, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [snippetName, snippetText, currentKeyword, fetchSuggestions])

  // Clear suggestions when keyword is set
  useEffect(() => {
    if (currentKeyword?.trim()) {
      setSuggestions([])
    }
  }, [currentKeyword])

  const handleSelect = (keyword: string) => {
    onSelect(keyword)
    setSuggestions([])
  }

  const handleDismiss = () => {
    setDismissed(true)
    setSuggestions([])
  }

  // Nothing to show
  if (!loading && suggestions.length === 0 && !error) {
    return null
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Suggesting...</span>
        </div>
      )}

      {error && (
        <span className="text-xs text-amber-500">{error}</span>
      )}

      {suggestions.length > 0 && (
        <>
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          {suggestions.map((kw) => {
            const conflict = conflicts.get(kw)
            return (
              <button
                key={kw}
                onClick={() => handleSelect(kw)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs inline-flex items-center gap-1',
                  conflict?.conflict
                    ? 'bg-amber-200 dark:bg-amber-900/50 hover:bg-amber-800/60 text-amber-200 border border-amber-700/50'
                    : 'bg-accent hover:bg-accent-foreground/10 text-foreground',
                  'transition-colors cursor-pointer'
                )}
                title={
                  conflict?.conflict
                    ? `Already used by: ${conflict.existingSnippet?.name}`
                    : undefined
                }
              >
                {conflict?.conflict && (
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                )}
                {kw}
              </button>
            )
          })}
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-secondary-foreground transition-colors"
            aria-label="Dismiss suggestions"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}
