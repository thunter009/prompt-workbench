import { create } from 'zustand'
import type { SnippetVersion } from '@/types'
import { generateId } from './utils/id'

const STORAGE_KEY = 'prompt-workbench-versions'
const MAX_VERSIONS_PER_SNIPPET = 100

interface VersionStore {
  versions: SnippetVersion[]

  // Actions
  load: () => void
  saveVersion: (snippetId: string, text: string) => SnippetVersion | null
  getVersionsForSnippet: (snippetId: string) => SnippetVersion[]
  getVersion: (id: string) => SnippetVersion | undefined
  deleteVersion: (id: string) => void
  keepLastN: (snippetId: string, n: number) => number
  pruneVersions: (snippetId: string) => void
  clearVersionsForSnippet: (snippetId: string) => void
}

// Expose store for Playwright tests
declare global {
  interface Window {
    __versionStore?: typeof useVersionStore
  }
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  versions: [],

  load: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const versions = JSON.parse(stored) as SnippetVersion[]
        set({ versions })
      }
    } catch {
      // Ignore parse errors
    }
  },

  saveVersion: (snippetId, text) => {
    const { versions, pruneVersions } = get()

    // Don't save if text matches most recent version for this snippet
    const snippetVersions = versions
      .filter((v) => v.snippetId === snippetId)
      .sort((a, b) => b.createdAt - a.createdAt)

    if (snippetVersions[0]?.text === text) {
      return null // No change
    }

    const version: SnippetVersion = {
      id: generateId(),
      snippetId,
      text,
      createdAt: Date.now(),
    }

    const newVersions = [...versions, version]
    set({ versions: newVersions })

    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newVersions))
    } catch {
      // Storage full - prune aggressively
    }

    // Prune if over limit
    pruneVersions(snippetId)

    return version
  },

  getVersionsForSnippet: (snippetId) => {
    return get()
      .versions.filter((v) => v.snippetId === snippetId)
      .sort((a, b) => b.createdAt - a.createdAt)
  },

  getVersion: (id) => {
    return get().versions.find((v) => v.id === id)
  },

  deleteVersion: (id) => {
    const newVersions = get().versions.filter((v) => v.id !== id)
    set({ versions: newVersions })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVersions))
  },

  keepLastN: (snippetId, n) => {
    const { versions } = get()
    const snippetVersions = versions
      .filter((v) => v.snippetId === snippetId)
      .sort((a, b) => b.createdAt - a.createdAt)

    if (snippetVersions.length <= n) {
      return 0 // Nothing to delete
    }

    const toKeepIds = new Set(snippetVersions.slice(0, n).map((v) => v.id))
    const deletedCount = snippetVersions.length - n

    const newVersions = versions.filter(
      (v) => v.snippetId !== snippetId || toKeepIds.has(v.id)
    )

    set({ versions: newVersions })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVersions))
    return deletedCount
  },

  pruneVersions: (snippetId) => {
    const { versions } = get()
    const snippetVersions = versions
      .filter((v) => v.snippetId === snippetId)
      .sort((a, b) => b.createdAt - a.createdAt)

    if (snippetVersions.length <= MAX_VERSIONS_PER_SNIPPET) {
      return // Nothing to prune
    }

    // Keep only the most recent MAX_VERSIONS_PER_SNIPPET
    const toKeepIds = new Set(
      snippetVersions.slice(0, MAX_VERSIONS_PER_SNIPPET).map((v) => v.id)
    )

    const newVersions = versions.filter(
      (v) => v.snippetId !== snippetId || toKeepIds.has(v.id)
    )

    set({ versions: newVersions })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVersions))
  },

  clearVersionsForSnippet: (snippetId) => {
    const newVersions = get().versions.filter((v) => v.snippetId !== snippetId)
    set({ versions: newVersions })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVersions))
  },
}))

if (typeof window !== 'undefined') {
  window.__versionStore = useVersionStore
}
