'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { exportSnippets } from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import { ValidationDialog } from '@/components/ValidationDialog'
import { FileText, Plus } from 'lucide-react'
import type { Snippet } from '@/types'

interface ContextMenuState {
  x: number
  y: number
  visible: boolean
}

export function Sidebar() {
  const snippets = useSnippetStore((s) => s.snippets)
  const selectedId = useSnippetStore((s) => s.selectedId)
  const selectedIds = useSnippetStore((s) => s.selectedIds)
  const selectSnippet = useSnippetStore((s) => s.selectSnippet)
  const toggleSelectSnippet = useSnippetStore((s) => s.toggleSelectSnippet)
  const createSnippet = useSnippetStore((s) => s.createSnippet)
  const getSelectedSnippets = useSnippetStore((s) => s.getSelectedSnippets)
  const clearSelection = useSnippetStore((s) => s.clearSelection)

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false })
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent, snippetId: string) => {
    e.preventDefault()
    // If right-clicking on unselected item, select only that item
    if (!selectedIds.has(snippetId)) {
      selectSnippet(snippetId)
    }
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true })
  }, [selectedIds, selectSnippet])

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }))
  }, [])

  // Close context menu on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu.visible, closeContextMenu])

  const doExport = useCallback(async (toExport: Snippet[]) => {
    try {
      const filename = await exportSnippets(toExport)
      toast.success(`Exported ${toExport.length} snippet${toExport.length > 1 ? 's' : ''} to ${filename}`)
      clearSelection()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      toast.error('Export failed')
    }
  }, [clearSelection])

  const handleExportSelected = useCallback(() => {
    closeContextMenu()
    const selected = getSelectedSnippets()
    if (selected.length === 0) {
      toast.error('No snippets selected')
      return
    }

    // Validate before export
    const result = validateSnippets(selected)
    if (result.issues.length > 0) {
      setValidationResult(result)
      setPendingExport(selected)
      return
    }

    // No issues, export directly
    doExport(selected)
  }, [getSelectedSnippets, closeContextMenu, doExport])

  const handleValidationClose = useCallback(() => {
    setValidationResult(null)
    setPendingExport(null)
  }, [])

  const handleValidationProceed = useCallback(() => {
    if (pendingExport) {
      doExport(pendingExport)
    }
    setValidationResult(null)
    setPendingExport(null)
  }, [pendingExport, doExport])

  const handleNavigateToSnippet = useCallback((snippetId: string) => {
    selectSnippet(snippetId)
  }, [selectSnippet])

  const handleClick = useCallback((e: React.MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl+click: toggle selection
      toggleSelectSnippet(id, false)
    } else if (e.shiftKey) {
      // Shift+click: range select
      toggleSelectSnippet(id, true)
    } else {
      // Normal click: select only this item
      selectSnippet(id)
    }
  }, [toggleSelectSnippet, selectSnippet])

  const handleNewSnippet = useCallback(() => {
    createSnippet({ name: 'New Snippet', text: '' })
  }, [createSnippet])

  return (
    <aside className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-900/50">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-400">Snippets</span>
        <button
          onClick={handleNewSnippet}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          title="New snippet"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {snippets.length === 0 ? (
          <p className="text-sm text-zinc-500 p-2">No snippets yet</p>
        ) : (
          <ul className="space-y-1">
            {snippets.map((snippet) => (
              <li
                key={snippet.id}
                onClick={(e) => handleClick(e, snippet.id)}
                onContextMenu={(e) => handleContextMenu(e, snippet.id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors',
                  selectedIds.has(snippet.id)
                    ? 'bg-blue-600/30 text-blue-200'
                    : selectedId === snippet.id
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                )}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{snippet.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="p-2 border-t border-zinc-800 text-xs text-zinc-500">
          {selectedIds.size} selected
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg py-1 min-w-[160px]"
        >
          <button
            onClick={handleExportSelected}
            className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Export Selected ({selectedIds.size})
          </button>
        </div>
      )}

      {validationResult && (
        <ValidationDialog
          result={validationResult}
          open={!!validationResult}
          onClose={handleValidationClose}
          onProceed={handleValidationProceed}
          onNavigateToSnippet={handleNavigateToSnippet}
        />
      )}
    </aside>
  )
}
