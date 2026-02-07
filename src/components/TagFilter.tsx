'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { X } from 'lucide-react'

export function TagFilter() {
  const snippets = useSnippetStore((s) => s.snippets)
  const selectedTags = useSnippetStore((s) => s.selectedTags)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of snippets) {
      for (const t of s.tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  }, [snippets])
  const tagFilterMode = useSnippetStore((s) => s.tagFilterMode)
  const toggleTagFilter = useSnippetStore((s) => s.toggleTagFilter)
  const clearTagFilter = useSnippetStore((s) => s.clearTagFilter)
  const setTagFilterMode = useSnippetStore((s) => s.setTagFilterMode)

  if (allTags.length === 0) return null

  return (
    <div data-testid="tag-filter" className="px-3 py-2 border-b border-border">
      <div className="flex flex-wrap gap-1">
        {allTags.map((tag) => {
          const isActive = selectedTags.includes(tag)
          return (
            <button
              key={tag}
              data-testid="tag-pill"
              data-tag={tag}
              onClick={() => toggleTagFilter(tag)}
              className={cn(
                'px-2 py-0.5 rounded-full text-xs transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-accent text-muted-foreground hover:bg-accent hover:text-secondary-foreground'
              )}
            >
              {tag}
            </button>
          )
        })}
      </div>
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 mt-1.5">
          <button
            data-testid="tag-filter-mode"
            onClick={() => setTagFilterMode(tagFilterMode === 'or' ? 'and' : 'or')}
            className="text-xs text-muted-foreground hover:text-secondary-foreground transition-colors"
          >
            {tagFilterMode === 'or' ? 'ANY' : 'ALL'}
          </button>
          <button
            data-testid="tag-filter-clear"
            onClick={clearTagFilter}
            className="text-xs text-muted-foreground hover:text-secondary-foreground transition-colors flex items-center gap-0.5"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}
    </div>
  )
}
