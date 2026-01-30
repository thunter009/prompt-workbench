'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnippetStore } from '@/lib/store'

const DEBOUNCE_MS = 500

export interface EditorPanelHeaderProps {
  onScrollProgress?: (progress: number) => void
}

export function EditorPanelHeader() {
  const selectedId = useSnippetStore((s) => s.selectedId)
  const getSelectedSnippet = useSnippetStore((s) => s.getSelectedSnippet)
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)

  const [keywordValue, setKeywordValue] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync keyword from store when selection changes
  useEffect(() => {
    const snippet = getSelectedSnippet()
    setKeywordValue(snippet?.keyword ?? '')
  }, [selectedId, getSelectedSnippet])

  const handleKeywordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setKeywordValue(value)

    // Debounce save to store
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      if (selectedId) {
        updateSnippet(selectedId, { keyword: value || undefined })
      }
    }, DEBOUNCE_MS)
  }, [selectedId, updateSnippet])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  if (!selectedId) {
    return null
  }

  return (
    <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-3">
      <label className="text-sm text-zinc-500 shrink-0">Keyword</label>
      <input
        type="text"
        value={keywordValue}
        onChange={handleKeywordChange}
        placeholder="!keyword"
        className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}
