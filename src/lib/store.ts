import { create } from 'zustand'
import type { Snippet, Folder } from '@/types'
import { useVersionStore } from './version-store'
import { generateId } from './utils/id'
import { dbClient } from './db/client'

export const MAX_DEPTH = 3

// Debounced version saving per snippet
const DEBOUNCE_MS = 2000
const versionSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleVersionSave(snippetId: string, text: string) {
  const existingTimer = versionSaveTimers.get(snippetId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timer = setTimeout(() => {
    useVersionStore.getState().saveVersion(snippetId, text)
    versionSaveTimers.delete(snippetId)
  }, DEBOUNCE_MS)

  versionSaveTimers.set(snippetId, timer)
}

type ExportFilter = 'all' | 'unexported' | 'modified'
type TagFilterMode = 'and' | 'or'

interface ExportSettings {
  defaultPath: string | null
  hasDirectoryHandle: boolean
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
  resolveIncludes: boolean
  syncScroll: boolean
  exportFilter: ExportFilter
  exportSettings: ExportSettings
  recentSnippetIds: string[]
  searchSettings: SearchSettings
  selectedTags: string[]
  tagFilterMode: TagFilterMode
  hydrated: boolean

  // Hydration
  hydrate: () => Promise<void>

  // Snippet actions
  selectSnippet: (id: string | null) => void
  toggleSelectSnippet: (id: string, shiftKey?: boolean) => void
  selectAllSnippets: () => void
  clearSelection: () => void
  getSelectedSnippets: () => Snippet[]
  createSnippet: (data: Partial<Snippet>) => Snippet
  updateSnippet: (id: string, data: Partial<Snippet>) => void
  deleteSnippet: (id: string) => void
  deleteSnippets: (ids: string[]) => Snippet[]
  duplicateSnippet: (id: string) => Snippet | undefined
  markExported: (ids: string[]) => void
  search: (query: string) => void
  setEditorDirty: (dirty: boolean) => void
  setExportFilter: (filter: ExportFilter) => void

  // UI actions
  togglePreview: () => void
  setPreviewVisible: (visible: boolean) => void
  togglePreviewValues: () => void
  setPreviewValues: (enabled: boolean) => void
  toggleResolveIncludes: () => void
  toggleSyncScroll: () => void
  setSyncScroll: (enabled: boolean) => void

  // Export settings actions
  setExportSettings: (settings: Partial<ExportSettings>) => void

  // Search settings actions
  setSearchSettings: (settings: Partial<SearchSettings>) => void
  getCurrentFolderContext: () => { folderId: string | null; folderName: string | null }

  // Tag filter actions
  toggleTagFilter: (tag: string) => void
  clearTagFilter: () => void
  setTagFilterMode: (mode: TagFilterMode) => void
  getAllTags: () => string[]

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
  // Start empty, hydrate from API
  snippets: [],
  folders: [],
  selectedId: null,
  selectedIds: new Set<string>(),
  selectedFolderId: null,
  searchQuery: '',
  editorDirty: false,
  previewVisible: true,
  previewValues: false,
  resolveIncludes: true,
  syncScroll: true,
  exportFilter: 'all' as ExportFilter,
  exportSettings: { defaultPath: null, hasDirectoryHandle: false },
  recentSnippetIds: [],
  searchSettings: { scopeToCurrentFolder: false },
  selectedTags: [],
  tagFilterMode: 'or' as TagFilterMode,
  hydrated: false,

  hydrate: async () => {
    try {
      const [snippets, folders, settingsMap] = await Promise.all([
        dbClient.getSnippets(),
        dbClient.getFolders(),
        dbClient.getSettings([
          'previewVisible', 'previewValues', 'resolveIncludes', 'syncScroll',
          'selectedId', 'selectedFolderId', 'recentSnippetIds', 'searchSettings',
        ]),
      ])

      set({
        snippets,
        folders,
        hydrated: true,
        previewVisible: settingsMap.previewVisible as boolean ?? true,
        previewValues: settingsMap.previewValues as boolean ?? false,
        resolveIncludes: settingsMap.resolveIncludes as boolean ?? true,
        syncScroll: settingsMap.syncScroll as boolean ?? true,
        selectedId: settingsMap.selectedId as string ?? null,
        selectedFolderId: settingsMap.selectedFolderId as string ?? null,
        recentSnippetIds: settingsMap.recentSnippetIds as string[] ?? [],
        searchSettings: settingsMap.searchSettings as SearchSettings ?? { scopeToCurrentFolder: false },
      })
    } catch {
      // DB not available, stay empty
      set({ hydrated: true })
    }
  },

  // Snippet actions
  selectSnippet: (id) => set((state) => {
    if (!id) return { selectedId: null, selectedIds: new Set() }
    const recent = [id, ...state.recentSnippetIds.filter((rid) => rid !== id)].slice(0, 10)
    dbClient.saveSettings([
      { key: 'selectedId', value: id },
      { key: 'recentSnippetIds', value: recent },
    ])
    return { selectedId: id, selectedIds: new Set([id]), recentSnippetIds: recent }
  }),

  toggleSelectSnippet: (id, shiftKey = false) => {
    const { selectedIds, snippets, selectedId } = get()
    const newSelection = new Set(selectedIds)

    if (shiftKey && selectedId) {
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

    dbClient.createSnippet(snippet)
    return snippet
  },

  updateSnippet: (id, data) => {
    if (data.text !== undefined) {
      const currentSnippet = get().snippets.find((s) => s.id === id)
      if (currentSnippet && currentSnippet.text !== data.text) {
        scheduleVersionSave(id, data.text)
      }
    }

    let updatedData: Partial<Snippet> = {}
    set((state) => ({
      snippets: state.snippets.map((s) => {
        if (s.id === id) {
          updatedData = { ...data, updatedAt: Date.now(), version: s.version + 1 }
          return { ...s, ...updatedData }
        }
        return s
      }),
    }))

    dbClient.updateSnippet(id, updatedData)
  },

  deleteSnippet: (id) => {
    set((state) => ({
      snippets: state.snippets.filter((s) => s.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }))
    dbClient.deleteSnippets([id])
  },

  deleteSnippets: (ids) => {
    const { snippets } = get()
    const deleted = snippets.filter((s) => ids.includes(s.id))
    set((state) => ({
      snippets: state.snippets.filter((s) => !ids.includes(s.id)),
      selectedId: state.selectedId && ids.includes(state.selectedId) ? null : state.selectedId,
      selectedIds: new Set(),
    }))
    dbClient.deleteSnippets(ids)
    return deleted
  },

  duplicateSnippet: (id) => {
    const { snippets } = get()
    const source = snippets.find((s) => s.id === id)
    if (!source) return undefined
    const now = Date.now()
    const copy: Snippet = {
      ...source,
      id: generateId(),
      name: `${source.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastExportedAt: undefined,
      raycastSyncedAt: undefined,
    }
    set((state) => ({
      snippets: [...state.snippets, copy],
      selectedId: copy.id,
      selectedIds: new Set([copy.id]),
    }))
    dbClient.createSnippet(copy)
    return copy
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
    for (const id of ids) {
      dbClient.updateSnippet(id, { lastExportedAt: now })
    }
  },

  // UI actions
  togglePreview: () => set((state) => {
    const next = !state.previewVisible
    dbClient.saveSetting('previewVisible', next)
    return { previewVisible: next }
  }),
  setPreviewVisible: (visible) => {
    set({ previewVisible: visible })
    dbClient.saveSetting('previewVisible', visible)
  },
  togglePreviewValues: () => set((state) => {
    const next = !state.previewValues
    dbClient.saveSetting('previewValues', next)
    return { previewValues: next }
  }),
  setPreviewValues: (enabled) => {
    set({ previewValues: enabled })
    dbClient.saveSetting('previewValues', enabled)
  },
  toggleResolveIncludes: () => set((state) => {
    const next = !state.resolveIncludes
    dbClient.saveSetting('resolveIncludes', next)
    return { resolveIncludes: next }
  }),
  toggleSyncScroll: () => set((state) => {
    const next = !state.syncScroll
    dbClient.saveSetting('syncScroll', next)
    return { syncScroll: next }
  }),
  setSyncScroll: (enabled) => {
    set({ syncScroll: enabled })
    dbClient.saveSetting('syncScroll', enabled)
  },

  // Export settings actions
  setExportSettings: (settings) => set((state) => ({
    exportSettings: { ...state.exportSettings, ...settings }
  })),

  // Search settings actions
  setSearchSettings: (settings) => set((state) => {
    const merged = { ...state.searchSettings, ...settings }
    dbClient.saveSetting('searchSettings', merged)
    return { searchSettings: merged }
  }),

  // Tag filter actions
  toggleTagFilter: (tag) => set((state) => {
    const idx = state.selectedTags.indexOf(tag)
    if (idx >= 0) {
      return { selectedTags: state.selectedTags.filter((t) => t !== tag) }
    }
    return { selectedTags: [...state.selectedTags, tag] }
  }),

  clearTagFilter: () => set({ selectedTags: [] }),

  setTagFilterMode: (mode) => set({ tagFilterMode: mode }),

  getAllTags: () => {
    const { snippets } = get()
    const tagSet = new Set<string>()
    for (const s of snippets) {
      for (const t of s.tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  },

  getCurrentFolderContext: () => {
    const { selectedId, selectedFolderId, snippets, folders } = get()
    if (selectedFolderId) {
      const folder = folders.find((f) => f.id === selectedFolderId)
      return { folderId: selectedFolderId, folderName: folder?.name ?? null }
    }
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
  selectFolder: (id) => {
    set({ selectedFolderId: id, selectedId: null, selectedIds: new Set() })
    dbClient.saveSetting('selectedFolderId', id)
  },

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

    dbClient.createFolder(folder)
    return folder
  },

  updateFolder: (id, data) => {
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === id ? { ...f, ...data } : f
      ),
    }))
    dbClient.updateFolder(id, data)
  },

  deleteFolder: (id) => {
    set((state) => {
      const deleted = state.folders.find((f) => f.id === id)
      const parentId = deleted?.parentId
      const updatedSnippets = state.snippets.map((s) =>
        s.folderId === id ? { ...s, folderId: parentId } : s
      )
      const updatedFolders = state.folders
        .filter((f) => f.id !== id)
        .map((f) => f.parentId === id ? { ...f, parentId } : f)

      // Persist orphaned snippets
      for (const s of state.snippets) {
        if (s.folderId === id) {
          dbClient.updateSnippet(s.id, { folderId: parentId })
        }
      }
      // Persist orphaned child folders
      for (const f of state.folders) {
        if (f.parentId === id) {
          dbClient.updateFolder(f.id, { parentId })
        }
      }

      return { folders: updatedFolders, snippets: updatedSnippets }
    })
    dbClient.deleteFolder(id)
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
    const previousFolders = snippetIds.map((id) => {
      const snippet = snippets.find((s) => s.id === id)
      return { snippetId: id, previousFolderId: snippet?.folderId }
    })

    set((state) => ({
      snippets: state.snippets.map((s) =>
        snippetIds.includes(s.id) ? { ...s, folderId: folderId ?? undefined, updatedAt: Date.now() } : s
      ),
    }))

    for (const id of snippetIds) {
      dbClient.updateSnippet(id, { folderId: folderId ?? undefined, updatedAt: Date.now() })
    }

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

    dbClient.updateFolder(folderId, { parentId: newParentId ?? undefined, orderIndex: newOrderIndex })

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

    const siblings = folders
      .filter((f) => f.parentId === folder.parentId && f.id !== folderId)
      .sort((a, b) => a.orderIndex - b.orderIndex)

    const previousOrders = [{ folderId, previousOrderIndex: folder.orderIndex }]

    siblings.splice(targetIndex, 0, folder)
    const updates: { id: string; orderIndex: number }[] = siblings.map((f, i) => ({
      id: f.id,
      orderIndex: i,
    }))

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

    for (const u of updates) {
      dbClient.updateFolder(u.id, { orderIndex: u.orderIndex })
    }

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
    const { snippets, searchQuery, selectedTags, tagFilterMode } = get()
    let result = snippets

    if (selectedTags.length > 0) {
      result = result.filter((s) => {
        if (tagFilterMode === 'and') {
          return selectedTags.every((t) => s.tags.includes(t))
        }
        return selectedTags.some((t) => s.tags.includes(t))
      })
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.text.toLowerCase().includes(query) ||
          s.keyword?.toLowerCase().includes(query)
      )
    }

    return result
  },
}))

if (typeof window !== 'undefined') {
  window.__snippetStore = useSnippetStore
}
