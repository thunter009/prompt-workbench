'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSnippetStore, MAX_DEPTH } from '@/lib/store'
import { useUndoStore } from '@/lib/undo-store'
import { exportSnippets } from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import { TagFilter } from '@/components/TagFilter'
import { ValidationDialog } from '@/components/ValidationDialog'
import { ExportFolderDialog } from '@/components/ExportFolderDialog'
import { FolderReorgModal } from '@/components/FolderReorgModal'
import { FileText, Plus, Folder as FolderIcon, FolderPlus, ChevronRight, Filter, ChevronsDownUp, ChevronsUpDown, Pencil, Sparkles, Copy, Trash2, FolderInput, Download, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { useMethodologyStore, validateFolderName } from '@/lib/folder-methodology'
import { dbClient } from '@/lib/db/client'
import type { Snippet, Folder } from '@/types'

type DragItemType = 'snippet' | 'folder'

interface DropPosition {
  targetId: string | null // folder id or null for root
  position: 'inside' | 'before' | 'after' // inside folder, or before/after sibling
}

interface DragState {
  isDragging: boolean
  dragType: DragItemType | null
  draggedIds: Set<string>       // snippet ids when dragging snippets
  draggedFolderId: string | null // folder id when dragging folder
  dropTarget: DropPosition | null
}

type ContextMenuType = 'snippet' | 'folder'

interface ContextMenuState {
  x: number
  y: number
  visible: boolean
  type: ContextMenuType
  folderId?: string
}

function BulkToolbar({
  selectedIds,
  folders,
  onDelete,
  onMove,
  onExport,
  onClear,
  getFolderDepth,
}: {
  selectedIds: Set<string>
  folders: Folder[]
  onDelete: () => void
  onMove: (folderId: string | null) => void
  onExport: () => void
  onClear: () => void
  getFolderDepth: (id: string) => number
}) {
  const [moveOpen, setMoveOpen] = useState(false)
  const moveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moveOpen) return
    const handler = (e: MouseEvent) => {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) {
        setMoveOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moveOpen])

  return (
    <div data-testid="bulk-toolbar" className="p-2 border-t border-border bg-muted/80 flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-auto">{selectedIds.size} selected</span>
      <button
        data-testid="bulk-delete"
        onClick={onDelete}
        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
        title="Delete selected"
        aria-label="Delete selected"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <div className="relative" ref={moveRef}>
        <button
          data-testid="bulk-move"
          onClick={() => setMoveOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Move to folder"
          aria-label="Move to folder"
        >
          <FolderInput className="w-3.5 h-3.5" />
        </button>
        {moveOpen && (
          <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px] max-h-[200px] overflow-y-auto z-50">
            <button
              onClick={() => { onMove(null); setMoveOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              Root
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => { onMove(f.id); setMoveOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors truncate"
                style={{ paddingLeft: `${getFolderDepth(f.id) * 8 + 12}px` }}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        data-testid="bulk-export"
        onClick={onExport}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Export selected"
        aria-label="Export selected"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
      <button
        data-testid="bulk-clear"
        onClick={onClear}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Clear selection"
        aria-label="Clear selection"
      >
        <XCircle className="w-3.5 h-3.5" />
      </button>
    </div>
  )
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
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const clearSelection = useSnippetStore((s) => s.clearSelection)
  const markExported = useSnippetStore((s) => s.markExported)
  const setExportFilter = useSnippetStore((s) => s.setExportFilter)
  const createFolder = useSnippetStore((s) => s.createFolder)
  const updateFolder = useSnippetStore((s) => s.updateFolder)
  const moveSnippetsToFolder = useSnippetStore((s) => s.moveSnippetsToFolder)
  const moveFolder = useSnippetStore((s) => s.moveFolder)
  const getFolderDepth = useSnippetStore((s) => s.getFolderDepth)
  const isDescendantOf = useSnippetStore((s) => s.isDescendantOf)
  const reorderFolderSiblings = useSnippetStore((s) => s.reorderFolderSiblings)
  const deleteFolder = useSnippetStore((s) => s.deleteFolder)
  const getSubfolderIds = useSnippetStore((s) => s.getSubfolderIds)
  const deleteSnippets = useSnippetStore((s) => s.deleteSnippets)
  const duplicateSnippet = useSnippetStore((s) => s.duplicateSnippet)
  const selectedTags = useSnippetStore((s) => s.selectedTags)
  const tagFilterMode = useSnippetStore((s) => s.tagFilterMode)
  const getRecentSnippets = useSnippetStore((s) => s.getRecentSnippets)

  const methodologyConfig = useMethodologyStore((s) => s.config)

  const pushUndoAction = useUndoStore((s) => s.pushAction)
  const undo = useUndoStore((s) => s.undo)
  const canUndo = useUndoStore((s) => s.canUndo)

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false, type: 'snippet' })
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragType: null,
    draggedIds: new Set(),
    draggedFolderId: null,
    dropTarget: null,
  })
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)
  const [exportFolderDialog, setExportFolderDialog] = useState<{ open: boolean; folderId: string | null }>({ open: false, folderId: null })
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null)
  const [editingSnippetName, setEditingSnippetName] = useState('')
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<{ open: boolean; folderId: string | null; hasContents: boolean; snippetCount: number; subfolderCount: number }>({ open: false, folderId: null, hasContents: false, snippetCount: 0, subfolderCount: 0 })
  const [deleteSnippetDialog, setDeleteSnippetDialog] = useState<{ open: boolean; snippetIds: string[] }>({ open: false, snippetIds: [] })
  const [moveToFolderOpen, setMoveToFolderOpen] = useState(false)
  const [reorgOpen, setReorgOpen] = useState(false)
  const [recentExpanded, setRecentExpanded] = useState(true)
  const [contextMenuIndex, setContextMenuIndex] = useState(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const sidebarListRef = useRef<HTMLUListElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const snippetInputRef = useRef<HTMLInputElement>(null)
  const deleteSnippetDialogRef = useRef<HTMLDialogElement>(null)
  const deleteFolderDialogRef = useRef<HTMLDialogElement>(null)

  // Initialize expanded folders from DB
  const [expandedFoldersInitialized, setExpandedFoldersInitialized] = useState(false)
  useEffect(() => {
    if (expandedFoldersInitialized) return
    dbClient.getSettings(['expandedFolders']).then((settings) => {
      const stored = settings.expandedFolders as string[] | undefined
      if (stored) {
        const validIds = stored.filter((id) => folders.some((f) => f.id === id))
        setExpandedFolders(new Set(validIds))
      }
    }).catch(() => {})
    setExpandedFoldersInitialized(true)
  }, [folders, expandedFoldersInitialized])

  // Persist expanded folders to DB
  useEffect(() => {
    if (!expandedFoldersInitialized) return
    dbClient.saveSetting('expandedFolders', [...expandedFolders])
  }, [expandedFolders, expandedFoldersInitialized])

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

  const expandAllFolders = useCallback(() => {
    setExpandedFolders(new Set(folders.map((f) => f.id)))
  }, [folders])

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders(new Set())
  }, [])

  const handleSnippetContextMenu = useCallback((e: React.MouseEvent, snippetId: string) => {
    e.preventDefault()
    if (!selectedIds.has(snippetId)) {
      selectSnippet(snippetId)
    }
    setContextMenuIndex(-1)
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, type: 'snippet' })
  }, [selectedIds, selectSnippet])

  const handleFolderContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    selectFolder(folderId)
    setContextMenuIndex(-1)
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, type: 'folder', folderId })
  }, [selectFolder])

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }))
    setMoveToFolderOpen(false)
  }, [])

  // Close context menu on click outside or escape; arrow key + enter nav
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    const handleMenuKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu()
        return
      }
      if (!menuRef.current) return
      const items = Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      if (items.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = contextMenuIndex < items.length - 1 ? contextMenuIndex + 1 : 0
        setContextMenuIndex(next)
        items[next]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = contextMenuIndex > 0 ? contextMenuIndex - 1 : items.length - 1
        setContextMenuIndex(prev)
        items[prev]?.focus()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (contextMenuIndex >= 0 && contextMenuIndex < items.length) {
          items[contextMenuIndex]?.click()
        }
      }
    }

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleMenuKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleMenuKeyDown)
    }
  }, [contextMenu.visible, closeContextMenu, contextMenuIndex])

  const doExport = useCallback(async (toExport: Snippet[]) => {
    try {
      const filename = await exportSnippets(toExport, snippets)
      markExported(toExport.map((s) => s.id))
      toast.success(`Exported ${toExport.length} snippet${toExport.length > 1 ? 's' : ''} to ${filename}`)
      clearSelection()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      toast.error('Export failed')
    }
  }, [clearSelection, markExported, snippets])

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

  const handleDeleteFolder = useCallback(() => {
    closeContextMenu()
    if (!contextMenu.folderId) return

    // Check if folder has contents (snippets or subfolders)
    const subfolderIds = getSubfolderIds(contextMenu.folderId)
    const hasSubfolders = subfolderIds.length > 0
    const folderIds = [contextMenu.folderId, ...subfolderIds]
    const hasSnippets = snippets.some((s) => s.folderId && folderIds.includes(s.folderId))
    const hasContents = hasSubfolders || hasSnippets

    if (hasContents) {
      const affectedSnippetCount = snippets.filter((s) => s.folderId && folderIds.includes(s.folderId)).length
      setDeleteFolderDialog({ open: true, folderId: contextMenu.folderId, hasContents: true, snippetCount: affectedSnippetCount, subfolderCount: subfolderIds.length })
    } else {
      // Delete immediately if empty
      deleteFolder(contextMenu.folderId)
      toast.success('Folder deleted')
    }
  }, [closeContextMenu, contextMenu.folderId, getSubfolderIds, snippets, deleteFolder])

  const handleDeleteFolderConfirm = useCallback(() => {
    if (!deleteFolderDialog.folderId) return

    // Get all subfolders to delete
    const subfolderIds = getSubfolderIds(deleteFolderDialog.folderId)
    const allFolderIds = [deleteFolderDialog.folderId, ...subfolderIds]

    // Delete all folders (snippets will be orphaned to root by store)
    for (const id of allFolderIds.reverse()) {
      deleteFolder(id)
    }

    toast.success('Folder deleted')
    setDeleteFolderDialog({ open: false, folderId: null, hasContents: false, snippetCount: 0, subfolderCount: 0 })
  }, [deleteFolderDialog.folderId, getSubfolderIds, deleteFolder])

  // Snippet CRUD handlers
  const handleDeleteSelectedSnippets = useCallback(() => {
    closeContextMenu()
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setDeleteSnippetDialog({ open: true, snippetIds: ids })
  }, [selectedIds, closeContextMenu])

  const handleDeleteSnippetConfirm = useCallback(() => {
    const { snippetIds } = deleteSnippetDialog
    if (snippetIds.length === 0) return
    const deleted = deleteSnippets(snippetIds)
    if (deleted.length > 0) {
      pushUndoAction({ type: 'snippetDelete', deletedSnippets: deleted })
      // Undo delete snippet toast with action button
      toast.success(`Deleted ${deleted.length} snippet${deleted.length > 1 ? 's' : ''}`, {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => undo(),
        },
      })
    }
    setDeleteSnippetDialog({ open: false, snippetIds: [] })
  }, [deleteSnippetDialog, deleteSnippets, pushUndoAction, undo])

  const handleDuplicateSnippet = useCallback(() => {
    closeContextMenu()
    // Duplicate the first selected snippet
    const id = selectedIds.size > 0 ? Array.from(selectedIds)[0] : selectedId
    if (!id) return
    const copy = duplicateSnippet(id)
    if (copy) {
      toast.success(`Duplicated "${copy.name}"`)
    }
  }, [selectedIds, selectedId, duplicateSnippet, closeContextMenu])

  const handleRenameSnippet = useCallback(() => {
    closeContextMenu()
    const id = selectedIds.size > 0 ? Array.from(selectedIds)[0] : selectedId
    if (!id) return
    const snippet = snippets.find((s) => s.id === id)
    if (snippet) {
      setEditingSnippetId(id)
      setEditingSnippetName(snippet.name)
    }
  }, [selectedIds, selectedId, snippets, closeContextMenu])

  const handleMoveToFolder = useCallback((targetFolderId: string | null) => {
    closeContextMenu()
    setMoveToFolderOpen(false)
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const snippetsToMove = ids.filter((id) => {
      const snippet = snippets.find((s) => s.id === id)
      return snippet && (snippet.folderId ?? null) !== targetFolderId
    })
    if (snippetsToMove.length === 0) return

    const previousFolders = moveSnippetsToFolder(snippetsToMove, targetFolderId)
    pushUndoAction({ type: 'move', snippetIds: snippetsToMove, previousFolders, targetFolderId })

    if (targetFolderId) {
      setExpandedFolders((prev) => new Set([...prev, targetFolderId]))
    }

    const folderName = targetFolderId ? folders.find((f) => f.id === targetFolderId)?.name : 'Root'
    const movedNames = snippetsToMove.map((id) => snippets.find((s) => s.id === id)?.name).filter(Boolean)
    const label = movedNames.length === 1 ? `"${movedNames[0]}"` : `${movedNames.length} snippets`
    toast.success(`Moved ${label} to ${folderName || 'Root'}`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => undo(),
      },
    })
  }, [selectedIds, snippets, folders, moveSnippetsToFolder, pushUndoAction, closeContextMenu, undo])

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
    selectFolder(folderId)
    toggleFolder(folderId)
  }, [selectFolder, toggleFolder])

  const handleSnippetDoubleClick = useCallback((e: React.MouseEvent, snippetId: string) => {
    e.stopPropagation()
    const snippet = snippets.find((s) => s.id === snippetId)
    if (snippet) {
      setEditingSnippetId(snippetId)
      setEditingSnippetName(snippet.name)
    }
  }, [snippets])

  const handleFolderDoubleClick = useCallback((e: React.MouseEvent, folderId: string) => {
    e.stopPropagation()
    const folder = folders.find((f) => f.id === folderId)
    if (folder) {
      setEditingFolderId(folderId)
      setEditingFolderName(folder.name)
    }
  }, [folders])

  // Drag & Drop handlers for snippets
  const handleSnippetDragStart = useCallback((e: React.DragEvent, snippetId: string) => {
    // If dragging a non-selected item, select only that item
    // If dragging a selected item, drag all selected items
    const idsToMove = selectedIds.has(snippetId) ? new Set(selectedIds) : new Set([snippetId])

    setDragState({
      isDragging: true,
      dragType: 'snippet',
      draggedIds: idsToMove,
      draggedFolderId: null,
      dropTarget: null,
    })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-snippet', Array.from(idsToMove).join(','))

    // Custom drag image showing count
    if (idsToMove.size > 1) {
      const dragEl = document.createElement('div')
      dragEl.className = 'bg-blue-600 text-white px-2 py-1 rounded text-sm'
      dragEl.textContent = `${idsToMove.size} snippets`
      dragEl.style.position = 'absolute'
      dragEl.style.top = '-1000px'
      document.body.appendChild(dragEl)
      e.dataTransfer.setDragImage(dragEl, 0, 0)
      setTimeout(() => document.body.removeChild(dragEl), 0)
    }
  }, [selectedIds])

  // Drag & Drop handlers for folders
  const handleFolderDragStart = useCallback((e: React.DragEvent, folderId: string) => {
    e.stopPropagation()
    setDragState({
      isDragging: true,
      dragType: 'folder',
      draggedIds: new Set(),
      draggedFolderId: folderId,
      dropTarget: null,
    })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-folder', folderId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      dragType: null,
      draggedIds: new Set(),
      draggedFolderId: null,
      dropTarget: null,
    })
  }, [])

  // Calculate max depth of a folder's subtree
  const getMaxSubtreeDepth = useCallback((folderId: string): number => {
    const children = folderMap.get(folderId) || []
    if (children.length === 0) return 0
    return 1 + Math.max(...children.map((c) => getMaxSubtreeDepth(c.id)))
  }, [folderMap])

  // Check if folder can be dropped at target (depth + circular checks)
  const canDropFolder = useCallback((folderId: string, targetParentId: string | null): boolean => {
    // Can't drop on itself
    if (folderId === targetParentId) return false

    // Can't drop into own descendants (circular)
    if (targetParentId && isDescendantOf(targetParentId, folderId)) return false

    // Check depth: target depth + folder's subtree depth must be <= 2 (0-indexed, so max 3 levels)
    const targetDepth = targetParentId ? getFolderDepth(targetParentId) + 1 : 0
    const subtreeDepth = getMaxSubtreeDepth(folderId)
    return targetDepth + subtreeDepth <= MAX_DEPTH - 1
  }, [getFolderDepth, isDescendantOf, getMaxSubtreeDepth])

  // dragover handler: visual feedback on drop targets
  const handleDragOver = useCallback((e: React.DragEvent, targetFolderId: string | null, forcePosition?: 'inside' | 'before' | 'after') => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'

    // Determine drop position based on mouse position within element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let position: 'inside' | 'before' | 'after' = forcePosition || 'inside'
    if (!forcePosition && dragState.dragType === 'folder' && targetFolderId) {
      // For folder drops, use thirds: top = before, middle = inside, bottom = after
      if (y < height * 0.25) position = 'before'
      else if (y > height * 0.75) position = 'after'
      else position = 'inside'
    }

    setDragState((prev) => ({
      ...prev,
      dropTarget: { targetId: targetFolderId, position },
    }))
  }, [dragState.dragType])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Only clear if leaving to outside, not to a child element
    const relatedTarget = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragState((prev) => ({ ...prev, dropTarget: null }))
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault()
    e.stopPropagation()

    const { dropTarget } = dragState

    // Handle snippet drop
    const snippetData = e.dataTransfer.getData('application/x-snippet')
    if (snippetData) {
      const snippetIds = snippetData.split(',').filter(Boolean)
      if (snippetIds.length === 0) {
        handleDragEnd()
        return
      }

      // Check if any snippet is already in target folder
      const snippetsToMove = snippetIds.filter((id) => {
        const snippet = snippets.find((s) => s.id === id)
        return snippet && snippet.folderId !== targetFolderId
      })

      if (snippetsToMove.length === 0) {
        handleDragEnd()
        return
      }

      // Move snippets and track for undo
      const previousFolders = moveSnippetsToFolder(snippetsToMove, targetFolderId)
      pushUndoAction({
        type: 'move',
        snippetIds: snippetsToMove,
        previousFolders,
        targetFolderId,
      })

      // Expand target folder if dropping into one
      if (targetFolderId) {
        setExpandedFolders((prev) => new Set([...prev, targetFolderId]))
      }

      const folderName = targetFolderId ? folders.find((f) => f.id === targetFolderId)?.name : 'root'
      toast.success(`Moved ${snippetsToMove.length} snippet${snippetsToMove.length > 1 ? 's' : ''} to ${folderName || 'root'}`)
      handleDragEnd()
      return
    }

    // Handle folder drop
    const folderData = e.dataTransfer.getData('application/x-folder')
    if (folderData && dropTarget) {
      const draggedFolderId = folderData
      const draggedFolder = folders.find((f) => f.id === draggedFolderId)
      if (!draggedFolder) {
        handleDragEnd()
        return
      }

      const { targetId, position } = dropTarget

      if (position === 'inside') {
        // Nesting into a folder
        if (!canDropFolder(draggedFolderId, targetId)) {
          toast.error(targetId && isDescendantOf(targetId, draggedFolderId)
            ? "Can't move folder into its own subfolder"
            : 'Maximum folder depth is 3 levels')
          handleDragEnd()
          return
        }

        // Calculate new order index (last among siblings)
        const newSiblings = folders.filter((f) => f.parentId === (targetId ?? undefined))
        const newOrderIndex = newSiblings.length > 0
          ? Math.max(...newSiblings.map((f) => f.orderIndex)) + 1
          : 0

        const { previousParentId, previousOrderIndex } = moveFolder(draggedFolderId, targetId, newOrderIndex)
        pushUndoAction({
          type: 'moveFolder',
          folderId: draggedFolderId,
          previousParentId,
          previousOrderIndex,
          newParentId: targetId,
          newOrderIndex,
        })

        // Expand target folder
        if (targetId) {
          setExpandedFolders((prev) => new Set([...prev, targetId]))
        }

        const targetName = targetId ? folders.find((f) => f.id === targetId)?.name : 'root'
        toast.success(`Moved "${draggedFolder.name}" into ${targetName || 'root'}`)
      } else {
        // Reordering among siblings (before/after)
        const targetFolder = targetId ? folders.find((f) => f.id === targetId) : null

        // For before/after, the target's parent becomes the dragged folder's new parent
        const newParentId = targetFolder?.parentId ?? null

        // Check depth if parent is changing
        if (newParentId !== (draggedFolder.parentId ?? null)) {
          if (!canDropFolder(draggedFolderId, newParentId)) {
            toast.error('Maximum folder depth is 3 levels')
            handleDragEnd()
            return
          }
        }

        // Get current siblings at the target level
        const siblings = folders
          .filter((f) => f.parentId === (newParentId ?? undefined) && f.id !== draggedFolderId)
          .sort((a, b) => a.orderIndex - b.orderIndex)

        // Find target index
        let targetIndex = siblings.findIndex((f) => f.id === targetId)
        if (targetIndex === -1) targetIndex = siblings.length
        if (position === 'after') targetIndex++

        // If same parent, just reorder
        if (newParentId === (draggedFolder.parentId ?? null)) {
          const previousOrders = reorderFolderSiblings(draggedFolderId, targetIndex)
          pushUndoAction({
            type: 'reorderFolders',
            changes: previousOrders,
          })
          toast.success(`Reordered "${draggedFolder.name}"`)
        } else {
          // Different parent - move then reorder
          const { previousParentId, previousOrderIndex } = moveFolder(draggedFolderId, newParentId, targetIndex)

          // Renumber all siblings
          const newSiblings = folders
            .filter((f) => f.parentId === (newParentId ?? undefined))
            .sort((a, b) => a.orderIndex - b.orderIndex)

          // Insert dragged folder at correct position and renumber
          newSiblings.splice(targetIndex, 0, { ...draggedFolder, parentId: newParentId ?? undefined })
          newSiblings.forEach((f, i) => {
            if (f.orderIndex !== i) {
              moveFolder(f.id, f.parentId ?? null, i)
            }
          })

          pushUndoAction({
            type: 'moveFolder',
            folderId: draggedFolderId,
            previousParentId,
            previousOrderIndex,
            newParentId,
            newOrderIndex: targetIndex,
          })

          const targetName = newParentId ? folders.find((f) => f.id === newParentId)?.name : 'root'
          toast.success(`Moved "${draggedFolder.name}" to ${targetName || 'root'}`)
        }
      }
    }

    handleDragEnd()
  }, [dragState, snippets, folders, moveSnippetsToFolder, moveFolder, reorderFolderSiblings, pushUndoAction, canDropFolder, isDescendantOf, handleDragEnd])

  // Filter snippets based on export status + tags
  const filteredSnippets = useMemo(() => {
    let result = snippets

    // Export filter
    if (exportFilter !== 'all') {
      result = result.filter((s) => {
        const notExported = !s.lastExportedAt
        const modified = s.lastExportedAt && s.updatedAt > s.lastExportedAt
        if (exportFilter === 'unexported') return notExported
        if (exportFilter === 'modified') return modified
        return true
      })
    }

    // Tag filter
    if (selectedTags.length > 0) {
      result = result.filter((s) => {
        if (tagFilterMode === 'and') {
          return selectedTags.every((t) => s.tags.includes(t))
        }
        return selectedTags.some((t) => s.tags.includes(t))
      })
    }

    return result
  }, [snippets, exportFilter, selectedTags, tagFilterMode])

  // Recalculate root snippets with filter
  const filteredRootSnippets = useMemo(() => {
    return filteredSnippets.filter((s) => !s.folderId)
  }, [filteredSnippets])

  // Recently edited snippets for sidebar section
  const recentSnippets = useMemo(() => getRecentSnippets(5), [getRecentSnippets])

  // Build flat list of navigable items (matches render order) for arrow key nav
  const navigableItems = useMemo(() => {
    const items: Array<{ type: 'snippet'; id: string } | { type: 'folder'; id: string }> = []
    const collectFolder = (folder: Folder) => {
      items.push({ type: 'folder', id: folder.id })
      if (expandedFolders.has(folder.id)) {
        const children = folderMap.get(folder.id) || []
        for (const child of children) collectFolder(child)
        const folderSnips = filteredSnippets.filter((s) => s.folderId === folder.id)
        for (const s of folderSnips) items.push({ type: 'snippet', id: s.id })
      }
    }
    for (const folder of rootFolders) collectFolder(folder)
    for (const snippet of filteredRootSnippets) items.push({ type: 'snippet', id: snippet.id })
    return items
  }, [rootFolders, folderMap, expandedFolders, filteredSnippets, filteredRootSnippets])

  // Keyboard shortcuts for sidebar operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields or editor
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const isCodeMirror = (e.target as HTMLElement)?.closest?.('.cm-editor')
      if (isCodeMirror) return

      // Cmd+Z: undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (canUndo()) {
          e.preventDefault()
          undo()
          toast('Action undone')
        }
        return
      }

      // Delete/Backspace and Cmd+D handled in page.tsx keyboard handler

      // ArrowDown/ArrowUp: navigate snippet list
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (navigableItems.length === 0) return
        e.preventDefault()

        // Find current position based on selection
        const currentId = selectedId || (selectedIds.size > 0 ? Array.from(selectedIds)[0] : null) || selectedFolderId
        const currentIndex = currentId ? navigableItems.findIndex((item) => item.id === currentId) : -1

        let nextIndex: number
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < navigableItems.length - 1 ? currentIndex + 1 : 0
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : navigableItems.length - 1
        }

        const nextItem = navigableItems[nextIndex]
        if (nextItem.type === 'snippet') {
          selectSnippet(nextItem.id)
        } else {
          selectFolder(nextItem.id)
        }

        // Scroll into view
        const selector = nextItem.type === 'snippet'
          ? `[data-snippet-id="${nextItem.id}"]`
          : `[data-folder-id="${nextItem.id}"]`
        const el = sidebarListRef.current?.querySelector(selector)
        el?.scrollIntoView({ block: 'nearest' })
        return
      }

      // Enter: open focused snippet, toggle folder
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        if (selectedFolderId) {
          e.preventDefault()
          toggleFolder(selectedFolderId)
          return
        }
        // If snippet selected, start rename (existing behavior)
        const id = selectedIds.size > 0 ? Array.from(selectedIds)[0] : selectedId
        if (id) {
          e.preventDefault()
          const snippet = snippets.find((s) => s.id === id)
          if (snippet) {
            selectSnippet(id)
          }
        }
        return
      }

      // F2: rename selected snippet
      if (e.key === 'F2') {
        const id = selectedIds.size > 0 ? Array.from(selectedIds)[0] : selectedId
        if (id) {
          e.preventDefault()
          const snippet = snippets.find((s) => s.id === id)
          if (snippet) {
            setEditingSnippetId(id)
            setEditingSnippetName(snippet.name)
          }
        }
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, canUndo, selectedIds, selectedId, selectedFolderId, snippets, navigableItems, selectSnippet, selectFolder, toggleFolder])

  const handleNewSnippet = useCallback(() => {
    createSnippet({ name: 'New Snippet', text: '' })
  }, [createSnippet])

  const handleNewFolder = useCallback((parentId?: string) => {
    const maxOrderIndex = folders
      .filter((f) => f.parentId === parentId)
      .reduce((max, f) => Math.max(max, f.orderIndex), -1)
    const folder = createFolder({
      name: 'New Folder',
      parentId,
      orderIndex: maxOrderIndex + 1,
    })
    // Expand parent if creating nested folder
    if (parentId) {
      setExpandedFolders((prev) => new Set([...prev, parentId]))
    }
    // Start inline editing
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.name)
  }, [folders, createFolder])

  const handleFolderNameSubmit = useCallback(() => {
    if (editingFolderId && editingFolderName.trim()) {
      updateFolder(editingFolderId, { name: editingFolderName.trim() })
    }
    setEditingFolderId(null)
    setEditingFolderName('')
  }, [editingFolderId, editingFolderName, updateFolder])

  const handleFolderNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFolderNameSubmit()
    } else if (e.key === 'Escape') {
      setEditingFolderId(null)
      setEditingFolderName('')
    }
  }, [handleFolderNameSubmit])

  const handleSnippetNameSubmit = useCallback(() => {
    if (editingSnippetId && editingSnippetName.trim()) {
      updateSnippet(editingSnippetId, { name: editingSnippetName.trim() })
    }
    setEditingSnippetId(null)
    setEditingSnippetName('')
  }, [editingSnippetId, editingSnippetName, updateSnippet])

  const handleSnippetNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSnippetNameSubmit()
    } else if (e.key === 'Escape') {
      setEditingSnippetId(null)
      setEditingSnippetName('')
    }
  }, [handleSnippetNameSubmit])

  // Focus folder input when editing starts
  useEffect(() => {
    if (editingFolderId && folderInputRef.current) {
      folderInputRef.current.focus()
      folderInputRef.current.select()
    }
  }, [editingFolderId])

  // Focus snippet input when editing starts
  useEffect(() => {
    if (editingSnippetId && snippetInputRef.current) {
      snippetInputRef.current.focus()
      snippetInputRef.current.select()
    }
  }, [editingSnippetId])

  // Manage delete snippet dialog
  useEffect(() => {
    const dialog = deleteSnippetDialogRef.current
    if (!dialog) return
    if (deleteSnippetDialog.open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [deleteSnippetDialog.open])

  // Manage delete folder dialog
  useEffect(() => {
    const dialog = deleteFolderDialogRef.current
    if (!dialog) return
    if (deleteFolderDialog.open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [deleteFolderDialog.open])

  const needsExport = (snippet: Snippet) =>
    !snippet.lastExportedAt || snippet.updatedAt > snippet.lastExportedAt

  const renderSnippet = (snippet: Snippet, depth: number = 0) => {
    const showIndicator = needsExport(snippet)
    const isBeingDragged = dragState.isDragging && dragState.dragType === 'snippet' && dragState.draggedIds.has(snippet.id)
    const isEditing = editingSnippetId === snippet.id
    return (
      <li
        key={snippet.id}
        data-testid="snippet-row"
        data-snippet-id={snippet.id}
        tabIndex={0}
        draggable={!isEditing}
        onDragStart={(e) => handleSnippetDragStart(e, snippet.id)}
        onDragEnd={handleDragEnd}
        onClick={(e) => handleSnippetClick(e, snippet.id)}
        onDoubleClick={(e) => handleSnippetDoubleClick(e, snippet.id)}
        onContextMenu={(e) => handleSnippetContextMenu(e, snippet.id)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={cn(
          'group flex items-center gap-2 pr-2 py-1.5 rounded cursor-pointer text-sm transition-all duration-100 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isBeingDragged && 'opacity-50',
          selectedIds.has(snippet.id)
            ? 'bg-blue-600/30 text-blue-200'
            : selectedId === snippet.id
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-secondary-foreground active:scale-[0.98]'
        )}
      >
        <FileText className="w-4 h-4 shrink-0" />
        {isEditing ? (
          <input
            ref={snippetInputRef}
            type="text"
            value={editingSnippetName}
            onChange={(e) => setEditingSnippetName(e.target.value)}
            onBlur={handleSnippetNameSubmit}
            onKeyDown={handleSnippetNameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-accent border border-border rounded px-1 py-0.5 text-sm text-foreground focus:outline-none focus:border-blue-500"
          />
        ) : (
          <>
            <span className="truncate flex-1" title={snippet.name}>{snippet.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setEditingSnippetId(snippet.id)
                setEditingSnippetName(snippet.name)
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-secondary-foreground transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100"
              title="Edit name"
              aria-label={`Edit ${snippet.name}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </>
        )}
        {!isEditing && showIndicator && (
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
    const isEditing = editingFolderId === folder.id
    const childFolders = folderMap.get(folder.id) || []
    const folderSnippets = getFilteredSnippetsForFolder(folder.id)
    const snippetCount = getSnippetCount(folder.id)
    const isEmpty = childFolders.length === 0 && folderSnippets.length === 0
    const isBeingDragged = dragState.isDragging && dragState.dragType === 'folder' && dragState.draggedFolderId === folder.id
    const isDropTarget = dragState.isDragging && dragState.dropTarget?.targetId === folder.id
    const dropPosition = isDropTarget ? dragState.dropTarget?.position : null
    // Validate top-level folder names against methodology
    const methodologyWarning = !folder.parentId && methodologyConfig.preset !== 'flat'
      ? validateFolderName(folder.name, methodologyConfig)
      : null

    // Check if this folder can receive the dragged folder
    const canReceiveDrop = dragState.dragType === 'folder' && dragState.draggedFolderId
      ? canDropFolder(dragState.draggedFolderId, folder.id)
      : true

    return (
      <li key={folder.id} className="relative" data-testid="folder-row" data-folder-id={folder.id} data-depth={depth}>
        {/* Drop indicator line for 'before' position */}
        {isDropTarget && dropPosition === 'before' && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-blue-500 -top-0.5 z-10"
            style={{ marginLeft: `${depth * 12 + 8}px` }}
          />
        )}
        <div
          data-testid="folder-header"
          tabIndex={0}
          draggable={!isEditing}
          onDragStart={(e) => handleFolderDragStart(e, folder.id)}
          onDragEnd={handleDragEnd}
          onClick={(e) => handleFolderClick(e, folder.id)}
          onDoubleClick={(e) => handleFolderDoubleClick(e, folder.id)}
          onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={cn(
            'flex items-center gap-1 pr-2 py-1.5 rounded cursor-pointer text-sm transition-all duration-100 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isBeingDragged && 'opacity-50',
            isDropTarget && dropPosition === 'inside' && canReceiveDrop && 'ring-2 ring-blue-500 bg-blue-500/20 border-blue-500',
            isDropTarget && dropPosition === 'inside' && !canReceiveDrop && 'ring-2 ring-red-500 bg-red-500/20 border-red-500',
            selectedFolderId === folder.id
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-secondary-foreground active:scale-[0.98]'
          )}
        >
          <button
            data-testid="folder-chevron"
            aria-expanded={isExpanded}
            aria-label={`Toggle ${folder.name}`}
            className="shrink-0 p-0 bg-transparent border-none cursor-pointer"
            tabIndex={-1}
          >
            <ChevronRight
              className={cn('w-4 h-4 transition-transform duration-150 ease-out', isExpanded && 'rotate-90')}
            />
          </button>
          <FolderIcon className="w-4 h-4 shrink-0" />
          {isEditing ? (
            <input
              ref={folderInputRef}
              type="text"
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              onBlur={handleFolderNameSubmit}
              onKeyDown={handleFolderNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-accent border border-border rounded px-1 py-0.5 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
          ) : (
            <span className="truncate flex-1" title={folder.name}>{folder.name}</span>
          )}
          {!isEditing && snippetCount > 0 && (
            <span data-testid="snippet-count" className="text-xs text-muted-foreground tabular-nums">({snippetCount})</span>
          )}
          {!isEditing && methodologyWarning && !methodologyWarning.valid && (
            <span data-testid="methodology-warning" title={methodologyWarning.warning}>
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
            </span>
          )}
        </div>
        <div className={cn(
          'grid transition-[grid-template-rows] duration-150 ease-out',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}>
          <ul data-testid="folder-children" className="space-y-0.5 overflow-hidden">
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {folderSnippets.map((snippet) => renderSnippet(snippet, depth + 1))}
            {isEmpty && (
              <li
                data-testid="empty-state"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                className="py-1.5 text-xs text-muted-foreground italic"
              >
                Empty folder
              </li>
            )}
          </ul>
        </div>
        {/* Drop indicator line for 'after' position */}
        {isDropTarget && dropPosition === 'after' && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-blue-500 -bottom-0.5 z-10"
            style={{ marginLeft: `${depth * 12 + 8}px` }}
          />
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
    <aside className="h-full flex flex-col bg-muted/50">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Snippets</span>
        <div className="flex items-center gap-1">
          <div className="relative" ref={filterMenuRef}>
            <button
              onClick={() => setFilterMenuOpen((v) => !v)}
              className={cn(
                'p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
                exportFilter !== 'all' && 'text-blue-400'
              )}
              title="Filter by export status"
              aria-label="Filter by export status"
              aria-expanded={filterMenuOpen}
            >
              <Filter className="w-4 h-4" />
            </button>
            {filterMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-accent border border-border rounded-md shadow-lg py-1 min-w-[140px] z-50 animate-dropdown-in">
                {(['all', 'unexported', 'modified'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setExportFilter(f)
                      setFilterMenuOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-accent',
                      exportFilter === f ? 'text-blue-400' : 'text-secondary-foreground'
                    )}
                  >
                    {f === 'all' ? 'All' : f === 'unexported' ? 'Never exported' : 'Modified'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {folders.length > 0 && (
            <>
              <button
                onClick={expandAllFolders}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Expand all folders"
                aria-label="Expand all folders"
              >
                <ChevronsUpDown className="w-4 h-4" />
              </button>
              <button
                onClick={collapseAllFolders}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Collapse all folders"
                aria-label="Collapse all folders"
              >
                <ChevronsDownUp className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setReorgOpen(true)}
            data-testid="reorg-trigger"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-amber-400 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Batch reorganize"
            aria-label="Batch reorganize"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleNewFolder()}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="New folder"
            aria-label="New folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleNewSnippet}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="New snippet"
            aria-label="New snippet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <TagFilter />

      <div
        className={cn(
          'flex-1 overflow-y-auto p-2',
          dragState.isDragging && dragState.dropTarget?.targetId === null && 'bg-blue-500/10'
        )}
        onDragOver={(e) => handleDragOver(e, null, 'inside')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        {folders.length === 0 && snippets.length === 0 ? (
          <div data-testid="empty-state" className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
            <p className="text-sm text-muted-foreground">Create your first snippet to get started</p>
            <button
              onClick={handleNewSnippet}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Snippet
            </button>
          </div>
        ) : filteredSnippets.length === 0 && exportFilter !== 'all' ? (
          <p className="text-sm text-muted-foreground p-2">No {exportFilter} snippets</p>
        ) : (
          <>
            {/* Recently edited snippets */}
            {recentSnippets.length > 0 && (
              <div className="mb-2">
                <button
                  onClick={() => setRecentExpanded((v) => !v)}
                  className="flex items-center gap-1.5 w-full px-1 py-1 text-xs font-medium text-muted-foreground hover:text-secondary-foreground transition-colors"
                >
                  <ChevronRight className={cn('w-3 h-3 transition-transform', recentExpanded && 'rotate-90')} />
                  <Clock className="w-3 h-3" />
                  Recent
                </button>
                {recentExpanded && (
                  <ul className="space-y-0.5">
                    {recentSnippets.map((snippet) => renderSnippet(snippet))}
                  </ul>
                )}
              </div>
            )}
            <ul ref={sidebarListRef} className="space-y-0.5" role="listbox" aria-label="Snippets and folders">
              {rootFolders.map((folder) => renderFolder(folder))}
              {filteredRootSnippets.map((snippet) => renderSnippet(snippet))}
            </ul>
          </>
        )}
      </div>

      {selectedIds.size > 1 && (
        <BulkToolbar
          selectedIds={selectedIds}
          folders={folders}
          onDelete={handleDeleteSelectedSnippets}
          onMove={handleMoveToFolder}
          onExport={handleExportSelected}
          onClear={clearSelection}
          getFolderDepth={getFolderDepth}
        />
      )}

      {selectedIds.size === 1 && (
        <div className="p-2 border-t border-border text-xs text-muted-foreground">
          1 selected
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          role="menu"
          data-testid={contextMenu.type === 'snippet' ? 'snippet-context-menu' : undefined}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px] animate-dropdown-in"
        >
          {contextMenu.type === 'snippet' && (
            <>
              <button
                role="menuitem"
                onClick={handleRenameSnippet}
                data-testid="ctx-rename"
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2 outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename
                <span className="ml-auto text-xs text-muted-foreground">F2</span>
              </button>
              <button
                role="menuitem"
                onClick={handleDuplicateSnippet}
                data-testid="ctx-duplicate"
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2 outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate
                <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
              </button>
              {/* Move to folder submenu */}
              <div className="relative">
                <button
                  role="menuitem"
                  onClick={() => setMoveToFolderOpen((v) => !v)}
                  data-testid="ctx-move-to"
                  className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2 outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                  Move to...
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                </button>
                {moveToFolderOpen && (
                  <div data-testid="move-to-folder" className="absolute left-full top-0 ml-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px] max-h-[200px] overflow-y-auto">
                    <button
                      onClick={() => handleMoveToFolder(null)}
                      className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Root
                    </button>
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleMoveToFolder(f.id)}
                        className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors truncate"
                        style={{ paddingLeft: `${(getFolderDepth(f.id)) * 8 + 12}px` }}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-px bg-border my-1" />
              <button
                role="menuitem"
                onClick={handleExportSelected}
                data-testid="ctx-export"
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2 outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                Export Selected ({selectedIds.size})
              </button>
              <div className="h-px bg-border my-1" />
              <button
                role="menuitem"
                onClick={handleDeleteSelectedSnippets}
                data-testid="snippet-delete"
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-accent transition-colors flex items-center gap-2 outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.size})
                <span className="ml-auto text-xs text-muted-foreground">⌫</span>
              </button>
            </>
          )}
          {contextMenu.type === 'folder' && (
            <>
              {contextMenu.folderId && getFolderDepth(contextMenu.folderId) < MAX_DEPTH - 1 && (
                <button
                  role="menuitem"
                  onClick={() => {
                    closeContextMenu()
                    if (contextMenu.folderId) {
                      handleNewFolder(contextMenu.folderId)
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  New Subfolder
                </button>
              )}
              <button
                role="menuitem"
                onClick={handleExportFolder}
                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
              >
                Export Folder
              </button>
              <button
                role="menuitem"
                onClick={handleDeleteFolder}
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-accent transition-colors"
              >
                Delete Folder
              </button>
            </>
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

      <FolderReorgModal open={reorgOpen} onClose={() => setReorgOpen(false)} />

      {/* Delete Snippet Confirmation Dialog */}
      <dialog
        ref={deleteSnippetDialogRef}
        onClick={(e) => { if (e.target === deleteSnippetDialogRef.current) setDeleteSnippetDialog({ open: false, snippetIds: [] }) }}
        className="backdrop:bg-black/50 bg-transparent p-0 max-w-sm w-full"
      >
        <div className="bg-muted border border-border rounded-lg shadow-xl p-4 mx-4">
          <h3 className="text-lg font-medium text-foreground mb-2">
            Delete {deleteSnippetDialog.snippetIds.length === 1 ? 'Snippet' : `${deleteSnippetDialog.snippetIds.length} Snippets`}?
          </h3>
          <div className="text-sm text-muted-foreground mb-4">
            {deleteSnippetDialog.snippetIds.length === 1
              ? <p>&ldquo;{snippets.find((s) => s.id === deleteSnippetDialog.snippetIds[0])?.name}&rdquo; will be permanently deleted.</p>
              : (
                <>
                  <p className="mb-2">{deleteSnippetDialog.snippetIds.length} snippets will be permanently deleted:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {deleteSnippetDialog.snippetIds.slice(0, 5).map((id) => (
                      <li key={id} className="truncate">{snippets.find((s) => s.id === id)?.name}</li>
                    ))}
                    {deleteSnippetDialog.snippetIds.length > 5 && (
                      <li className="text-muted-foreground/70">+ {deleteSnippetDialog.snippetIds.length - 5} more</li>
                    )}
                  </ul>
                </>
              )}
            <p className="mt-2">You can undo this with &#x2318;Z.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteSnippetDialog({ open: false, snippetIds: [] })}
              data-testid="snippet-delete-cancel"
              className="px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSnippetConfirm}
              data-testid="snippet-delete-confirm"
              className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </dialog>

      {/* Delete Folder Confirmation Dialog */}
      <dialog
        ref={deleteFolderDialogRef}
        onClick={(e) => { if (e.target === deleteFolderDialogRef.current) setDeleteFolderDialog({ open: false, folderId: null, hasContents: false, snippetCount: 0, subfolderCount: 0 }) }}
        className="backdrop:bg-black/50 bg-transparent p-0 max-w-sm w-full"
      >
        <div className="bg-muted border border-border rounded-lg shadow-xl p-4 mx-4">
          <h3 className="text-lg font-medium text-foreground mb-2">Delete Folder?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This folder contains {deleteFolderDialog.snippetCount > 0 ? `${deleteFolderDialog.snippetCount} snippet${deleteFolderDialog.snippetCount !== 1 ? 's' : ''}` : ''}{deleteFolderDialog.snippetCount > 0 && deleteFolderDialog.subfolderCount > 0 ? ' and ' : ''}{deleteFolderDialog.subfolderCount > 0 ? `${deleteFolderDialog.subfolderCount} subfolder${deleteFolderDialog.subfolderCount !== 1 ? 's' : ''}` : ''}. Snippets will be moved to root.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteFolderDialog({ open: false, folderId: null, hasContents: false, snippetCount: 0, subfolderCount: 0 })}
              className="px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteFolderConfirm}
              className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </dialog>
    </aside>
  )
}
