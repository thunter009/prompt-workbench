'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'

const DEBOUNCE_MS = 1500
const MIN_TEXT_LENGTH = 10

interface KeywordSuggestionsProps {
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

function deriveStyleGuide(snippets: Array<{ name: string; keyword?: string }>): StyleGuide {
  const examples = snippets
    .filter((s) => s.keyword && s.keyword.trim())
    .map((s) => ({ name: s.name, keyword: s.keyword! }))
    .slice(0, 5)

  // Analyze prefix pattern from existing keywords
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
    // camelCase detection harder, skip for now
  }

  return {
    prefix,
    case: caseType,
    maxLength: 15,
    examples,
  }
}

export function KeywordSuggestions({
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

    try {
      const styleGuide = deriveStyleGuide(snippets)
      const res = await fetch('/api/suggest-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: snippetName,
          text: snippetText,
          styleGuide,
        }),
      })

      const data = await res.json()
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions)
      } else {
        setSuggestions([])
      }
    } catch {
      setError('Could not fetch suggestions')
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [snippetName, snippetText, currentKeyword, dismissed, snippets])

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
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Suggesting...</span>
        </div>
      )}

      {error && (
        <span className="text-xs text-amber-500">{error}</span>
      )}

      {suggestions.length > 0 && (
        <>
          <Sparkles className="h-3 w-3 text-zinc-500" />
          {suggestions.map((kw) => (
            <button
              key={kw}
              onClick={() => handleSelect(kw)}
              className={cn(
                'px-2 py-0.5 rounded-full text-xs',
                'bg-zinc-700 hover:bg-zinc-600 text-zinc-200',
                'transition-colors cursor-pointer'
              )}
            >
              {kw}
            </button>
          ))}
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Dismiss suggestions"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}
