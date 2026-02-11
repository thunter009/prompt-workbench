'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X,
  Loader2,
  Folder as FolderIcon,
  FolderPlus,
  FileText,
  Check,
  CheckSquare,
  Square,
  Minus,
  ChevronRight,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import type { Snippet } from '@/types'

interface FolderSuggestion {
  folder: string
  confidence: number
}

interface SnippetSuggestion {
  snippet: Snippet
  suggestion: FolderSuggestion | null
  status: 'unfiled' | 'suggested' | 'well-placed'
}

interface FolderReorgModalProps {
  open: boolean
  onClose: () => void
}

export function FolderReorgModal({ open, onClose }: FolderReorgModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [items, setItems] = useState<SnippetSuggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const snippets = useSnippetStore((s) => s.snippets)
  const folders = useSnippetStore((s) => s.folders)
  const createFolder = useSnippetStore((s) => s.createFolder)
  const moveSnippetsToFolder = useSnippetStore((s) => s.moveSnippetsToFolder)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
      setDone(false)
      setSearchQuery('')
      analyze()
    } else {
      dialog.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const analyze = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setItems([])
    setSelected(new Set())
    setProgress({ done: 0, total: snippets.length })

    const existingFolders = folders.map((f) => f.name)
    const results: SnippetSuggestion[] = []

    // Process snippets in parallel batches of 3
    const batchSize = 3
    try {
      for (let i = 0; i < snippets.length; i += batchSize) {
        if (controller.signal.aborted) break

        const batch = snippets.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(async (snippet) => {
            // Skip very short snippets
            if (snippet.text.length < 30) {
              if (snippet.folderId) {
                return { snippet, suggestion: null, status: 'well-placed' as const }
              }
              return { snippet, suggestion: null, status: 'unfiled' as const }
            }

            try {
              const perReqController = new AbortController()
              const perReqTimeout = setTimeout(() => perReqController.abort(), 10000)

              // Also abort per-request if global cancel fires
              const onGlobalAbort = () => perReqController.abort()
              controller.signal.addEventListener('abort', onGlobalAbort)

              try {
                const res = await fetch('/api/suggest-folder', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    snippet: { name: snippet.name, text: snippet.text },
                    existingFolders,
                    ollamaUrl,
                    model: ollamaModel,
                  }),
                  signal: perReqController.signal,
                })
                const data = await res.json()
                const suggestions: FolderSuggestion[] = data.suggestions ?? []
                const top = suggestions[0] ?? null

                if (!snippet.folderId && top) {
                  return { snippet, suggestion: top, status: 'suggested' as const }
                }
                if (snippet.folderId && top) {
                  const currentFolder = folders.find((f) => f.id === snippet.folderId)
                  if (
                    currentFolder &&
                    currentFolder.name.toLowerCase() !== top.folder.toLowerCase() &&
                    top.confidence >= 0.7
                  ) {
                    return { snippet, suggestion: top, status: 'suggested' as const }
                  }
                  return { snippet, suggestion: null, status: 'well-placed' as const }
                }
                if (!snippet.folderId && !top) {
                  return { snippet, suggestion: null, status: 'unfiled' as const }
                }
                return { snippet, suggestion: null, status: 'well-placed' as const }
              } finally {
                clearTimeout(perReqTimeout)
                controller.signal.removeEventListener('abort', onGlobalAbort)
              }
            } catch {
              if (snippet.folderId) {
                return { snippet, suggestion: null, status: 'well-placed' as const }
              }
              return { snippet, suggestion: null, status: 'unfiled' as const }
            }
          })
        )
        results.push(...batchResults)
        setProgress({ done: Math.min(i + batchSize, snippets.length), total: snippets.length })
      }
    } catch {
      // Global abort — use whatever results we have so far
    }

    setItems(results)
    // Auto-select all suggested items
    const suggestedIds = new Set(
      results.filter((r) => r.status === 'suggested').map((r) => r.snippet.id)
    )
    setSelected(suggestedIds)

    // Expand all folder groups + unfiled/well-placed by default
    const folderNames = new Set(
      results
        .filter((r) => r.status === 'suggested' && r.suggestion)
        .map((r) => r.suggestion!.folder)
    )
    setExpandedGroups(new Set([...folderNames, '__unfiled__', '__well-placed__']))

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snippets, folders, ollamaUrl, ollamaModel])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === dialogRef.current) onClose()
    },
    [onClose]
  )

  // focusTrap: keep Tab cycling within dialog
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const suggested = items.filter((i) => i.status === 'suggested')
    if (selected.size === suggested.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(suggested.map((i) => i.snippet.id)))
    }
  }

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) next.delete(groupName)
      else next.add(groupName)
      return next
    })
  }

  const toggleFolderSelection = (folderSnippetIds: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = folderSnippetIds.every((id) => next.has(id))
      if (allSelected) {
        folderSnippetIds.forEach((id) => next.delete(id))
      } else {
        folderSnippetIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleApply = async () => {
    setApplying(true)
    const toApply = items.filter(
      (i) => i.status === 'suggested' && i.suggestion && selected.has(i.snippet.id)
    )

    // Group by folder name to batch moves
    const byFolder = new Map<string, string[]>()
    for (const item of toApply) {
      const folderName = item.suggestion!.folder
      const list = byFolder.get(folderName) ?? []
      list.push(item.snippet.id)
      byFolder.set(folderName, list)
    }

    for (const [folderName, snippetIds] of byFolder) {
      const existing = folders.find(
        (f) => f.name.toLowerCase() === folderName.toLowerCase()
      )
      if (existing) {
        moveSnippetsToFolder(snippetIds, existing.id)
      } else {
        const newFolder = createFolder({ name: folderName })
        moveSnippetsToFolder(snippetIds, newFolder.id)
      }
    }

    setApplying(false)
    setDone(true)
  }

  const suggestedItems = items.filter((i) => i.status === 'suggested')
  const unfiledItems = items.filter((i) => i.status === 'unfiled')
  const wellPlacedItems = items.filter((i) => i.status === 'well-placed')

  // Group suggested items by target folder
  const folderGroups = useMemo(() => {
    const groups = new Map<string, SnippetSuggestion[]>()
    for (const item of suggestedItems) {
      const folderName = item.suggestion!.folder
      const list = groups.get(folderName) ?? []
      list.push(item)
      groups.set(folderName, list)
    }
    return groups
  }, [suggestedItems])

  // Summary stats
  const summaryStats = useMemo(() => {
    const existingFolderNames = new Set(folders.map((f) => f.name.toLowerCase()))
    let newCount = 0
    let existingCount = 0
    for (const folderName of folderGroups.keys()) {
      if (existingFolderNames.has(folderName.toLowerCase())) {
        existingCount++
      } else {
        newCount++
      }
    }
    return { newCount, existingCount }
  }, [folderGroups, folders])

  // Filtered items based on search
  const filteredFolderGroups = useMemo(() => {
    if (!searchQuery.trim()) return folderGroups
    const q = searchQuery.toLowerCase()
    const filtered = new Map<string, SnippetSuggestion[]>()
    for (const [folderName, groupItems] of folderGroups) {
      if (folderName.toLowerCase().includes(q)) {
        filtered.set(folderName, groupItems)
        continue
      }
      const matchingItems = groupItems.filter((item) =>
        item.snippet.name.toLowerCase().includes(q)
      )
      if (matchingItems.length > 0) {
        filtered.set(folderName, matchingItems)
      }
    }
    return filtered
  }, [folderGroups, searchQuery])

  const filteredUnfiled = useMemo(() => {
    if (!searchQuery.trim()) return unfiledItems
    const q = searchQuery.toLowerCase()
    return unfiledItems.filter((item) => item.snippet.name.toLowerCase().includes(q))
  }, [unfiledItems, searchQuery])

  const filteredWellPlaced = useMemo(() => {
    if (!searchQuery.trim()) return wellPlacedItems
    const q = searchQuery.toLowerCase()
    return wellPlacedItems.filter((item) => item.snippet.name.toLowerCase().includes(q))
  }, [wellPlacedItems, searchQuery])

  const isExistingFolder = (name: string) =>
    folders.some((f) => f.name.toLowerCase() === name.toLowerCase())

  const confidenceDot = (confidence: number) => (
    <span
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full shrink-0',
        confidence > 0.8 ? 'bg-green-500' : 'bg-yellow-500'
      )}
    />
  )

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      data-testid="reorg-modal"
      className="backdrop:bg-black/50 bg-transparent p-0 max-w-xl w-full"
    >
      <div className="bg-muted border border-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-lg font-medium text-foreground">Batch Reorganize</h2>
          <div className="flex items-center gap-2">
            {!loading && !done && suggestedItems.length > 0 && (
              <button
                onClick={toggleAll}
                data-testid="reorg-toggle-all"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {selected.size === suggestedItems.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
            <button
              onClick={onClose}
              data-testid="reorg-modal-close"
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div
              data-testid="reorg-loading"
              className="flex flex-col items-center justify-center py-8 gap-3"
            >
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Analyzing {progress.done} of {progress.total} snippets...
              </span>
              <button
                onClick={handleCancel}
                data-testid="reorg-cancel"
                className="px-3 py-1.5 text-sm rounded bg-accent text-secondary-foreground hover:bg-accent/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {done && (
            <div data-testid="reorg-done" className="flex flex-col items-center justify-center py-8 gap-3">
              <Check className="w-8 h-8 text-green-500" />
              <span className="text-sm text-foreground">Reorganization complete</span>
            </div>
          )}

          {!loading && !done && items.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* Summary stats */}
              {suggestedItems.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {summaryStats.newCount > 0 && `Creating ${summaryStats.newCount} new folder${summaryStats.newCount !== 1 ? 's' : ''}`}
                  {summaryStats.newCount > 0 && summaryStats.existingCount > 0 && ' · '}
                  {summaryStats.existingCount > 0 && `Adding to ${summaryStats.existingCount} existing`}
                </p>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter snippets or folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Suggested moves - grouped by folder */}
              {filteredFolderGroups.size > 0 && (
                <section data-testid="reorg-suggested">
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    Suggested Moves ({suggestedItems.length})
                  </h3>
                  <div className="flex flex-col gap-1">
                    {[...filteredFolderGroups.entries()].map(([folderName, groupItems]) => {
                      const snippetIds = groupItems.map((i) => i.snippet.id)
                      const allSelected = snippetIds.every((id) => selected.has(id))
                      const someSelected = snippetIds.some((id) => selected.has(id))
                      const isExpanded = expandedGroups.has(folderName)
                      const existing = isExistingFolder(folderName)

                      return (
                        <div key={folderName} className="rounded border border-border/50">
                          {/* Folder header */}
                          <div
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 cursor-pointer select-none"
                            onClick={() => toggleGroup(folderName)}
                          >
                            <button
                              className="shrink-0 text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFolderSelection(snippetIds)
                              }}
                            >
                              {allSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-500" />
                              ) : someSelected ? (
                                <Minus className="w-4 h-4 text-blue-500 border border-blue-500 rounded-[3px]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            {existing ? (
                              <FolderIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <FolderPlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm font-medium flex-1 truncate" title={folderName}>{folderName}</span>
                            <span className="text-xs text-muted-foreground">{groupItems.length}</span>
                            <ChevronRight
                              className={cn(
                                'w-3.5 h-3.5 text-muted-foreground transition-transform duration-150',
                                isExpanded && 'rotate-90'
                              )}
                            />
                          </div>

                          {/* Collapsible snippet list */}
                          <div className={cn(
                            'grid transition-[grid-template-rows] duration-150 ease-out',
                            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          )}>
                            <ul className="overflow-hidden">
                              {groupItems.map((item) => (
                                <li
                                  key={item.snippet.id}
                                  data-testid="reorg-suggestion-row"
                                  className="flex items-center gap-2 pl-8 pr-2 py-1 hover:bg-accent/30 cursor-pointer"
                                  onClick={() => toggleSelected(item.snippet.id)}
                                >
                                  <button
                                    data-testid="reorg-checkbox"
                                    className="shrink-0 text-muted-foreground"
                                  >
                                    {selected.has(item.snippet.id) ? (
                                      <CheckSquare className="w-4 h-4 text-blue-500" />
                                    ) : (
                                      <Square className="w-4 h-4" />
                                    )}
                                  </button>
                                  {confidenceDot(item.suggestion!.confidence)}
                                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm truncate flex-1" title={item.snippet.name}>{item.snippet.name}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Unfiled */}
              {filteredUnfiled.length > 0 && (
                <section data-testid="reorg-unfiled">
                  <div
                    className="flex items-center gap-2 mb-1 cursor-pointer select-none"
                    onClick={() => toggleGroup('__unfiled__')}
                  >
                    <ChevronRight
                      className={cn(
                        'w-3.5 h-3.5 text-muted-foreground transition-transform duration-150',
                        expandedGroups.has('__unfiled__') && 'rotate-90'
                      )}
                    />
                    <h3 className="text-sm font-medium text-foreground">
                      Unfiled ({unfiledItems.length})
                    </h3>
                  </div>
                  <div className={cn(
                    'grid transition-[grid-template-rows] duration-150 ease-out',
                    expandedGroups.has('__unfiled__') ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}>
                    <ul className="flex flex-col gap-1 overflow-hidden">
                      {filteredUnfiled.map((item) => (
                        <li
                          key={item.snippet.id}
                          data-testid="reorg-unfiled-row"
                          className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-sm truncate" title={item.snippet.name}>{item.snippet.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* Well-placed */}
              {filteredWellPlaced.length > 0 && (
                <section data-testid="reorg-well-placed">
                  <div
                    className="flex items-center gap-2 mb-1 cursor-pointer select-none"
                    onClick={() => toggleGroup('__well-placed__')}
                  >
                    <ChevronRight
                      className={cn(
                        'w-3.5 h-3.5 text-muted-foreground transition-transform duration-150',
                        expandedGroups.has('__well-placed__') && 'rotate-90'
                      )}
                    />
                    <h3 className="text-sm font-medium text-foreground">
                      Well Placed ({wellPlacedItems.length})
                    </h3>
                  </div>
                  <div className={cn(
                    'grid transition-[grid-template-rows] duration-150 ease-out',
                    expandedGroups.has('__well-placed__') ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}>
                    <ul className="flex flex-col gap-1 overflow-hidden">
                      {filteredWellPlaced.map((item) => (
                        <li
                          key={item.snippet.id}
                          data-testid="reorg-well-placed-row"
                          className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground"
                        >
                          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-sm truncate" title={item.snippet.name}>{item.snippet.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !done && suggestedItems.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded bg-accent text-secondary-foreground hover:bg-accent/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selected.size === 0 || applying}
              data-testid="reorg-apply"
              className={cn(
                'px-3 py-1.5 text-sm rounded transition-colors',
                selected.size === 0 || applying
                  ? 'bg-blue-600/50 text-white/50 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              )}
            >
              {applying ? 'Applying...' : `Apply (${selected.size})`}
            </button>
          </div>
        )}

        {/* Done footer */}
        {done && (
          <div className="flex items-center justify-end px-4 py-3 border-t border-border shrink-0">
            <button
              onClick={onClose}
              data-testid="reorg-close-done"
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
