'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { exportSnippets } from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import { ValidationDialog } from '@/components/ValidationDialog'
import { ExportFolderDialog } from '@/components/ExportFolderDialog'
import { FileText, Plus, Folder as FolderIcon, ChevronRight, Filter } from 'lucide-react'
import type { Snippet, Folder } from '@/types'

type ContextMenuType = 'snippet' | 'folder'

interface ContextMenuState {
  x: number
  y: number
  visible: boolean
  type: ContextMenuType
  folderId?: string
}

export function Sidebar() {
  const snippets = useSnippetStore((s) => s.snippets)
  const folders = useSnippetStore((s) => s.folders)
  const selectedId = useSnippetStore((s) => s.selectedId)
  const selectedIds = useSnippetStore((s) => s.selectedIds)
  const selectedFolderId = useSnippetStore((s) => s.selectedFolderId)
  const exportFilter = useSnippetStore((s) => s.exportFilter)
  const selectSnippet = useSnippetStore((s) => s.selectSnippet)
  const selectFolder = useSnippetStore((s) => s.selectFolder)
  const toggleSelectSnippet = useSnippetStore((s) => s.toggleSelectSnippet)
  const createSnippet = useSnippetStore((s) => s.createSnippet)
  const getSelectedSnippets = useSnippetStore((s) => s.getSelectedSnippets)
  const getSnippetsInFolder = useSnippetStore((s) => s.getSnippetsInFolder)
  const clearSelection = useSnippetStore((s) => s.clearSelection)
  const markExported = useSnippetStore((s) => s.markExported)
  const setExportFilter = useSnippetStore((s) => s.setExportFilter)

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false, type: 'snippet' })
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)
  const [exportFolderDialog, setExportFolderDialog] = useState<{ open: boolean; folderId: string | null }>({ open: false, folderId: null })
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)

  // Build folder tree structure
  const { rootFolders, folderMap } = useMemo(() => {
    const folderMap = new Map<string, Folder[]>()
    const rootFolders: Folder[] = []

    for (const folder of folders) {
      if (folder.parentId) {
        const children = folderMap.get(folder.parentId) || []
        children.push(folder)
        folderMap.set(folder.parentId, children)
      } else {
        rootFolders.push(folder)
      }
    }

    // Sort folders by orderIndex
    rootFolders.sort((a, b) => a.orderIndex - b.orderIndex)
    for (const children of folderMap.values()) {
      children.sort((a, b) => a.orderIndex - b.orderIndex)
    }

    return { rootFolders, folderMap }
  }, [folders])

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  const handleSnippetContextMenu = useCallback((e: React.MouseEvent, snippetId: string) => {
    e.preventDefault()
    if (!selectedIds.has(snippetId)) {
      selectSnippet(snippetId)
    }
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, type: 'snippet' })
  }, [selectedIds, selectSnippet])

  const handleFolderContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    selectFolder(folderId)
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, type: 'folder', folderId })
  }, [selectFolder])

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
      markExported(toExport.map((s) => s.id))
      toast.success(`Exported ${toExport.length} snippet${toExport.length > 1 ? 's' : ''} to ${filename}`)
      clearSelection()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      toast.error('Export failed')
    }
  }, [clearSelection, markExported])

  const handleExportSelected = useCallback(() => {
    closeContextMenu()
    const selected = getSelectedSnippets()
    if (selected.length === 0) {
      toast.error('No snippets selected')
      return
    }

    const result = validateSnippets(selected)
    if (result.issues.length > 0) {
      setValidationResult(result)
      setPendingExport(selected)
      return
    }

    doExport(selected)
  }, [getSelectedSnippets, closeContextMenu, doExport])

  const handleExportFolder = useCallback(() => {
    closeContextMenu()
    if (contextMenu.folderId) {
      setExportFolderDialog({ open: true, folderId: contextMenu.folderId })
    }
  }, [closeContextMenu, contextMenu.folderId])

  const handleExportFolderConfirm = useCallback((includeSubfolders: boolean) => {
    if (!exportFolderDialog.folderId) return

    const toExport = getSnippetsInFolder(exportFolderDialog.folderId, includeSubfolders)

    if (toExport.length === 0) {
      toast.error('No snippets in folder')
      setExportFolderDialog({ open: false, folderId: null })
      return
    }

    const result = validateSnippets(toExport)
    if (result.issues.length > 0) {
      setValidationResult(result)
      setPendingExport(toExport)
      setExportFolderDialog({ open: false, folderId: null })
      return
    }

    doExport(toExport)
    setExportFolderDialog({ open: false, folderId: null })
  }, [exportFolderDialog.folderId, getSnippetsInFolder, doExport])

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

  const handleSnippetClick = useCallback((e: React.MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey) {
      toggleSelectSnippet(id, false)
    } else if (e.shiftKey) {
      toggleSelectSnippet(id, true)
    } else {
      selectSnippet(id)
    }
  }, [toggleSelectSnippet, selectSnippet])

  const handleFolderClick = useCallback((e: React.MouseEvent, folderId: string) => {
    e.stopPropagation()
    toggleFolder(folderId)
  }, [toggleFolder])

  const handleNewSnippet = useCallback(() => {
    createSnippet({ name: 'New Snippet', text: '' })
  }, [createSnippet])

  const needsExport = (snippet: Snippet) =>
    !snippet.lastExportedAt || snippet.updatedAt > snippet.lastExportedAt

  const renderSnippet = (snippet: Snippet, depth: number = 0) => {
    const showIndicator = needsExport(snippet)
    return (
      <li
        key={snippet.id}
        onClick={(e) => handleSnippetClick(e, snippet.id)}
        onContextMenu={(e) => handleSnippetContextMenu(e, snippet.id)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={cn(
          'flex items-center gap-2 pr-2 py-1.5 rounded cursor-pointer text-sm transition-colors',
          selectedIds.has(snippet.id)
            ? 'bg-blue-600/30 text-blue-200'
            : selectedId === snippet.id
              ? 'bg-zinc-800 text-zinc-200'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
        )}
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1">{snippet.name}</span>
        {showIndicator && (
          <span
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              snippet.lastExportedAt ? 'bg-amber-500' : 'bg-blue-500'
            )}
            title={snippet.lastExportedAt ? 'Modified since export' : 'Never exported'}
          />
        )}
      </li>
    )
  }

  const renderFolder = (folder: Folder, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id)
    const childFolders = folderMap.get(folder.id) || []
    const folderSnippets = getFilteredSnippetsForFolder(folder.id)
    const snippetCount = getSnippetCount(folder.id)
    const isEmpty = childFolders.length === 0 && folderSnippets.length === 0

    return (
      <li key={folder.id}>
        <div
          onClick={(e) => handleFolderClick(e, folder.id)}
          onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={cn(
            'flex items-center gap-1 pr-2 py-1.5 rounded cursor-pointer text-sm transition-colors',
            selectedFolderId === folder.id
              ? 'bg-zinc-800 text-zinc-200'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
          )}
        >
          <ChevronRight
            className={cn('w-4 h-4 shrink-0 transition-transform', isExpanded && 'rotate-90')}
          />
          <FolderIcon className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">{folder.name}</span>
          {snippetCount > 0 && (
            <span className="text-xs text-zinc-500 tabular-nums">{snippetCount}</span>
          )}
        </div>
        {isExpanded && (
          <ul className="space-y-0.5">
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {folderSnippets.map((snippet) => renderSnippet(snippet, depth + 1))}
            {isEmpty && (
              <li
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                className="py-1.5 text-xs text-zinc-600 italic"
              >
                Empty folder
              </li>
            )}
          </ul>
        )}
      </li>
    )
  }

  const currentFolder = exportFolderDialog.folderId
    ? folders.find((f) => f.id === exportFolderDialog.folderId)
    : null

  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)

  // Close filter menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false)
      }
    }
    if (filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filterMenuOpen])

  // Filter snippets based on export status
  const filteredSnippets = useMemo(() => {
    if (exportFilter === 'all') return snippets
    return snippets.filter((s) => {
      const notExported = !s.lastExportedAt
      const modified = s.lastExportedAt && s.updatedAt > s.lastExportedAt
      if (exportFilter === 'unexported') return notExported
      if (exportFilter === 'modified') return modified
      return true
    })
  }, [snippets, exportFilter])

  // Recalculate root snippets with filter
  const filteredRootSnippets = useMemo(() => {
    return filteredSnippets.filter((s) => !s.folderId)
  }, [filteredSnippets])

  const getFilteredSnippetsForFolder = useCallback((folderId: string) => {
    return filteredSnippets.filter((s) => s.folderId === folderId)
  }, [filteredSnippets])

  // Count snippets recursively in folder (including subfolders)
  const getSnippetCount = useCallback((folderId: string): number => {
    const directSnippets = filteredSnippets.filter((s) => s.folderId === folderId).length
    const childFolders = folderMap.get(folderId) || []
    const childCount = childFolders.reduce((acc, child) => acc + getSnippetCount(child.id), 0)
    return directSnippets + childCount
  }, [filteredSnippets, folderMap])

  return (
    <aside className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-900/50">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-400">Snippets</span>
        <div className="flex items-center gap-1">
          <div className="relative" ref={filterMenuRef}>
            <button
              onClick={() => setFilterMenuOpen((v) => !v)}
              className={cn(
                'p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200',
                exportFilter !== 'all' && 'text-blue-400'
              )}
              title="Filter by export status"
            >
              <Filter className="w-4 h-4" />
            </button>
            {filterMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg py-1 min-w-[140px] z-50">
                {(['all', 'unexported', 'modified'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setExportFilter(f)
                      setFilterMenuOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-700',
                      exportFilter === f ? 'text-blue-400' : 'text-zinc-300'
                    )}
                  >
                    {f === 'all' ? 'All' : f === 'unexported' ? 'Never exported' : 'Modified'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleNewSnippet}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="New snippet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {folders.length === 0 && snippets.length === 0 ? (
          <p className="text-sm text-zinc-500 p-2">No snippets yet</p>
        ) : filteredSnippets.length === 0 && exportFilter !== 'all' ? (
          <p className="text-sm text-zinc-500 p-2">No {exportFilter} snippets</p>
        ) : (
          <ul className="space-y-0.5">
            {rootFolders.map((folder) => renderFolder(folder))}
            {filteredRootSnippets.map((snippet) => renderSnippet(snippet))}
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
          {contextMenu.type === 'snippet' && (
            <button
              onClick={handleExportSelected}
              className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Export Selected ({selectedIds.size})
            </button>
          )}
          {contextMenu.type === 'folder' && (
            <button
              onClick={handleExportFolder}
              className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Export Folder
            </button>
          )}
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

      {exportFolderDialog.open && currentFolder && (
        <ExportFolderDialog
          open={exportFolderDialog.open}
          folderName={currentFolder.name}
          onClose={() => setExportFolderDialog({ open: false, folderId: null })}
          onConfirm={handleExportFolderConfirm}
        />
      )}
    </aside>
  )
}
