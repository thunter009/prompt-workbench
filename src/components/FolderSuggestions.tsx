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

  const folders = useSnippetStore((s) => s.folders)
  const createFolder = useSnippetStore((s) => s.createFolder)
  const moveSnippetsToFolder = useSnippetStore((s) => s.moveSnippetsToFolder)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)

  const fetchSuggestions = useCallback(async () => {
    if (currentFolderId || snippetText.length < MIN_TEXT_LENGTH || dismissed) {
      return
    }

    const requestKey = `${snippetId}::${snippetName}::${snippetText.slice(0, 200)}`
    if (requestKey === lastRequestRef.current) return
    lastRequestRef.current = requestKey

    setLoading(true)
    setError(null)

    try {
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
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions)
      } else {
        setSuggestions([])
      }
    } catch {
      setError('Could not fetch folder suggestions')
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [snippetId, snippetName, snippetText, currentFolderId, dismissed, folders, ollamaUrl, ollamaModel])

  // Debounced fetch when snippet changes
  useEffect(() => {
    setDismissed(false)
    setSuggestions([])
    lastRequestRef.current = ''

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (currentFolderId || snippetText.length < MIN_TEXT_LENGTH) return

    debounceRef.current = setTimeout(fetchSuggestions, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [snippetId, snippetName, snippetText, currentFolderId, fetchSuggestions])

  // Clear when snippet gets assigned to folder
  useEffect(() => {
    if (currentFolderId) {
      setSuggestions([])
    }
  }, [currentFolderId])

  const handleSelect = (suggestion: FolderSuggestion) => {
    // Check if folder already exists (case-insensitive)
    const existing = folders.find(
      (f) => f.name.toLowerCase() === suggestion.folder.toLowerCase()
    )

    if (existing) {
      moveSnippetsToFolder([snippetId], existing.id)
    } else {
      // Create new folder then move snippet into it
      const newFolder = createFolder({ name: suggestion.folder })
      moveSnippetsToFolder([snippetId], newFolder.id)
    }

    setSuggestions([])
  }

  const handleDismiss = () => {
    setDismissed(true)
    setSuggestions([])
  }

  if (!loading && suggestions.length === 0 && !error) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                onClick={() => handleSelect(s)}
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
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-secondary-foreground transition-colors"
            aria-label="Dismiss suggestions"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}
