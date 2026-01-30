'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSnippetStore } from '@/lib/store'
import { useUndoStore } from '@/lib/undo-store'
import { exportSnippets } from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import { ValidationDialog } from '@/components/ValidationDialog'
import { ExportFolderDialog } from '@/components/ExportFolderDialog'
import { FileText, Plus, Folder as FolderIcon, FolderPlus, ChevronRight, Filter, ChevronsDownUp, ChevronsUpDown, Pencil } from 'lucide-react'
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
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<{ open: boolean; folderId: string | null; hasContents: boolean }>({ open: false, folderId: null, hasContents: false })
  const menuRef = useRef<HTMLDivElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const snippetInputRef = useRef<HTMLInputElement>(null)

  const EXPANDED_FOLDERS_KEY = 'prompt-workbench-expanded-folders'

  // Initialize expanded folders from localStorage
  const [expandedFoldersInitialized, setExpandedFoldersInitialized] = useState(false)
  useEffect(() => {
    if (expandedFoldersInitialized) return
    try {
      const stored = localStorage.getItem(EXPANDED_FOLDERS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        // Only restore IDs that still exist
        const validIds = parsed.filter((id) => folders.some((f) => f.id === id))
        setExpandedFolders(new Set(validIds))
      }
    } catch {
      // ignore parse errors
    }
    setExpandedFoldersInitialized(true)
  }, [folders, expandedFoldersInitialized])

  // Persist expanded folders to localStorage
  useEffect(() => {
    if (!expandedFoldersInitialized) return
    localStorage.setItem(EXPANDED_FOLDERS_KEY, JSON.stringify([...expandedFolders]))
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
      setDeleteFolderDialog({ open: true, folderId: contextMenu.folderId, hasContents: true })
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
    setDeleteFolderDialog({ open: false, folderId: null, hasContents: false })
  }, [deleteFolderDialog.folderId, getSubfolderIds, deleteFolder])

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
    return targetDepth + subtreeDepth <= 2
  }, [getFolderDepth, isDescendantOf, getMaxSubtreeDepth])

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

  // Cmd+Z undo handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Don't interfere with input fields
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (canUndo()) {
          e.preventDefault()
          undo()
          toast('Undid move')
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, canUndo])

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

  const needsExport = (snippet: Snippet) =>
    !snippet.lastExportedAt || snippet.updatedAt > snippet.lastExportedAt

  const renderSnippet = (snippet: Snippet, depth: number = 0) => {
    const showIndicator = needsExport(snippet)
    const isBeingDragged = dragState.isDragging && dragState.dragType === 'snippet' && dragState.draggedIds.has(snippet.id)
    const isEditing = editingSnippetId === snippet.id
    return (
      <li
        key={snippet.id}
        draggable={!isEditing}
        onDragStart={(e) => handleSnippetDragStart(e, snippet.id)}
        onDragEnd={handleDragEnd}
        onClick={(e) => handleSnippetClick(e, snippet.id)}
        onDoubleClick={(e) => handleSnippetDoubleClick(e, snippet.id)}
        onContextMenu={(e) => handleSnippetContextMenu(e, snippet.id)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={cn(
          'group flex items-center gap-2 pr-2 py-1.5 rounded cursor-pointer text-sm transition-colors',
          isBeingDragged && 'opacity-50',
          selectedIds.has(snippet.id)
            ? 'bg-blue-600/30 text-blue-200'
            : selectedId === snippet.id
              ? 'bg-zinc-800 text-zinc-200'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
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
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
          />
        ) : (
          <>
            <span className="truncate flex-1">{snippet.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setEditingSnippetId(snippet.id)
                setEditingSnippetName(snippet.name)
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-opacity"
              title="Edit name"
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

    // Check if this folder can receive the dragged folder
    const canReceiveDrop = dragState.dragType === 'folder' && dragState.draggedFolderId
      ? canDropFolder(dragState.draggedFolderId, folder.id)
      : true

    return (
      <li key={folder.id} className="relative">
        {/* Drop indicator line for 'before' position */}
        {isDropTarget && dropPosition === 'before' && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-blue-500 -top-0.5 z-10"
            style={{ marginLeft: `${depth * 12 + 8}px` }}
          />
        )}
        <div
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
            'flex items-center gap-1 pr-2 py-1.5 rounded cursor-pointer text-sm transition-colors',
            isBeingDragged && 'opacity-50',
            isDropTarget && dropPosition === 'inside' && canReceiveDrop && 'ring-2 ring-blue-500 bg-blue-500/20',
            isDropTarget && dropPosition === 'inside' && !canReceiveDrop && 'ring-2 ring-red-500 bg-red-500/20',
            selectedFolderId === folder.id
              ? 'bg-zinc-800 text-zinc-200'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
          )}
        >
          <ChevronRight
            className={cn('w-4 h-4 shrink-0 transition-transform', isExpanded && 'rotate-90')}
          />
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
              className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
            />
          ) : (
            <span className="truncate flex-1">{folder.name}</span>
          )}
          {!isEditing && snippetCount > 0 && (
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
          {folders.length > 0 && (
            <>
              <button
                onClick={expandAllFolders}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                title="Expand all folders"
              >
                <ChevronsUpDown className="w-4 h-4" />
              </button>
              <button
                onClick={collapseAllFolders}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                title="Collapse all folders"
              >
                <ChevronsDownUp className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => handleNewFolder()}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="New folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleNewSnippet}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="New snippet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

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
            <>
              <button
                onClick={() => {
                  closeContextMenu()
                  if (contextMenu.folderId) {
                    handleNewFolder(contextMenu.folderId)
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                New Subfolder
              </button>
              <button
                onClick={handleExportFolder}
                className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Export Folder
              </button>
              <button
                onClick={handleDeleteFolder}
                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
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

      {/* Delete Folder Confirmation Dialog */}
      {deleteFolderDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-zinc-100 mb-2">Delete Folder?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              This folder contains items. Deleting it will move all snippets to the root level and remove all subfolders.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteFolderDialog({ open: false, folderId: null, hasContents: false })}
                className="px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
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
        </div>
      )}
    </aside>
  )
}
