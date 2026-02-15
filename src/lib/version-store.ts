import { create } from 'zustand'
import type { SnippetVersion } from '@/types'
import { generateId } from './utils/id'
import { dbClient } from './db/client'

const MAX_VERSIONS_PER_SNIPPET = 100

interface VersionStore {
  versions: SnippetVersion[]
  hydrated: boolean

  // Actions
  hydrate: () => Promise<void>
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
  hydrated: false,

  hydrate: async () => {
    try {
      const versions = await dbClient.getVersions()
      set({ versions, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  saveVersion: (snippetId, text) => {
    const { versions, pruneVersions } = get()

    const snippetVersions = versions
      .filter((v) => v.snippetId === snippetId)
      .sort((a, b) => b.createdAt - a.createdAt)

    if (snippetVersions[0]?.text === text) {
      return null
    }

    const version: SnippetVersion = {
      id: generateId(),
      snippetId,
      text,
      createdAt: Date.now(),
    }

    set({ versions: [...versions, version] })
    dbClient.createVersion(version)
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
    set({ versions: get().versions.filter((v) => v.id !== id) })
    dbClient.deleteVersion(id)
  },

  keepLastN: (snippetId, n) => {
    const { versions } = get()
    const snippetVersions = versions
      .filter((v) => v.snippetId === snippetId)
      .sort((a, b) => b.createdAt - a.createdAt)

    if (snippetVersions.length <= n) return 0

    const toKeepIds = new Set(snippetVersions.slice(0, n).map((v) => v.id))
    const deletedCount = snippetVersions.length - n

    set({
      versions: versions.filter(
        (v) => v.snippetId !== snippetId || toKeepIds.has(v.id)
      ),
    })
    dbClient.pruneVersions(snippetId, n)
    return deletedCount
  },

  pruneVersions: (snippetId) => {
    const { versions } = get()
    const snippetVersions = versions
      .filter((v) => v.snippetId === snippetId)
      .sort((a, b) => b.createdAt - a.createdAt)

    if (snippetVersions.length <= MAX_VERSIONS_PER_SNIPPET) return

    const toKeepIds = new Set(
      snippetVersions.slice(0, MAX_VERSIONS_PER_SNIPPET).map((v) => v.id)
    )

    set({
      versions: versions.filter(
        (v) => v.snippetId !== snippetId || toKeepIds.has(v.id)
      ),
    })
    dbClient.pruneVersions(snippetId, MAX_VERSIONS_PER_SNIPPET)
  },

  clearVersionsForSnippet: (snippetId) => {
    set({ versions: get().versions.filter((v) => v.snippetId !== snippetId) })
    dbClient.deleteVersionsBySnippet(snippetId)
  },
}))

if (typeof window !== 'undefined') {
  window.__versionStore = useVersionStore
}
