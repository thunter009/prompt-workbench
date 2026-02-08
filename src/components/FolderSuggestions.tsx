'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, X, FolderPlus, Folder as FolderIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { useAISettingsStore } from '@/lib/ai-settings-store'

const DEBOUNCE_MS = 2000
const MIN_TEXT_LENGTH = 30

interface FolderSuggestion {
  folder: string
  confidence: number
}

interface FolderSuggestionsProps {
  snippetId: string
  snippetName: string
  snippetText: string
  currentFolderId?: string
}

export function FolderSuggestions({
  snippetId,
  snippetName,
  snippetText,
  currentFolderId,
}: FolderSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<FolderSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestRef = useRef<string>('')

  // On-demand popover state
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverSuggestions, setPopoverSuggestions] = useState<FolderSuggestion[]>([])
  const [popoverLoading, setPopoverLoading] = useState(false)
  const [popoverError, setPopoverError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const folders = useSnippetStore((s) => s.folders)
  const createFolder = useSnippetStore((s) => s.createFolder)
  const moveSnippetsToFolder = useSnippetStore((s) => s.moveSnippetsToFolder)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)

  const doFetch = useCallback(async (): Promise<FolderSuggestion[]> => {
    const existingFolders = folders.map((f) => f.name)
    const res = await fetch('/api/suggest-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: { name: snippetName, text: snippetText },
        existingFolders,
        ollamaUrl,
        model: ollamaModel,
      }),
    })
    const data = await res.json()
    return data.suggestions ?? []
  }, [snippetName, snippetText, folders, ollamaUrl, ollamaModel])

  // Auto-suggest fetch (debounced, only when no folder assigned)
  const fetchAutoSuggestions = useCallback(async () => {
    if (currentFolderId || snippetText.length < MIN_TEXT_LENGTH || dismissed) return

    const requestKey = `${snippetId}::${snippetName}::${snippetText.slice(0, 200)}`
    if (requestKey === lastRequestRef.current) return
    lastRequestRef.current = requestKey

    setLoading(true)
    setError(null)

    try {
      const results = await doFetch()
      setSuggestions(results.length > 0 ? results : [])
    } catch {
      setError('Could not fetch folder suggestions')
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [snippetId, snippetName, snippetText, currentFolderId, dismissed, doFetch])

  // Debounced auto-fetch when snippet changes
  useEffect(() => {
    setDismissed(false)
    setSuggestions([])
    lastRequestRef.current = ''

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (currentFolderId || snippetText.length < MIN_TEXT_LENGTH) return

    debounceRef.current = setTimeout(fetchAutoSuggestions, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [snippetId, snippetName, snippetText, currentFolderId, fetchAutoSuggestions])

  // Clear when snippet gets assigned to folder
  useEffect(() => {
    if (currentFolderId) {
      setSuggestions([])
    }
  }, [currentFolderId])

  // On-demand fetch (popover button)
  const fetchOnDemand = useCallback(async () => {
    if (snippetText.length < MIN_TEXT_LENGTH) {
      setPopoverError('Snippet text too short')
      setPopoverOpen(true)
      return
    }

    setPopoverLoading(true)
    setPopoverError(null)
    setPopoverOpen(true)
    setPopoverSuggestions([])

    try {
      const results = await doFetch()
      if (results.length > 0) {
        setPopoverSuggestions(results)
      } else {
        setPopoverError('No suggestions available')
      }
    } catch {
      setPopoverError('Could not fetch suggestions')
    } finally {
      setPopoverLoading(false)
    }
  }, [snippetText, doFetch])

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
      if (e.key === 'Escape' && popoverOpen) setPopoverOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [popoverOpen])

  const assignFolder = (suggestion: FolderSuggestion) => {
    const existing = folders.find(
      (f) => f.name.toLowerCase() === suggestion.folder.toLowerCase()
    )

    if (existing) {
      moveSnippetsToFolder([snippetId], existing.id)
    } else {
      const newFolder = createFolder({ name: suggestion.folder })
      moveSnippetsToFolder([snippetId], newFolder.id)
    }

    setSuggestions([])
    setPopoverOpen(false)
    setPopoverSuggestions([])
  }

  const handleDismiss = () => {
    setDismissed(true)
    setSuggestions([])
  }

  const currentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId)
    : null

  return (
    <div className="flex flex-col gap-2">
      {/* Folder row with label, current folder display, and suggest button */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground shrink-0">Folder</label>
        <span
          data-testid="folder-current"
          className="text-sm text-muted-foreground italic"
        >
          {currentFolder ? currentFolder.name : 'None'}
        </span>
        <div className="relative ml-auto">
          <button
            ref={buttonRef}
            onClick={fetchOnDemand}
            disabled={popoverLoading}
            data-testid="folder-suggest-button"
            title="Suggest folder"
            className={cn(
              'p-1.5 rounded transition-colors',
              popoverLoading
                ? 'bg-accent text-muted-foreground'
                : 'hover:bg-accent text-muted-foreground hover:text-amber-400'
            )}
          >
            {popoverLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>

          {/* On-demand popover */}
          {popoverOpen && (
            <div
              ref={popoverRef}
              data-testid="folder-suggest-popover"
              className="absolute top-full right-0 mt-1 z-50 bg-accent border border-border rounded-lg shadow-xl min-w-[220px] max-w-[300px]"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground font-medium">Folder Suggestions</span>
                <button
                  onClick={() => setPopoverOpen(false)}
                  data-testid="folder-suggest-popover-close"
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-secondary-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2">
                {popoverLoading && (
                  <div className="flex items-center gap-2 py-2 px-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Generating suggestions...</span>
                  </div>
                )}

                {popoverError && !popoverLoading && (
                  <p className="py-2 px-1 text-xs text-amber-500">{popoverError}</p>
                )}

                {!popoverLoading && popoverSuggestions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {popoverSuggestions.map((s) => {
                      const isExisting = folders.some(
                        (f) => f.name.toLowerCase() === s.folder.toLowerCase()
                      )
                      return (
                        <button
                          key={s.folder}
                          data-testid="folder-suggest-popover-item"
                          data-folder={s.folder}
                          data-existing={isExisting}
                          onClick={() => assignFolder(s)}
                          className={cn(
                            'w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between',
                            'bg-accent/50 hover:bg-accent-foreground/10 text-foreground',
                            'transition-colors cursor-pointer'
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {isExisting ? (
                              <FolderIcon className="h-3 w-3 shrink-0" />
                            ) : (
                              <FolderPlus className="h-3 w-3 shrink-0" />
                            )}
                            {s.folder}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {Math.round(s.confidence * 100)}%
                          </span>
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

      {/* Auto-suggest pills (existing behavior) */}
      {(loading || suggestions.length > 0 || error) && (
        <div data-testid="folder-suggestions" className="flex items-center gap-2 flex-wrap">
          {loading && (
            <div data-testid="folder-suggestions-loading" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Suggesting folder...</span>
            </div>
          )}

          {error && <span className="text-xs text-amber-500">{error}</span>}

          {suggestions.length > 0 && (
            <>
              <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Move to:</span>
              {suggestions.map((s) => {
                const isExisting = folders.some(
                  (f) => f.name.toLowerCase() === s.folder.toLowerCase()
                )
                return (
                  <button
                    key={s.folder}
                    data-testid="folder-suggestion-pill"
                    data-folder={s.folder}
                    data-existing={isExisting}
                    onClick={() => assignFolder(s)}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs inline-flex items-center gap-1',
                      'bg-accent hover:bg-accent-foreground/10 text-foreground',
                      'transition-colors cursor-pointer'
                    )}
                    title={`${isExisting ? 'Move to existing' : 'Create new'} folder (${Math.round(s.confidence * 100)}% confidence)`}
                  >
                    {isExisting ? (
                      <FolderIcon className="h-2.5 w-2.5" />
                    ) : (
                      <FolderPlus className="h-2.5 w-2.5" />
                    )}
                    {s.folder}
                  </button>
                )
              })}
              <button
                onClick={handleDismiss}
                data-testid="folder-suggestions-dismiss"
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-secondary-foreground transition-colors"
                aria-label="Dismiss suggestions"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
