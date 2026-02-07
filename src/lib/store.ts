import { create } from 'zustand'
import type { Snippet, Folder } from '@/types'
import { useVersionStore } from './version-store'
import { generateId } from './utils/id'

// Debounced version saving per snippet
const DEBOUNCE_MS = 2000
const versionSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleVersionSave(snippetId: string, text: string) {
  // Clear existing timer for this snippet
  const existingTimer = versionSaveTimers.get(snippetId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  // Schedule new save
  const timer = setTimeout(() => {
    useVersionStore.getState().saveVersion(snippetId, text)
    versionSaveTimers.delete(snippetId)
  }, DEBOUNCE_MS)

  versionSaveTimers.set(snippetId, timer)
}

type ExportFilter = 'all' | 'unexported' | 'modified'

interface ExportSettings {
  defaultPath: string | null  // Display path for UI
  hasDirectoryHandle: boolean // Whether we have a stored handle
}

interface SearchSettings {
  scopeToCurrentFolder: boolean
}

interface SnippetStore {
  // State
  snippets: Snippet[]
  folders: Folder[]
  selectedId: string | null
  selectedIds: Set<string>
  selectedFolderId: string | null
  searchQuery: string
  editorDirty: boolean
  previewVisible: boolean
  previewValues: boolean
  syncScroll: boolean
  exportFilter: ExportFilter
  exportSettings: ExportSettings
  recentSnippetIds: string[]
  searchSettings: SearchSettings

  // Snippet actions
  selectSnippet: (id: string | null) => void
  toggleSelectSnippet: (id: string, shiftKey?: boolean) => void
  selectAllSnippets: () => void
  clearSelection: () => void
  getSelectedSnippets: () => Snippet[]
  createSnippet: (data: Partial<Snippet>) => Snippet
  updateSnippet: (id: string, data: Partial<Snippet>) => void
  deleteSnippet: (id: string) => void
  markExported: (ids: string[]) => void
  search: (query: string) => void
  setEditorDirty: (dirty: boolean) => void
  setExportFilter: (filter: ExportFilter) => void

  // UI actions
  togglePreview: () => void
  setPreviewVisible: (visible: boolean) => void
  togglePreviewValues: () => void
  setPreviewValues: (enabled: boolean) => void
  toggleSyncScroll: () => void
  setSyncScroll: (enabled: boolean) => void

  // Export settings actions
  setExportSettings: (settings: Partial<ExportSettings>) => void

  // Search settings actions
  setSearchSettings: (settings: Partial<SearchSettings>) => void
  getCurrentFolderContext: () => { folderId: string | null; folderName: string | null }

  // Folder actions
  selectFolder: (id: string | null) => void
  createFolder: (data: Partial<Folder>) => Folder
  updateFolder: (id: string, data: Partial<Folder>) => void
  deleteFolder: (id: string) => void
  getSnippetsInFolder: (folderId: string, includeSubfolders: boolean) => Snippet[]
  getSubfolderIds: (folderId: string) => string[]

  // Drag & Drop
  moveSnippetsToFolder: (snippetIds: string[], folderId: string | null) => { snippetId: string; previousFolderId: string | undefined }[]
  moveFolder: (folderId: string, newParentId: string | null, newOrderIndex: number) => { previousParentId: string | undefined; previousOrderIndex: number }
  getFolderDepth: (folderId: string) => number
  isDescendantOf: (folderId: string, potentialAncestorId: string) => boolean
  reorderFolderSiblings: (folderId: string, targetIndex: number) => { folderId: string; previousOrderIndex: number }[]

  // Recent snippets
  getRecentSnippets: (limit?: number) => Snippet[]

  // Computed
  getSelectedSnippet: () => Snippet | undefined
  getFilteredSnippets: () => Snippet[]
}

// Expose store for Playwright tests in development
declare global {
  interface Window {
    __snippetStore?: typeof useSnippetStore
  }
}

export const useSnippetStore = create<SnippetStore>((set, get) => ({
  // Initial state
  snippets: [],
  folders: [],
  selectedId: null,
  selectedIds: new Set<string>(),
  selectedFolderId: null,
  searchQuery: '',
  editorDirty: false,
  previewVisible: true,
  previewValues: false,
  syncScroll: true,
  exportFilter: 'all' as ExportFilter,
  exportSettings: { defaultPath: null, hasDirectoryHandle: false },
  recentSnippetIds: [],
  searchSettings: { scopeToCurrentFolder: false },

  // Snippet actions
  selectSnippet: (id) => set((state) => {
    if (!id) return { selectedId: null, selectedIds: new Set() }
    // Track recent: add to front, dedupe, limit to 10
    const recent = [id, ...state.recentSnippetIds.filter((rid) => rid !== id)].slice(0, 10)
    return { selectedId: id, selectedIds: new Set([id]), recentSnippetIds: recent }
  }),

  toggleSelectSnippet: (id, shiftKey = false) => {
    const { selectedIds, snippets, selectedId } = get()
    const newSelection = new Set(selectedIds)

    if (shiftKey && selectedId) {
      // Range select: select all between last selected and current
      const ids = snippets.map((s) => s.id)
      const lastIndex = ids.indexOf(selectedId)
      const currentIndex = ids.indexOf(id)
      if (lastIndex !== -1 && currentIndex !== -1) {
        const [start, end] = lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex]
        for (let i = start; i <= end; i++) {
          newSelection.add(ids[i])
        }
      }
    } else {
      // Toggle single item
      if (newSelection.has(id)) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
    }

    set({ selectedIds: newSelection, selectedId: id })
  },

  selectAllSnippets: () => {
    const { snippets } = get()
    set({ selectedIds: new Set(snippets.map((s) => s.id)) })
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  getSelectedSnippets: () => {
    const { snippets, selectedIds } = get()
    return snippets.filter((s) => selectedIds.has(s.id))
  },

  createSnippet: (data) => {
    const now = Date.now()
    const snippet: Snippet = {
      id: generateId(),
      name: data.name ?? 'Untitled',
      text: data.text ?? '',
      keyword: data.keyword,
      folderId: data.folderId,
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
      version: 1,
      raycastSyncedAt: data.raycastSyncedAt,
    }

    set((state) => ({
      snippets: [...state.snippets, snippet],
      selectedId: snippet.id,
    }))

    return snippet
  },

  updateSnippet: (id, data) => {
    // Schedule version save if text is changing
    if (data.text !== undefined) {
      const currentSnippet = get().snippets.find((s) => s.id === id)
      if (currentSnippet && currentSnippet.text !== data.text) {
        scheduleVersionSave(id, data.text)
      }
    }

    set((state) => ({
      snippets: state.snippets.map((s) =>
        s.id === id
          ? {
              ...s,
              ...data,
              updatedAt: Date.now(),
              version: s.version + 1,
            }
          : s
      ),
    }))
  },

  deleteSnippet: (id) => {
    set((state) => ({
      snippets: state.snippets.filter((s) => s.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }))
  },

  search: (query) => set({ searchQuery: query }),

  setEditorDirty: (dirty) => set({ editorDirty: dirty }),

  setExportFilter: (filter) => set({ exportFilter: filter }),

  markExported: (ids) => {
    const now = Date.now()
    set((state) => ({
      snippets: state.snippets.map((s) =>
        ids.includes(s.id) ? { ...s, lastExportedAt: now } : s
      ),
    }))
  },

  // UI actions
  togglePreview: () => set((state) => ({ previewVisible: !state.previewVisible })),
  setPreviewVisible: (visible) => set({ previewVisible: visible }),
  togglePreviewValues: () => set((state) => ({ previewValues: !state.previewValues })),
  setPreviewValues: (enabled) => set({ previewValues: enabled }),
  toggleSyncScroll: () => set((state) => ({ syncScroll: !state.syncScroll })),
  setSyncScroll: (enabled) => set({ syncScroll: enabled }),

  // Export settings actions
  setExportSettings: (settings) => set((state) => ({
    exportSettings: { ...state.exportSettings, ...settings }
  })),

  // Search settings actions
  setSearchSettings: (settings) => set((state) => ({
    searchSettings: { ...state.searchSettings, ...settings }
  })),

  getCurrentFolderContext: () => {
    const { selectedId, selectedFolderId, snippets, folders } = get()
    // If a folder is selected, use that
    if (selectedFolderId) {
      const folder = folders.find((f) => f.id === selectedFolderId)
      return { folderId: selectedFolderId, folderName: folder?.name ?? null }
    }
    // If a snippet is selected, use its folder
    if (selectedId) {
      const snippet = snippets.find((s) => s.id === selectedId)
      if (snippet?.folderId) {
        const folder = folders.find((f) => f.id === snippet.folderId)
        return { folderId: snippet.folderId, folderName: folder?.name ?? null }
      }
    }
    return { folderId: null, folderName: null }
  },

  // Folder actions
  selectFolder: (id) => set({ selectedFolderId: id, selectedId: null, selectedIds: new Set() }),

  createFolder: (data) => {
    const folder: Folder = {
      id: generateId(),
      name: data.name ?? 'New Folder',
      parentId: data.parentId,
      orderIndex: data.orderIndex ?? 0,
    }

    set((state) => ({
      folders: [...state.folders, folder],
    }))

    return folder
  },

  updateFolder: (id, data) => {
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === id ? { ...f, ...data } : f
      ),
    }))
  },

  deleteFolder: (id) => {
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      // Clear folderId from snippets in the deleted folder
      snippets: state.snippets.map((s) =>
        s.folderId === id ? { ...s, folderId: undefined } : s
      ),
    }))
  },

  getSubfolderIds: (folderId) => {
    const { folders } = get()
    const result: string[] = []
    const collectChildren = (parentId: string) => {
      for (const f of folders) {
        if (f.parentId === parentId) {
          result.push(f.id)
          collectChildren(f.id)
        }
      }
    }
    collectChildren(folderId)
    return result
  },

  getSnippetsInFolder: (folderId, includeSubfolders) => {
    const { snippets, getSubfolderIds } = get()
    if (includeSubfolders) {
      const folderIds = new Set([folderId, ...getSubfolderIds(folderId)])
      return snippets.filter((s) => s.folderId && folderIds.has(s.folderId))
    }
    return snippets.filter((s) => s.folderId === folderId)
  },

  // Drag & Drop
  moveSnippetsToFolder: (snippetIds, folderId) => {
    const { snippets } = get()
    // Track previous folders for undo
    const previousFolders = snippetIds.map((id) => {
      const snippet = snippets.find((s) => s.id === id)
      return { snippetId: id, previousFolderId: snippet?.folderId }
    })

    set((state) => ({
      snippets: state.snippets.map((s) =>
        snippetIds.includes(s.id) ? { ...s, folderId: folderId ?? undefined, updatedAt: Date.now() } : s
      ),
    }))

    return previousFolders
  },

  moveFolder: (folderId, newParentId, newOrderIndex) => {
    const { folders } = get()
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) return { previousParentId: undefined, previousOrderIndex: 0 }

    const previousParentId = folder.parentId
    const previousOrderIndex = folder.orderIndex

    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === folderId
          ? { ...f, parentId: newParentId ?? undefined, orderIndex: newOrderIndex }
          : f
      ),
    }))

    return { previousParentId, previousOrderIndex }
  },

  getFolderDepth: (folderId) => {
    const { folders } = get()
    let depth = 0
    let current = folders.find((f) => f.id === folderId)
    while (current?.parentId) {
      depth++
      current = folders.find((f) => f.id === current!.parentId)
    }
    return depth
  },

  isDescendantOf: (folderId, potentialAncestorId) => {
    const { folders } = get()
    let current = folders.find((f) => f.id === folderId)
    while (current?.parentId) {
      if (current.parentId === potentialAncestorId) return true
      current = folders.find((f) => f.id === current!.parentId)
    }
    return false
  },

  reorderFolderSiblings: (folderId, targetIndex) => {
    const { folders } = get()
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) return []

    // Get siblings (folders with same parent)
    const siblings = folders
      .filter((f) => f.parentId === folder.parentId && f.id !== folderId)
      .sort((a, b) => a.orderIndex - b.orderIndex)

    // Track previous order indices for undo
    const previousOrders = [{ folderId, previousOrderIndex: folder.orderIndex }]

    // Insert at target position and recalculate indices
    siblings.splice(targetIndex, 0, folder)
    const updates: { id: string; orderIndex: number }[] = siblings.map((f, i) => ({
      id: f.id,
      orderIndex: i,
    }))

    // Track changes for other siblings
    for (const f of folders.filter((f) => f.parentId === folder.parentId && f.id !== folderId)) {
      const newOrder = updates.find((u) => u.id === f.id)?.orderIndex
      if (newOrder !== undefined && newOrder !== f.orderIndex) {
        previousOrders.push({ folderId: f.id, previousOrderIndex: f.orderIndex })
      }
    }

    set((state) => ({
      folders: state.folders.map((f) => {
        const update = updates.find((u) => u.id === f.id)
        return update ? { ...f, orderIndex: update.orderIndex } : f
      }),
    }))

    return previousOrders
  },

  // Recent snippets
  getRecentSnippets: (limit = 5) => {
    const { snippets, recentSnippetIds } = get()
    return recentSnippetIds
      .slice(0, limit)
      .map((id) => snippets.find((s) => s.id === id))
      .filter((s): s is Snippet => !!s)
  },

  // Computed
  getSelectedSnippet: () => {
    const { snippets, selectedId } = get()
    return snippets.find((s) => s.id === selectedId)
  },

  getFilteredSnippets: () => {
    const { snippets, searchQuery } = get()
    if (!searchQuery.trim()) {
      return snippets
    }

    const query = searchQuery.toLowerCase()
    return snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.text.toLowerCase().includes(query) ||
        s.keyword?.toLowerCase().includes(query)
    )
  },
}))

if (typeof window !== 'undefined') {
  window.__snippetStore = useSnippetStore
}
