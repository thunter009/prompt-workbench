import { useMemo } from 'react'
import Fuse, { type FuseResult, type FuseResultMatch, type IFuseOptions } from 'fuse.js'
import type { Snippet } from '@/types'

const MAX_RESULTS = 20

// Search weights: name > keyword > tags > content
const FUSE_OPTIONS: IFuseOptions<Snippet> = {
  keys: [
    { name: 'name', weight: 1.0 },
    { name: 'keyword', weight: 0.8 },
    { name: 'tags', weight: 0.6 },
    { name: 'text', weight: 0.4 },
  ],
  includeScore: true,
  includeMatches: true,
  threshold: 0.4, // fuzzy tolerance (0 = exact, 1 = match anything)
  ignoreLocation: true, // match anywhere in string
  minMatchCharLength: 2,
}

export interface SearchMatch {
  key: string // which field matched
  value: string // the matched value
  indices: [number, number][] // start/end pairs for highlighting
}

export interface SearchResult {
  snippet: Snippet
  score: number // 0 is perfect match, higher is worse
  matches: SearchMatch[]
}

export function useFuzzySearch(snippets: Snippet[], query: string): SearchResult[] {
  const fuse = useMemo(() => new Fuse(snippets, FUSE_OPTIONS), [snippets])

  const results = useMemo(() => {
    if (!query.trim()) return []

    const fuseResults = fuse.search(query, { limit: MAX_RESULTS })

    return fuseResults.map((result: FuseResult<Snippet>): SearchResult => ({
      snippet: result.item,
      score: result.score ?? 0,
      matches: (result.matches ?? []).map((match: FuseResultMatch): SearchMatch => ({
        key: match.key ?? '',
        value: match.value ?? '',
        indices: match.indices as [number, number][],
      })),
    }))
  }, [fuse, query])

  return results
}

// Utility to highlight matched text
export function highlightMatches(
  text: string,
  indices: [number, number][]
): { text: string; highlighted: boolean }[] {
  if (!indices.length) return [{ text, highlighted: false }]

  const parts: { text: string; highlighted: boolean }[] = []
  let lastIndex = 0

  // Sort indices by start position
  const sorted = [...indices].sort((a, b) => a[0] - b[0])

  for (const [start, end] of sorted) {
    // Add non-highlighted text before this match
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), highlighted: false })
    }
    // Add highlighted match (end is inclusive in fuse.js)
    parts.push({ text: text.slice(start, end + 1), highlighted: true })
    lastIndex = end + 1
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlighted: false })
  }

  return parts
}
