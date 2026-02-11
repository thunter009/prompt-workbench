'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Search, X, FileText, CaseSensitive, Regex } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'

interface MatchLine {
  lineNumber: number
  text: string
  matchRanges: [number, number][] // start/end pairs within the line
}

interface SnippetMatch {
  snippetId: string
  snippetName: string
  lines: MatchLine[]
}

interface CrossSnippetSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function searchSnippets(
  snippets: { id: string; name: string; text: string }[],
  query: string,
  caseSensitive: boolean,
  useRegex: boolean,
): SnippetMatch[] {
  if (!query) return []

  let regex: RegExp
  try {
    const flags = caseSensitive ? 'g' : 'gi'
    regex = useRegex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags)
  } catch {
    return [] // invalid regex
  }

  const results: SnippetMatch[] = []

  for (const snippet of snippets) {
    const lines = snippet.text.split('\n')
    const matchingLines: MatchLine[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const ranges: [number, number][] = []

      let match: RegExpExecArray | null
      regex.lastIndex = 0
      while ((match = regex.exec(line)) !== null) {
        ranges.push([match.index, match.index + match[0].length])
        if (match[0].length === 0) { regex.lastIndex++; break } // prevent infinite loop on zero-length match
      }

      if (ranges.length > 0) {
        matchingLines.push({ lineNumber: i + 1, text: line, matchRanges: ranges })
      }
    }

    if (matchingLines.length > 0) {
      results.push({
        snippetId: snippet.id,
        snippetName: snippet.name,
        lines: matchingLines,
      })
    }
  }

  return results
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightedLine({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: { text: string; highlight: boolean }[] = []
  let last = 0
  for (const [start, end] of ranges) {
    if (start > last) parts.push({ text: text.slice(last, start), highlight: false })
    parts.push({ text: text.slice(start, end), highlight: true })
    last = end
  }
  if (last < text.length) parts.push({ text: text.slice(last), highlight: false })

  return (
    <span className="break-all">
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded-sm px-0.5">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  )
}

export function CrossSnippetSearch({ open, onOpenChange }: CrossSnippetSearchProps) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const snippets = useSnippetStore((s) => s.snippets)
  const selectSnippet = useSnippetStore((s) => s.selectSnippet)

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const results = useMemo(
    () => searchSnippets(snippets, debouncedQuery, caseSensitive, useRegex),
    [snippets, debouncedQuery, caseSensitive, useRegex],
  )

  // Flatten for keyboard navigation: each line is a navigable item
  const flatItems = useMemo(() => {
    const items: { snippetId: string; lineNumber: number; lineIndex: number; resultIndex: number }[] = []
    for (let ri = 0; ri < results.length; ri++) {
      for (let li = 0; li < results[ri].lines.length; li++) {
        items.push({
          snippetId: results[ri].snippetId,
          lineNumber: results[ri].lines[li].lineNumber,
          lineIndex: li,
          resultIndex: ri,
        })
      }
    }
    return items
  }, [results])

  const totalMatches = useMemo(
    () => results.reduce((sum, r) => sum + r.lines.reduce((s, l) => s + l.matchRanges.length, 0), 0),
    [results],
  )

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
      setDebouncedQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0) }, [results])

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current
    if (!list || flatItems.length === 0) return
    const items = list.querySelectorAll('[data-result-item]')
    const el = items[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, flatItems.length])

  const handleSelect = useCallback((snippetId: string) => {
    selectSnippet(snippetId)
    onOpenChange(false)
  }, [selectSnippet, onOpenChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
      return
    }
    if (flatItems.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          handleSelect(flatItems[selectedIndex].snippetId)
        }
        break
    }
  }, [flatItems, selectedIndex, onOpenChange, handleSelect])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" />

      <div
        className="relative w-full max-w-2xl mx-4 bg-muted border border-border rounded-xl shadow-2xl overflow-hidden animate-modal-in flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all snippets..."
            autoFocus
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          <button
            onClick={() => setCaseSensitive((v) => !v)}
            className={cn(
              'p-1 rounded transition-colors',
              caseSensitive ? 'bg-blue-600/30 text-blue-300' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
            title="Case sensitive"
          >
            <CaseSensitive className="w-4 h-4" />
          </button>
          <button
            onClick={() => setUseRegex((v) => !v)}
            className={cn(
              'p-1 rounded transition-colors',
              useRegex ? 'bg-blue-600/30 text-blue-300' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
            title="Use regex"
          >
            <Regex className="w-4 h-4" />
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {debouncedQuery && results.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No matches found
            </div>
          ) : results.length > 0 ? (
            <div className="py-1">
              {results.map((result) => {
                // Find starting flat index for this result's lines
                let flatStart = 0
                for (const r of results) {
                  if (r === result) break
                  flatStart += r.lines.length
                }

                return (
                  <div key={result.snippetId} className="mb-1">
                    {/* Snippet name header */}
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground sticky top-0 bg-muted/95 backdrop-blur-sm">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="font-medium truncate">{result.snippetName}</span>
                      <span className="ml-auto">{result.lines.reduce((s, l) => s + l.matchRanges.length, 0)} match{result.lines.reduce((s, l) => s + l.matchRanges.length, 0) !== 1 ? 'es' : ''}</span>
                    </div>
                    {/* Match lines */}
                    {result.lines.map((line, li) => {
                      const fi = flatStart + li
                      return (
                        <div
                          key={`${result.snippetId}-${line.lineNumber}`}
                          data-result-item
                          onClick={() => handleSelect(result.snippetId)}
                          className={cn(
                            'flex items-start gap-3 px-4 py-1 cursor-pointer text-sm font-mono transition-colors',
                            fi === selectedIndex ? 'bg-blue-600/20 text-blue-200' : 'hover:bg-accent/50 text-secondary-foreground',
                          )}
                        >
                          <span className="text-xs text-muted-foreground w-8 text-right shrink-0 pt-0.5 select-none">
                            {line.lineNumber}
                          </span>
                          <span className="truncate text-xs">
                            <HighlightedLine text={line.text} ranges={line.matchRanges} />
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : !debouncedQuery ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Search across all snippet contents
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">↵</kbd> open
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">esc</kbd> close
            </span>
          </div>
          {debouncedQuery && results.length > 0 && (
            <span>{totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {results.length} snippet{results.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
