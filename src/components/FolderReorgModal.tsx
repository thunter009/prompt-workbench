'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X,
  Loader2,
  Folder as FolderIcon,
  FolderPlus,
  FileText,
  Check,
  CheckSquare,
  Square,
  ArrowRight,
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
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SnippetSuggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)

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
      analyze()
    } else {
      dialog.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const analyze = useCallback(async () => {
    setLoading(true)
    setItems([])
    setSelected(new Set())

    const existingFolders = folders.map((f) => f.name)
    const results: SnippetSuggestion[] = []

    // Process snippets in parallel batches of 3
    const batchSize = 3
    for (let i = 0; i < snippets.length; i += batchSize) {
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
            const res = await fetch('/api/suggest-folder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                snippet: { name: snippet.name, text: snippet.text },
                existingFolders,
                ollamaUrl,
                model: ollamaModel,
              }),
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
          } catch {
            if (snippet.folderId) {
              return { snippet, suggestion: null, status: 'well-placed' as const }
            }
            return { snippet, suggestion: null, status: 'unfiled' as const }
          }
        })
      )
      results.push(...batchResults)
    }

    setItems(results)
    // Auto-select all suggested items
    const suggestedIds = new Set(
      results.filter((r) => r.status === 'suggested').map((r) => r.snippet.id)
    )
    setSelected(suggestedIds)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snippets, folders, ollamaUrl, ollamaModel])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === dialogRef.current) onClose()
    },
    [onClose]
  )

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

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      data-testid="reorg-modal"
      className="backdrop:bg-black/50 bg-transparent p-0 max-w-lg w-full"
    >
      <div className="bg-muted border border-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-lg font-medium text-foreground">Batch Reorganize</h2>
          <button
            onClick={onClose}
            data-testid="reorg-modal-close"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
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
                Analyzing {snippets.length} snippets...
              </span>
            </div>
          )}

          {done && (
            <div data-testid="reorg-done" className="flex flex-col items-center justify-center py-8 gap-3">
              <Check className="w-8 h-8 text-green-500" />
              <span className="text-sm text-foreground">Reorganization complete</span>
            </div>
          )}

          {!loading && !done && items.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* Suggested moves */}
              {suggestedItems.length > 0 && (
                <section data-testid="reorg-suggested">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-foreground">
                      Suggested Moves ({suggestedItems.length})
                    </h3>
                    <button
                      onClick={toggleAll}
                      data-testid="reorg-toggle-all"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {selected.size === suggestedItems.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {suggestedItems.map((item) => (
                      <li
                        key={item.snippet.id}
                        data-testid="reorg-suggestion-row"
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer"
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
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{item.snippet.name}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        {folders.some(
                          (f) =>
                            f.name.toLowerCase() === item.suggestion!.folder.toLowerCase()
                        ) ? (
                          <FolderIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <FolderPlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                          {item.suggestion!.folder}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Unfiled */}
              {unfiledItems.length > 0 && (
                <section data-testid="reorg-unfiled">
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    Unfiled ({unfiledItems.length})
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {unfiledItems.map((item) => (
                      <li
                        key={item.snippet.id}
                        data-testid="reorg-unfiled-row"
                        className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-sm truncate">{item.snippet.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Well-placed */}
              {wellPlacedItems.length > 0 && (
                <section data-testid="reorg-well-placed">
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    Well Placed ({wellPlacedItems.length})
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {wellPlacedItems.map((item) => (
                      <li
                        key={item.snippet.id}
                        data-testid="reorg-well-placed-row"
                        className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground"
                      >
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-sm truncate">{item.snippet.name}</span>
                      </li>
                    ))}
                  </ul>
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
