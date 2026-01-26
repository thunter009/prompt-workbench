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
  searchQuery: string
  editorDirty: boolean
  previewVisible: boolean

  // Snippet actions
  selectSnippet: (id: string | null) => void
  createSnippet: (data: Partial<Snippet>) => Snippet
  updateSnippet: (id: string, data: Partial<Snippet>) => void
  deleteSnippet: (id: string) => void
  search: (query: string) => void
  setEditorDirty: (dirty: boolean) => void

  // UI actions
  togglePreview: () => void
  setPreviewVisible: (visible: boolean) => void

  // Folder actions
  createFolder: (data: Partial<Folder>) => Folder
  updateFolder: (id: string, data: Partial<Folder>) => void
  deleteFolder: (id: string) => void

  // Computed
  getSelectedSnippet: () => Snippet | undefined
  getFilteredSnippets: () => Snippet[]
}

export const useSnippetStore = create<SnippetStore>((set, get) => ({
  // Initial state
  snippets: [],
  folders: [],
  selectedId: null,
  searchQuery: '',
  editorDirty: false,
  previewVisible: true,

  // Snippet actions
  selectSnippet: (id) => set({ selectedId: id }),

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
