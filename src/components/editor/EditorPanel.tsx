'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Sparkles, X, AlertTriangle } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { KeywordSuggestions } from '@/components/KeywordSuggestions'
import { FolderSuggestions } from '@/components/FolderSuggestions'
import { cn } from '@/lib/utils'
import { checkKeywordConflict, checkKeywordConflicts, type KeywordConflict } from '@/lib/keyword-analysis'

const DEBOUNCE_MS = 500
const MIN_TEXT_LENGTH = 10

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

  let prefix: string | undefined
  const keywords = examples.map((e) => e.keyword)
  if (keywords.length > 0) {
    const firstChars = keywords.map((k) => k[0])
    const allSamePrefix = firstChars.every((c) => c === firstChars[0] && /[!@#]/.test(c))
    if (allSamePrefix) {
      prefix = firstChars[0]
    }
  }

  let caseType: 'lower' | 'upper' | 'camel' | undefined
  if (keywords.length > 0) {
    const allLower = keywords.every((k) => k === k.toLowerCase())
    const allUpper = keywords.every((k) => k === k.toUpperCase())
    if (allLower) caseType = 'lower'
    else if (allUpper) caseType = 'upper'
  }

  return { prefix, case: caseType, maxLength: 15, examples }
}

export interface EditorPanelHeaderProps {
  onScrollProgress?: (progress: number) => void
}

export function EditorPanelHeader() {
  const selectedId = useSnippetStore((s) => s.selectedId)
  const getSelectedSnippet = useSnippetStore((s) => s.getSelectedSnippet)
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const snippets = useSnippetStore((s) => s.snippets)

  const [keywordValue, setKeywordValue] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const snippet = getSelectedSnippet()

  // Check conflict for current keyword input
  const keywordConflict = useMemo<KeywordConflict>(() => {
    if (!keywordValue?.trim()) return { conflict: false }
    return checkKeywordConflict(keywordValue, selectedId ?? undefined)
  }, [keywordValue, selectedId])

  // Check conflicts for popover suggestions
  const suggestionConflicts = useMemo<Map<string, KeywordConflict>>(() => {
    if (suggestions.length === 0) return new Map()
    return checkKeywordConflicts(suggestions, selectedId ?? undefined)
  }, [suggestions, selectedId])

  // Sync keyword from store when selection changes
  useEffect(() => {
    setKeywordValue(snippet?.keyword ?? '')
  }, [selectedId, snippet?.keyword])

  const handleKeywordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setKeywordValue(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      if (selectedId) {
        updateSnippet(selectedId, { keyword: value || undefined })
      }
    }, DEBOUNCE_MS)
  }, [selectedId, updateSnippet])

  const handleSuggestionSelect = useCallback((keyword: string) => {
    setKeywordValue(keyword)
    if (selectedId) {
      updateSnippet(selectedId, { keyword })
    }
    setPopoverOpen(false)
    setSuggestions([])
  }, [selectedId, updateSnippet])

  // Fetch suggestions on-demand
  const fetchSuggestions = useCallback(async () => {
    if (!snippet) return
    if (snippet.text.length < MIN_TEXT_LENGTH) {
      setError('Snippet text too short')
      return
    }

    setLoading(true)
    setError(null)
    setPopoverOpen(true)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const styleGuide = deriveStyleGuide(snippets)
      const res = await fetch('/api/suggest-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: snippet.name,
          text: snippet.text,
          styleGuide,
        }),
        signal: controller.signal,
      })

      const data = await res.json()
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions)
      } else {
        setSuggestions([])
        setError('No suggestions available')
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
  }, [snippet, snippets])

  // ⌘K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Don't trigger if in an input/textarea other than keyword input
        const target = e.target as HTMLElement
        if (target.tagName === 'TEXTAREA') return
        if (target.tagName === 'INPUT' && target.getAttribute('placeholder') !== '!keyword') return

        e.preventDefault()
        if (selectedId && snippet) {
          fetchSuggestions()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedId, snippet, fetchSuggestions])

  // Close popover on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popoverOpen])

  // Close popover on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && popoverOpen) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [popoverOpen])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  if (!selectedId || !snippet) {
    return null
  }

  return (
    <div className="px-4 py-2 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <label htmlFor="keyword-input" className="text-sm text-muted-foreground shrink-0">Keyword</label>
        <div className="relative flex-1 max-w-xs">
          <input
            id="keyword-input"
            type="text"
            value={keywordValue}
            onChange={handleKeywordChange}
            placeholder="!keyword"
            className={cn(
              'w-full bg-accent border rounded px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none',
              keywordConflict.conflict
                ? 'border-amber-600 focus:border-amber-500'
                : 'border-border focus:border-blue-500'
            )}
          />
          {keywordConflict.conflict && (
            <div
              className="absolute right-2 top-1/2 -translate-y-1/2"
              title={`Already used by: ${keywordConflict.existingSnippet?.name}`}
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
          )}
        </div>
        {keywordConflict.conflict && (
          <span className="text-xs text-amber-500 whitespace-nowrap">
            Used by: {keywordConflict.existingSnippet?.name}
          </span>
        )}
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={fetchSuggestions}
            disabled={loading}
            title="Suggest keyword (⌘K)"
            className={cn(
              'p-1.5 rounded transition-colors',
              loading
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-accent text-muted-foreground hover:text-amber-400'
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>

          {/* Popover */}
          {popoverOpen && (
            <div
              ref={popoverRef}
              className="absolute top-full right-0 mt-1 z-50 bg-accent border border-border rounded-lg shadow-xl min-w-[200px] max-w-[280px]"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground font-medium">Keyword Suggestions</span>
                <button
                  onClick={() => setPopoverOpen(false)}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-secondary-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2">
                {loading && (
                  <div className="flex items-center gap-2 py-2 px-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Generating suggestions...</span>
                  </div>
                )}

                {error && !loading && (
                  <p className="py-2 px-1 text-xs text-amber-500">{error}</p>
                )}

                {!loading && suggestions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {suggestions.map((kw) => {
                      const conflict = suggestionConflicts.get(kw)
                      return (
                        <button
                          key={kw}
                          onClick={() => handleSuggestionSelect(kw)}
                          className={cn(
                            'w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between',
                            conflict?.conflict
                              ? 'bg-amber-900/30 hover:bg-amber-800/40 text-amber-200'
                              : 'bg-accent/50 hover:bg-accent-foreground/10 text-foreground',
                            'transition-colors cursor-pointer'
                          )}
                          title={
                            conflict?.conflict
                              ? `Already used by: ${conflict.existingSnippet?.name}`
                              : undefined
                          }
                        >
                          <span>{kw}</span>
                          {conflict?.conflict && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <KeywordSuggestions
        snippetId={selectedId}
        snippetName={snippet.name}
        snippetText={snippet.text}
        currentKeyword={keywordValue}
        onSelect={handleSuggestionSelect}
      />
      <FolderSuggestions
        snippetId={selectedId}
        snippetName={snippet.name}
        snippetText={snippet.text}
        currentFolderId={snippet.folderId}
      />
    </div>
  )
}
