'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Command } from 'cmdk'
import { Search, FileText, Tag, Hash, Clock, Folder, FolderTree } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { useFuzzySearch, highlightMatches, type SearchResult, type FolderFilter } from '@/hooks/useFuzzySearch'
import type { Snippet } from '@/types'

interface SearchPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect?: (snippetId: string) => void
}

// Render text with highlighted matches
function HighlightedText({ text, indices }: { text: string; indices: [number, number][] }) {
  const parts = highlightMatches(text, indices)
  return (
    <>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

// Truncate content match to show context around the match
function truncateContentMatch(text: string, indices: [number, number][]): { text: string; indices: [number, number][] } {
  if (!indices.length || text.length < 100) return { text, indices }

  const firstMatch = indices[0]
  const start = Math.max(0, firstMatch[0] - 30)
  const end = Math.min(text.length, firstMatch[1] + 70)

  const truncated = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
  const offset = start > 0 ? start - 3 : 0

  // Adjust indices for the truncation
  const adjustedIndices = indices
    .filter(([s, e]) => s >= start && e <= end)
    .map(([s, e]): [number, number] => [s - offset, e - offset])

  return { text: truncated, indices: adjustedIndices }
}

const SEARCH_SETTINGS_KEY = 'prompt-workbench-search-settings'

export function SearchPalette({ open, onOpenChange, onSelect }: SearchPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const snippets = useSnippetStore((s) => s.snippets)
  const selectSnippet = useSnippetStore((s) => s.selectSnippet)
  const getRecentSnippets = useSnippetStore((s) => s.getRecentSnippets)
  const searchSettings = useSnippetStore((s) => s.searchSettings)
  const setSearchSettings = useSnippetStore((s) => s.setSearchSettings)
  const getCurrentFolderContext = useSnippetStore((s) => s.getCurrentFolderContext)
  const getSubfolderIds = useSnippetStore((s) => s.getSubfolderIds)
  const listRef = useRef<HTMLDivElement>(null)
  const [settingsInitialized, setSettingsInitialized] = useState(false)

  // Initialize search settings from localStorage
  useEffect(() => {
    if (settingsInitialized) return
    try {
      const stored = localStorage.getItem(SEARCH_SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.scopeToCurrentFolder === 'boolean') {
          setSearchSettings({ scopeToCurrentFolder: parsed.scopeToCurrentFolder })
        }
      }
    } catch {
      // ignore parse errors
    }
    setSettingsInitialized(true)
  }, [settingsInitialized, setSearchSettings])

  // Persist search settings to localStorage
  useEffect(() => {
    if (!settingsInitialized) return
    localStorage.setItem(SEARCH_SETTINGS_KEY, JSON.stringify(searchSettings))
  }, [searchSettings, settingsInitialized])

  // Get current folder context
  const { folderId: currentFolderId, folderName: currentFolderName } = getCurrentFolderContext()
  const hasCurrentFolder = currentFolderId !== null

  // Build folder filter when scoping is enabled and we have a folder
  const folderFilter: FolderFilter | undefined = useMemo(() => {
    if (!searchSettings.scopeToCurrentFolder || !currentFolderId) return undefined
    return {
      folderId: currentFolderId,
      includeSubfolders: true,
      getSubfolderIds,
    }
  }, [searchSettings.scopeToCurrentFolder, currentFolderId, getSubfolderIds])

  const results = useFuzzySearch(snippets, search, folderFilter)
  const recentSnippets = getRecentSnippets(5)

  // Determine which items to navigate: search results or recent snippets
  const isShowingRecent = search.trim() === '' && recentSnippets.length > 0
  const activeItemCount = isShowingRecent ? recentSnippets.length : results.length

  // Reset search and selection on close
  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [open])

  // Reset selection to first when results or recent change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results, isShowingRecent])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list || activeItemCount === 0) return
    const items = list.querySelectorAll('[data-search-item]')
    const selectedItem = items[selectedIndex] as HTMLElement | undefined
    selectedItem?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, activeItemCount])

  const handleSelect = useCallback(
    (snippetId: string) => {
      selectSnippet(snippetId)
      onSelect?.(snippetId)
      onOpenChange(false)
    },
    [selectSnippet, onSelect, onOpenChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
        return
      }

      if (activeItemCount === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % activeItemCount)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + activeItemCount) % activeItemCount)
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            setSelectedIndex((i) => (i - 1 + activeItemCount) % activeItemCount)
          } else {
            setSelectedIndex((i) => (i + 1) % activeItemCount)
          }
          break
        case 'Enter':
          e.preventDefault()
          if (isShowingRecent) {
            const snippet = recentSnippets[selectedIndex]
            if (snippet) handleSelect(snippet.id)
          } else if (results[selectedIndex]) {
            handleSelect(results[selectedIndex].snippet.id)
          }
          break
      }
    },
    [activeItemCount, isShowingRecent, recentSnippets, results, selectedIndex, onOpenChange, handleSelect]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" />

      {/* Dialog */}
      <Command
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        shouldFilter={false}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-zinc-700">
          <Search className="w-5 h-5 text-zinc-500 shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search snippets..."
            autoFocus
            className="flex-1 h-12 bg-transparent text-zinc-100 placeholder:text-zinc-500 outline-none text-base"
          />
          {search && (
            <span className="text-xs text-zinc-500">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Results */}
        <Command.List ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {search.trim() === '' ? (
            recentSnippets.length > 0 ? (
              <Command.Group heading="Recent" className="text-xs font-medium text-zinc-500 px-2 py-1.5">
                {recentSnippets.map((snippet, index) => (
                  <RecentSnippetItem
                    key={snippet.id}
                    snippet={snippet}
                    selected={index === selectedIndex}
                    onSelect={() => handleSelect(snippet.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  />
                ))}
              </Command.Group>
            ) : (
              <div className="py-8 text-center text-sm text-zinc-500">
                Type to search snippets by name, content, keyword, or tags
              </div>
            )
          ) : results.length === 0 ? (
            <Command.Empty className="py-8 text-center text-sm text-zinc-500">
              No snippets found for &quot;{search}&quot;
            </Command.Empty>
          ) : (
            <Command.Group heading="Snippets" className="text-xs font-medium text-zinc-500 px-2 py-1.5">
              {results.map((result, index) => (
                <SearchResultItem
                  key={result.snippet.id}
                  result={result}
                  selected={index === selectedIndex}
                  onSelect={() => handleSelect(result.snippet.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                />
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer with folder scope toggle */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-700 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-medium">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-medium">↵</kbd> open
            </span>
          </div>
          <button
            onClick={() => setSearchSettings({ scopeToCurrentFolder: !searchSettings.scopeToCurrentFolder })}
            disabled={!hasCurrentFolder}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
              hasCurrentFolder
                ? searchSettings.scopeToCurrentFolder
                  ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/40'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                : 'opacity-50 cursor-not-allowed'
            }`}
            title={hasCurrentFolder
              ? `Search in "${currentFolderName}" folder${searchSettings.scopeToCurrentFolder ? ' (on)' : ' (off)'}`
              : 'Select a snippet or folder to scope search'
            }
          >
            {searchSettings.scopeToCurrentFolder ? (
              <Folder className="w-3.5 h-3.5" />
            ) : (
              <FolderTree className="w-3.5 h-3.5" />
            )}
            {searchSettings.scopeToCurrentFolder && currentFolderName ? (
              <span className="max-w-[120px] truncate">{currentFolderName}</span>
            ) : (
              <span>All folders</span>
            )}
          </button>
        </div>
      </Command>
    </div>
  )
}

// Individual search result item
function SearchResultItem({
  result,
  selected,
  onSelect,
  onMouseEnter,
}: {
  result: SearchResult
  selected: boolean
  onSelect: () => void
  onMouseEnter: () => void
}) {
  const { snippet, matches } = result

  // Find name match for highlighting
  const nameMatch = matches.find((m) => m.key === 'name')
  const keywordMatch = matches.find((m) => m.key === 'keyword')
  const tagsMatch = matches.find((m) => m.key?.startsWith('tags'))
  const contentMatch = matches.find((m) => m.key === 'text')

  return (
    <div
      data-search-item
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={`flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer text-zinc-300 ${
        selected ? 'bg-zinc-800 text-zinc-100' : ''
      }`}
    >
      {/* Top row: icon + name + keyword */}
      <div className="flex items-center gap-2.5">
        <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">
          {nameMatch ? (
            <HighlightedText text={snippet.name} indices={nameMatch.indices} />
          ) : (
            snippet.name
          )}
        </span>
        {snippet.keyword && (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <Hash className="w-3 h-3" />
            {keywordMatch ? (
              <HighlightedText text={snippet.keyword} indices={keywordMatch.indices} />
            ) : (
              snippet.keyword
            )}
          </span>
        )}
      </div>

      {/* Content preview if matched */}
      {contentMatch && (
        <div className="ml-6.5 text-xs text-zinc-500 truncate">
          {(() => {
            const { text, indices } = truncateContentMatch(contentMatch.value, contentMatch.indices)
            return <HighlightedText text={text} indices={indices} />
          })()}
        </div>
      )}

      {/* Tags row if matched or present */}
      {(tagsMatch || snippet.tags.length > 0) && (
        <div className="ml-6.5 flex items-center gap-1.5 flex-wrap">
          <Tag className="w-3 h-3 text-zinc-600" />
          {snippet.tags.slice(0, 4).map((tag, i) => {
            // Check if this specific tag was matched
            const tagMatch = matches.find((m) => m.key === `tags.${i}`)
            return (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400"
              >
                {tagMatch ? (
                  <HighlightedText text={tag} indices={tagMatch.indices} />
                ) : (
                  tag
                )}
              </span>
            )
          })}
          {snippet.tags.length > 4 && (
            <span className="text-xs text-zinc-600">+{snippet.tags.length - 4}</span>
          )}
        </div>
      )}
    </div>
  )
}

// Recent snippet item (simpler than search result - no highlights)
function RecentSnippetItem({
  snippet,
  selected,
  onSelect,
  onMouseEnter,
}: {
  snippet: Snippet
  selected: boolean
  onSelect: () => void
  onMouseEnter: () => void
}) {
  return (
    <div
      data-search-item
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={`flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer text-zinc-300 ${
        selected ? 'bg-zinc-800 text-zinc-100' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">{snippet.name}</span>
        {snippet.keyword && (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <Hash className="w-3 h-3" />
            {snippet.keyword}
          </span>
        )}
      </div>
    </div>
  )
}
