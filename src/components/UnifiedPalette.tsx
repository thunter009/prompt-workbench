'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command as CmdkRoot } from 'cmdk'
import { useShallow } from 'zustand/react/shallow'
import Fuse from 'fuse.js'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  FileText,
  Folder,
  FolderPlus,
  FolderTree,
  Hash,
  Loader2,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { useMethodologyStore } from '@/lib/folder-methodology'
import { useFuzzySearch, highlightMatches, type FolderFilter, type SearchResult } from '@/hooks/useFuzzySearch'
import { checkKeywordConflicts, type KeywordConflict } from '@/lib/keyword-analysis'
import { SECTION_ORDER, type Command, type CommandSection } from '@/lib/commands'
import type { Snippet } from '@/types'

type FuseMatch = { indices: readonly [number, number][]; key?: string }

type PaletteMode = 'snippet' | 'command' | 'content' | 'ai'

interface FolderSuggestion {
  folder: string
  confidence: number
}

interface MatchLine {
  lineNumber: number
  text: string
  matchRanges: [number, number][]
}

interface SnippetContentMatch {
  snippetId: string
  snippetName: string
  lines: MatchLine[]
}

interface StyleGuide {
  prefix?: string
  maxLength?: number
  case?: 'lower' | 'upper' | 'camel'
  examples: Array<{ name: string; keyword: string }>
}

interface AIAction {
  id: string
  label: string
  description: string
  run: () => void | Promise<void>
}

interface UnifiedPaletteProps {
  open: boolean
  initialQuery: string
  onOpenChange: (open: boolean) => void
  commands: Command[]
  onImprovePrompt: () => void
  onOpenReorganize: () => void
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function searchSnippetContent(snippets: Snippet[], query: string): SnippetContentMatch[] {
  if (!query.trim()) return []

  const regex = new RegExp(escapeRegex(query), 'gi')
  const results: SnippetContentMatch[] = []

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
        if (match[0].length === 0) {
          regex.lastIndex++
          break
        }
      }

      if (ranges.length > 0) {
        matchingLines.push({
          lineNumber: i + 1,
          text: line,
          matchRanges: ranges,
        })
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

  return {
    prefix,
    case: caseType,
    maxLength: 15,
    examples,
  }
}

function HighlightedText({ text, indices }: { text: string; indices: [number, number][] }) {
  const parts = highlightMatches(text, indices)

  return (
    <>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-200 rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

function HighlightedLabel({ text, matches }: { text: string; matches?: readonly FuseMatch[] }) {
  const labelMatch = matches?.find((m) => m.key === 'label')
  if (!labelMatch) return <span className="text-sm flex-1">{text}</span>

  const chars = text.split('')
  const highlighted = new Set<number>()
  for (const [start, end] of labelMatch.indices) {
    for (let i = start; i <= end; i++) highlighted.add(i)
  }

  const spans: { text: string; match: boolean }[] = []
  for (let i = 0; i < chars.length; i++) {
    const isMatch = highlighted.has(i)
    const last = spans[spans.length - 1]
    if (last && last.match === isMatch) {
      last.text += chars[i]
    } else {
      spans.push({ text: chars[i], match: isMatch })
    }
  }

  return (
    <span className="text-sm flex-1">
      {spans.map((segment, i) =>
        segment.match ? (
          <mark key={i} className="bg-transparent text-blue-600 dark:text-blue-300 font-semibold">{segment.text}</mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </span>
  )
}

function truncateContentMatch(text: string, indices: [number, number][]): { text: string; indices: [number, number][] } {
  if (!indices.length || text.length < 100) return { text, indices }

  const firstMatch = indices[0]
  const start = Math.max(0, firstMatch[0] - 30)
  const end = Math.min(text.length, firstMatch[1] + 70)

  const truncated = `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`
  const offset = start > 0 ? start - 3 : 0

  const adjustedIndices = indices
    .filter(([s, e]) => s >= start && e <= end)
    .map(([s, e]): [number, number] => [s - offset, e - offset])

  return { text: truncated, indices: adjustedIndices }
}

function HighlightedLine({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: { text: string; highlight: boolean }[] = []
  let last = 0

  for (const [start, end] of ranges) {
    if (start > last) {
      parts.push({ text: text.slice(last, start), highlight: false })
    }
    parts.push({ text: text.slice(start, end), highlight: true })
    last = end
  }

  if (last < text.length) {
    parts.push({ text: text.slice(last), highlight: false })
  }

  return (
    <span className="break-all">
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded-sm px-0.5">{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  )
}

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
  const nameMatch = matches.find((m) => m.key === 'name')
  const keywordMatch = matches.find((m) => m.key === 'keyword')
  const tagsMatch = matches.find((m) => m.key?.startsWith('tags'))
  const contentMatch = matches.find((m) => m.key === 'text')

  return (
    <div
      data-palette-item
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer text-secondary-foreground transition-colors',
        selected ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50'
      )}
    >
      <div className="flex items-center gap-2.5">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium truncate" title={snippet.name}>
          {nameMatch ? <HighlightedText text={snippet.name} indices={nameMatch.indices} /> : snippet.name}
        </span>
        {snippet.keyword && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Hash className="w-3 h-3" />
            {keywordMatch ? (
              <HighlightedText text={snippet.keyword} indices={keywordMatch.indices} />
            ) : (
              snippet.keyword
            )}
          </span>
        )}
      </div>

      {contentMatch && (
        <div className="ml-6.5 text-xs text-muted-foreground truncate">
          {(() => {
            const { text, indices } = truncateContentMatch(contentMatch.value, contentMatch.indices)
            return <HighlightedText text={text} indices={indices} />
          })()}
        </div>
      )}

      {(tagsMatch || snippet.tags.length > 0) && (
        <div className="ml-6.5 flex items-center gap-1.5 flex-wrap">
          <Tag className="w-3 h-3 text-muted-foreground" />
          {snippet.tags.slice(0, 4).map((tag, i) => {
            const tagMatch = matches.find((m) => m.key === `tags.${i}`)
            return (
              <span key={i} className="text-xs px-1.5 py-0.5 bg-accent rounded text-muted-foreground">
                {tagMatch ? <HighlightedText text={tag} indices={tagMatch.indices} /> : tag}
              </span>
            )
          })}
          {snippet.tags.length > 4 && (
            <span className="text-xs text-muted-foreground">+{snippet.tags.length - 4}</span>
          )}
        </div>
      )}
    </div>
  )
}

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
      data-palette-item
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer text-secondary-foreground transition-colors',
        selected ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50'
      )}
    >
      <div className="flex items-center gap-2.5">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium truncate" title={snippet.name}>{snippet.name}</span>
        {snippet.keyword && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Hash className="w-3 h-3" />
            {snippet.keyword}
          </span>
        )}
      </div>
    </div>
  )
}

export function UnifiedPalette({
  open,
  initialQuery,
  onOpenChange,
  commands,
  onImprovePrompt,
  onOpenReorganize,
}: UnifiedPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [keywordSuggestions, setKeywordSuggestions] = useState<string[] | null>(null)
  const [folderSuggestions, setFolderSuggestions] = useState<FolderSuggestion[] | null>(null)
  const [aiLoading, setAiLoading] = useState<'keyword' | 'folder' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const {
    snippets,
    folders,
    selectedId,
    searchSettings,
    getCurrentFolderContext,
    getSubfolderIds,
  } = useSnippetStore(
    useShallow((s) => ({
      snippets: s.snippets,
      folders: s.folders,
      selectedId: s.selectedId,
      searchSettings: s.searchSettings,
      getCurrentFolderContext: s.getCurrentFolderContext,
      getSubfolderIds: s.getSubfolderIds,
    }))
  )
  const selectSnippet = useSnippetStore((s) => s.selectSnippet)
  const getRecentSnippets = useSnippetStore((s) => s.getRecentSnippets)
  const setSearchSettings = useSnippetStore((s) => s.setSearchSettings)
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const createFolder = useSnippetStore((s) => s.createFolder)
  const moveSnippetsToFolder = useSnippetStore((s) => s.moveSnippetsToFolder)

  const { ollamaUrl, ollamaModel } = useAISettingsStore(
    useShallow((s) => ({
      ollamaUrl: s.ollamaUrl,
      ollamaModel: s.ollamaModel,
    }))
  )
  const methodologyConfig = useMethodologyStore((s) => s.config)

  const selectedSnippet = useMemo(
    () => snippets.find((s) => s.id === selectedId),
    [snippets, selectedId]
  )

  const keywordSuggestionConflicts = useMemo<Map<string, KeywordConflict>>(
    () => (keywordSuggestions && keywordSuggestions.length > 0 ? checkKeywordConflicts(keywordSuggestions, selectedId ?? undefined) : new Map()),
    [keywordSuggestions, selectedId]
  )

  const normalized = query.trimStart()
  const mode: PaletteMode = useMemo(() => {
    if (/^>ai(?:\s|$)/i.test(normalized)) return 'ai'
    if (normalized.startsWith('>')) return 'command'
    if (normalized.startsWith('/')) return 'content'
    return 'snippet'
  }, [normalized])

  const commandQuery = mode === 'command' ? normalized.slice(1).trim() : ''
  const contentQuery = mode === 'content' ? normalized.slice(1).trim() : ''
  const aiQuery = mode === 'ai' ? normalized.replace(/^>ai\s*/i, '').trim() : ''

  const { folderId: currentFolderId, folderName: currentFolderName } = getCurrentFolderContext()
  const hasCurrentFolder = currentFolderId !== null

  const folderFilter: FolderFilter | undefined = useMemo(() => {
    if (mode !== 'snippet') return undefined
    if (!searchSettings.scopeToCurrentFolder || !currentFolderId) return undefined
    return {
      folderId: currentFolderId,
      includeSubfolders: true,
      getSubfolderIds,
    }
  }, [mode, searchSettings.scopeToCurrentFolder, currentFolderId, getSubfolderIds])

  const snippetResults = useFuzzySearch(snippets, mode === 'snippet' ? query : '', folderFilter)
  const recentSnippets = getRecentSnippets(5)

  const visibleCommands = useMemo(() => commands.filter((c) => !c.disabled), [commands])
  const commandFuse = useMemo(
    () => new Fuse(visibleCommands, {
      keys: ['label'],
      threshold: 0.4,
      includeMatches: true,
      ignoreLocation: true,
    }),
    [visibleCommands]
  )

  const { commandResults, commandMatchMap } = useMemo(() => {
    if (mode !== 'command') {
      return { commandResults: [] as Command[], commandMatchMap: new Map<string, readonly FuseMatch[]>() }
    }
    if (!commandQuery) {
      return { commandResults: visibleCommands, commandMatchMap: new Map<string, readonly FuseMatch[]>() }
    }
    const results = commandFuse.search(commandQuery)
    const map = new Map<string, readonly FuseMatch[]>()
    for (const result of results) {
      if (result.matches) {
        map.set(result.item.id, result.matches as readonly FuseMatch[])
      }
    }
    return {
      commandResults: results.map((r) => r.item),
      commandMatchMap: map,
    }
  }, [mode, commandQuery, visibleCommands, commandFuse])

  const commandSections = useMemo(() => {
    if (mode !== 'command' || commandQuery) return [] as Array<{ section: CommandSection; commands: Command[] }>
    const groups = new Map<CommandSection, Command[]>()
    for (const command of commandResults) {
      const sectionCommands = groups.get(command.section) ?? []
      sectionCommands.push(command)
      groups.set(command.section, sectionCommands)
    }
    return SECTION_ORDER
      .filter((section) => groups.has(section))
      .map((section) => ({ section, commands: groups.get(section)! }))
  }, [mode, commandQuery, commandResults])

  const contentResults = useMemo(
    () => (mode === 'content' ? searchSnippetContent(snippets, contentQuery) : []),
    [mode, snippets, contentQuery]
  )

  const flatContentItems = useMemo(() => {
    const items: Array<{ snippetId: string; lineNumber: number }> = []
    for (const result of contentResults) {
      for (const line of result.lines) {
        items.push({ snippetId: result.snippetId, lineNumber: line.lineNumber })
      }
    }
    return items
  }, [contentResults])

  const totalContentMatches = useMemo(
    () => contentResults.reduce((sum, result) => sum + result.lines.reduce((lineSum, line) => lineSum + line.matchRanges.length, 0), 0),
    [contentResults]
  )

  const resetAISuggestions = useCallback(() => {
    setKeywordSuggestions(null)
    setFolderSuggestions(null)
    setAiLoading(null)
    setAiError(null)
  }, [])

  const openSnippet = useCallback((snippetId: string) => {
    selectSnippet(snippetId)
    onOpenChange(false)
  }, [selectSnippet, onOpenChange])

  const fetchKeywordSuggestions = useCallback(async () => {
    if (!selectedSnippet) {
      setAiError('Select a snippet first')
      return
    }
    if (selectedSnippet.text.length < 10) {
      setAiError('Snippet text too short')
      return
    }

    setAiLoading('keyword')
    setAiError(null)
    setKeywordSuggestions(null)
    setFolderSuggestions(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const styleGuide = deriveStyleGuide(snippets)
      const response = await fetch('/api/suggest-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedSnippet.name,
          text: selectedSnippet.text,
          styleGuide,
          ollamaUrl,
          model: ollamaModel,
        }),
        signal: controller.signal,
      })

      const data = await response.json() as { suggestions?: string[] }
      if (data.suggestions && data.suggestions.length > 0) {
        setKeywordSuggestions(data.suggestions)
      } else {
        setAiError('No keyword suggestions available')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAiError('Request timed out. Is Ollama running?')
      } else {
        setAiError(`Could not fetch keyword suggestions: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    } finally {
      clearTimeout(timeout)
      setAiLoading(null)
    }
  }, [selectedSnippet, snippets, ollamaUrl, ollamaModel])

  const fetchFolderSuggestions = useCallback(async () => {
    if (!selectedSnippet) {
      setAiError('Select a snippet first')
      return
    }
    if (selectedSnippet.text.length < 30) {
      setAiError('Snippet text too short')
      return
    }

    setAiLoading('folder')
    setAiError(null)
    setKeywordSuggestions(null)
    setFolderSuggestions(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch('/api/suggest-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snippet: { name: selectedSnippet.name, text: selectedSnippet.text },
          existingFolders: folders.map((folder) => folder.name),
          ollamaUrl,
          model: ollamaModel,
          methodology: methodologyConfig,
        }),
        signal: controller.signal,
      })

      const data = await response.json() as { suggestions?: FolderSuggestion[] }
      if (data.suggestions && data.suggestions.length > 0) {
        setFolderSuggestions(data.suggestions)
      } else {
        setAiError('No folder suggestions available')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAiError('Request timed out. Is Ollama running?')
      } else {
        setAiError(`Could not fetch folder suggestions: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    } finally {
      clearTimeout(timeout)
      setAiLoading(null)
    }
  }, [selectedSnippet, folders, ollamaUrl, ollamaModel, methodologyConfig])

  const applyKeywordSuggestion = useCallback((keyword: string) => {
    if (!selectedSnippet) return
    updateSnippet(selectedSnippet.id, { keyword })
    onOpenChange(false)
  }, [selectedSnippet, updateSnippet, onOpenChange])

  const applyFolderSuggestion = useCallback((suggestion: FolderSuggestion) => {
    if (!selectedSnippet) return
    const existing = folders.find(
      (folder) => folder.name.toLowerCase() === suggestion.folder.toLowerCase()
    )
    if (existing) {
      moveSnippetsToFolder([selectedSnippet.id], existing.id)
    } else {
      const created = createFolder({ name: suggestion.folder })
      moveSnippetsToFolder([selectedSnippet.id], created.id)
    }
    onOpenChange(false)
  }, [selectedSnippet, folders, createFolder, moveSnippetsToFolder, onOpenChange])

  const aiActions = useMemo(() => {
    const actions: AIAction[] = []

    if (selectedSnippet && !selectedSnippet.keyword?.trim()) {
      actions.push({
        id: 'ai-suggest-keyword',
        label: 'Suggest keyword',
        description: 'Generate keyword suggestions',
        run: fetchKeywordSuggestions,
      })
    }

    if (selectedSnippet && !selectedSnippet.folderId) {
      actions.push({
        id: 'ai-suggest-folder',
        label: 'Suggest folder',
        description: 'Generate folder suggestions',
        run: fetchFolderSuggestions,
      })
    }

    if (selectedSnippet && selectedSnippet.text.trim().length >= 20) {
      actions.push({
        id: 'ai-improve-prompt',
        label: 'Improve prompt',
        description: 'Rewrite prompt for clarity',
        run: () => {
          onImprovePrompt()
          onOpenChange(false)
        },
      })
    }

    actions.push({
      id: 'ai-reorganize-folders',
      label: 'Reorganize folders',
      description: 'Batch folder suggestions',
      run: () => {
        onOpenReorganize()
        onOpenChange(false)
      },
    })

    return actions
  }, [selectedSnippet, fetchKeywordSuggestions, fetchFolderSuggestions, onImprovePrompt, onOpenReorganize, onOpenChange])

  const aiFuse = useMemo(() => new Fuse(aiActions, {
    keys: ['label', 'description'],
    threshold: 0.4,
    ignoreLocation: true,
  }), [aiActions])

  const filteredAIActions = useMemo(() => {
    if (mode !== 'ai') return [] as AIAction[]
    if (!aiQuery) return aiActions
    return aiFuse.search(aiQuery).map((result) => result.item)
  }, [mode, aiQuery, aiActions, aiFuse])

  const aiItemMode = keywordSuggestions
    ? 'keyword-results'
    : folderSuggestions
      ? 'folder-results'
      : 'actions'

  const activeItemCount = useMemo(() => {
    if (mode === 'snippet') {
      if (query.trim() === '') return recentSnippets.length
      return snippetResults.length
    }
    if (mode === 'command') {
      return commandResults.length
    }
    if (mode === 'content') {
      return flatContentItems.length
    }
    if (aiItemMode === 'keyword-results') {
      return (keywordSuggestions?.length ?? 0) + 1
    }
    if (aiItemMode === 'folder-results') {
      return (folderSuggestions?.length ?? 0) + 1
    }
    return filteredAIActions.length
  }, [
    mode,
    query,
    recentSnippets.length,
    snippetResults.length,
    commandResults.length,
    flatContentItems.length,
    aiItemMode,
    keywordSuggestions,
    folderSuggestions,
    filteredAIActions.length,
  ])

  const executeSelection = useCallback(async (index: number) => {
    if (mode === 'snippet') {
      if (query.trim() === '') {
        const snippet = recentSnippets[index]
        if (snippet) openSnippet(snippet.id)
        return
      }
      const result = snippetResults[index]
      if (result) openSnippet(result.snippet.id)
      return
    }

    if (mode === 'command') {
      const command = commandResults[index]
      if (!command) return
      command.action()
      onOpenChange(false)
      return
    }

    if (mode === 'content') {
      const item = flatContentItems[index]
      if (item) openSnippet(item.snippetId)
      return
    }

    if (aiItemMode === 'keyword-results') {
      if (!keywordSuggestions) return
      if (index < keywordSuggestions.length) {
        applyKeywordSuggestion(keywordSuggestions[index])
        return
      }
      resetAISuggestions()
      return
    }

    if (aiItemMode === 'folder-results') {
      if (!folderSuggestions) return
      if (index < folderSuggestions.length) {
        applyFolderSuggestion(folderSuggestions[index])
        return
      }
      resetAISuggestions()
      return
    }

    const action = filteredAIActions[index]
    if (!action) return
    await action.run()
  }, [
    mode,
    query,
    recentSnippets,
    snippetResults,
    commandResults,
    flatContentItems,
    aiItemMode,
    keywordSuggestions,
    folderSuggestions,
    filteredAIActions,
    openSnippet,
    onOpenChange,
    applyKeywordSuggestion,
    applyFolderSuggestion,
    resetAISuggestions,
  ])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIndex(0)
      resetAISuggestions()
      return
    }

    setQuery(initialQuery)
    setSelectedIndex(0)
    resetAISuggestions()
  }, [open, initialQuery, resetAISuggestions])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, mode])

  useEffect(() => {
    const list = listRef.current
    if (!list || activeItemCount === 0) return
    const nodes = list.querySelectorAll('[data-palette-item]')
    const selected = nodes[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, activeItemCount])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
      case 'Enter':
        e.preventDefault()
        void executeSelection(selectedIndex)
        break
    }
  }, [activeItemCount, selectedIndex, executeSelection, onOpenChange])

  if (!open) return null

  let contentFlatIndex = 0
  let commandFlatIndex = 0

  return (
    <div
      data-testid="unified-palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" />

      <CmdkRoot
        className="relative w-full max-w-2xl mx-4 sm:mx-0 bg-muted border border-border rounded-xl shadow-2xl overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        shouldFilter={false}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <CmdkRoot.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search snippets, > commands, / content, >ai"
            autoFocus
            className="flex-1 h-12 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
          />
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {mode}
          </span>
        </div>

        <CmdkRoot.List ref={listRef} role="listbox" className="max-h-[26rem] overflow-y-auto p-2">
          {mode === 'snippet' && (
            query.trim() === '' ? (
              recentSnippets.length > 0 ? (
                <CmdkRoot.Group heading="Recent" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                  {recentSnippets.map((snippet, index) => (
                    <RecentSnippetItem
                      key={snippet.id}
                      snippet={snippet}
                      selected={index === selectedIndex}
                      onSelect={() => openSnippet(snippet.id)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    />
                  ))}
                </CmdkRoot.Group>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Type to search snippets by name, content, keyword, or tags
                </div>
              )
            ) : snippetResults.length > 0 ? (
              <CmdkRoot.Group heading="Snippets" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                {snippetResults.map((result, index) => (
                  <SearchResultItem
                    key={result.snippet.id}
                    result={result}
                    selected={index === selectedIndex}
                    onSelect={() => openSnippet(result.snippet.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  />
                ))}
              </CmdkRoot.Group>
            ) : (
              <CmdkRoot.Empty className="py-8 text-center text-sm text-muted-foreground">
                No snippets match &ldquo;{query}&rdquo;
              </CmdkRoot.Empty>
            )
          )}

          {mode === 'command' && (
            commandResults.length === 0 ? (
              <CmdkRoot.Empty className="py-8 text-center text-sm text-muted-foreground">
                No matching commands
              </CmdkRoot.Empty>
            ) : commandQuery ? (
              <div>
                {commandResults.map((command, index) => {
                  const Icon = command.icon
                  return (
                    <div
                      key={command.id}
                      data-palette-item
                      data-command-item
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => {
                        command.action()
                        onOpenChange(false)
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-secondary-foreground transition-colors',
                        index === selectedIndex ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50'
                      )}
                    >
                      {Icon && <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />}
                      <HighlightedLabel text={command.label} matches={commandMatchMap.get(command.id)} />
                      {command.shortcut && (
                        <kbd className="text-xs text-muted-foreground px-1.5 py-0.5 bg-accent rounded">
                          {command.shortcut}
                        </kbd>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              commandSections.map((section) => (
                <div key={section.section} data-command-section={section.section}>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {section.section}
                  </div>
                  {section.commands.map((command) => {
                    const idx = commandFlatIndex++
                    const Icon = command.icon
                    return (
                      <div
                        key={command.id}
                        data-palette-item
                        data-command-item
                        role="option"
                        aria-selected={idx === selectedIndex}
                        onClick={() => {
                          command.action()
                          onOpenChange(false)
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-secondary-foreground transition-colors',
                          idx === selectedIndex ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50'
                        )}
                      >
                        {Icon && <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />}
                        <span className="text-sm flex-1">{command.label}</span>
                        {command.shortcut && (
                          <kbd className="text-xs text-muted-foreground px-1.5 py-0.5 bg-accent rounded">
                            {command.shortcut}
                          </kbd>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )
          )}

          {mode === 'content' && (
            !contentQuery ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Type <code className="text-xs bg-accent px-1 rounded">/query</code> to search snippet content
              </div>
            ) : contentResults.length === 0 ? (
              <CmdkRoot.Empty className="py-8 text-center text-sm text-muted-foreground">
                No content matches for &ldquo;{contentQuery}&rdquo;
              </CmdkRoot.Empty>
            ) : (
              <div className="py-1">
                {contentResults.map((result) => (
                  <div key={result.snippetId} className="mb-1">
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground sticky top-0 bg-muted/95 backdrop-blur-sm">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="font-medium truncate">{result.snippetName}</span>
                      <span className="ml-auto">
                        {result.lines.reduce((sum, line) => sum + line.matchRanges.length, 0)} match{result.lines.reduce((sum, line) => sum + line.matchRanges.length, 0) !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    {result.lines.map((line) => {
                      const flatIndex = contentFlatIndex++
                      return (
                        <div
                          key={`${result.snippetId}-${line.lineNumber}`}
                          data-palette-item
                          role="option"
                          aria-selected={flatIndex === selectedIndex}
                          onClick={() => openSnippet(result.snippetId)}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={cn(
                            'flex items-start gap-3 px-4 py-1 cursor-pointer text-sm font-mono transition-colors',
                            flatIndex === selectedIndex ? 'bg-blue-600/20 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50 text-secondary-foreground'
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
                ))}
              </div>
            )
          )}

          {mode === 'ai' && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                AI Assist
              </div>

              {selectedSnippet ? (
                <div className="px-3 pb-2 text-xs text-muted-foreground truncate">
                  Snippet: <span className="text-foreground">{selectedSnippet.name}</span>
                </div>
              ) : (
                <div className="px-3 pb-2 text-xs text-amber-500">Select a snippet to use snippet-level AI actions</div>
              )}

              {aiLoading && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{aiLoading === 'keyword' ? 'Generating keyword suggestions...' : 'Generating folder suggestions...'}</span>
                </div>
              )}

              {aiError && (
                <div className="px-3 py-2 text-sm text-amber-500">{aiError}</div>
              )}

              {aiItemMode === 'keyword-results' && keywordSuggestions && (
                <>
                  {keywordSuggestions.map((keyword, index) => {
                    const conflict = keywordSuggestionConflicts.get(keyword)
                    return (
                      <button
                        key={keyword}
                        data-palette-item
                        onClick={() => applyKeywordSuggestion(keyword)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2',
                          index === selectedIndex ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50 text-secondary-foreground'
                        )}
                      >
                        <Hash className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm flex-1">{keyword}</span>
                        {conflict?.conflict && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="truncate max-w-40">{conflict.existingSnippet?.name}</span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                  <button
                    data-palette-item
                    onClick={resetAISuggestions}
                    onMouseEnter={() => setSelectedIndex(keywordSuggestions.length)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2',
                      selectedIndex === keywordSuggestions.length ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50 text-secondary-foreground'
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm">Back to AI actions</span>
                  </button>
                </>
              )}

              {aiItemMode === 'folder-results' && folderSuggestions && (
                <>
                  {folderSuggestions.map((suggestion, index) => {
                    const existing = folders.some(
                      (folder) => folder.name.toLowerCase() === suggestion.folder.toLowerCase()
                    )
                    return (
                      <button
                        key={suggestion.folder}
                        data-palette-item
                        onClick={() => applyFolderSuggestion(suggestion)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2',
                          index === selectedIndex ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50 text-secondary-foreground'
                        )}
                      >
                        {existing ? <Folder className="w-4 h-4 shrink-0 text-muted-foreground" /> : <FolderPlus className="w-4 h-4 shrink-0 text-muted-foreground" />}
                        <span className="text-sm flex-1">{suggestion.folder}</span>
                        <span className="text-xs text-muted-foreground">{Math.round(suggestion.confidence * 100)}%</span>
                      </button>
                    )
                  })}
                  <button
                    data-palette-item
                    onClick={resetAISuggestions}
                    onMouseEnter={() => setSelectedIndex(folderSuggestions.length)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2',
                      selectedIndex === folderSuggestions.length ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50 text-secondary-foreground'
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm">Back to AI actions</span>
                  </button>
                </>
              )}

              {aiItemMode === 'actions' && (
                filteredAIActions.length > 0 ? (
                  filteredAIActions.map((action, index) => (
                    <button
                      key={action.id}
                      data-palette-item
                      onClick={() => void action.run()}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2',
                        index === selectedIndex ? 'bg-blue-600/30 text-blue-800 dark:text-blue-200' : 'hover:bg-accent/50 text-secondary-foreground'
                      )}
                    >
                      <Sparkles className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{action.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{action.description}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <CmdkRoot.Empty className="py-6 text-center text-sm text-muted-foreground">
                    No AI actions available
                  </CmdkRoot.Empty>
                )
              )}
            </div>
          )}
        </CmdkRoot.List>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">↵</kbd> select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">esc</kbd> close
            </span>
          </div>

          {mode === 'snippet' && (
            <button
              onClick={() => setSearchSettings({ scopeToCurrentFolder: !searchSettings.scopeToCurrentFolder })}
              disabled={!hasCurrentFolder}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded transition-colors',
                hasCurrentFolder
                  ? searchSettings.scopeToCurrentFolder
                    ? 'bg-blue-600/30 text-blue-600 dark:text-blue-300 hover:bg-blue-600/40'
                    : 'hover:bg-accent text-muted-foreground hover:text-secondary-foreground'
                  : 'opacity-50 cursor-not-allowed'
              )}
              title={
                hasCurrentFolder
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
                <span className="max-w-[120px] truncate" title={currentFolderName ?? undefined}>{currentFolderName}</span>
              ) : (
                <span>All folders</span>
              )}
            </button>
          )}

          {mode === 'content' && contentQuery && contentResults.length > 0 && (
            <span>{totalContentMatches} match{totalContentMatches !== 1 ? 'es' : ''} in {contentResults.length} snippet{contentResults.length !== 1 ? 's' : ''}</span>
          )}

          {mode === 'ai' && (
            <span>
              <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px] font-medium">⌘J</kbd> AI mode
            </span>
          )}
        </div>
      </CmdkRoot>
    </div>
  )
}
