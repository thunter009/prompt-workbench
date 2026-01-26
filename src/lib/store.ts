import { create } from 'zustand'
import type { Snippet, Folder } from '@/types'

function generateId(): string {
  return crypto.randomUUID()
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

  // Snippet actions
  selectSnippet: (id: string | null) => void
  toggleSelectSnippet: (id: string, shiftKey?: boolean) => void
  selectAllSnippets: () => void
  clearSelection: () => void
  getSelectedSnippets: () => Snippet[]
  createSnippet: (data: Partial<Snippet>) => Snippet
  updateSnippet: (id: string, data: Partial<Snippet>) => void
  deleteSnippet: (id: string) => void
  search: (query: string) => void
  setEditorDirty: (dirty: boolean) => void

  // UI actions
  togglePreview: () => void
  setPreviewVisible: (visible: boolean) => void

  // Folder actions
  selectFolder: (id: string | null) => void
  createFolder: (data: Partial<Folder>) => Folder
  updateFolder: (id: string, data: Partial<Folder>) => void
  deleteFolder: (id: string) => void
  getSnippetsInFolder: (folderId: string, includeSubfolders: boolean) => Snippet[]
  getSubfolderIds: (folderId: string) => string[]

  // Computed
  getSelectedSnippet: () => Snippet | undefined
  getFilteredSnippets: () => Snippet[]
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

  // Snippet actions
  selectSnippet: (id) => set({ selectedId: id, selectedIds: id ? new Set([id]) : new Set() }),

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

  // UI actions
  togglePreview: () => set((state) => ({ previewVisible: !state.previewVisible })),
  setPreviewVisible: (visible) => set({ previewVisible: visible }),

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
