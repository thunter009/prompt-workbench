import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVersionStore } from '../version-store'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('version-store', () => {
  beforeEach(() => {
    // Clear store state
    useVersionStore.setState({ versions: [] })
    // Clear localStorage mock
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('saveVersion', () => {
    it('saves a new version', () => {
      const { saveVersion, versions } = useVersionStore.getState()

      const version = saveVersion('snippet-1', 'Hello world')

      expect(version).not.toBeNull()
      expect(version?.snippetId).toBe('snippet-1')
      expect(version?.text).toBe('Hello world')
      expect(useVersionStore.getState().versions).toHaveLength(1)
    })

    it('returns null if text matches most recent version', () => {
      const { saveVersion } = useVersionStore.getState()

      // Save first version
      saveVersion('snippet-1', 'Hello world')

      // Try to save same text again
      const duplicate = saveVersion('snippet-1', 'Hello world')

      expect(duplicate).toBeNull()
      expect(useVersionStore.getState().versions).toHaveLength(1)
    })

    it('saves new version if text differs', () => {
      const { saveVersion } = useVersionStore.getState()

      saveVersion('snippet-1', 'Version 1')
      saveVersion('snippet-1', 'Version 2')

      expect(useVersionStore.getState().versions).toHaveLength(2)
    })

    it('tracks versions per snippet independently', () => {
      const { saveVersion } = useVersionStore.getState()

      saveVersion('snippet-1', 'Text A')
      saveVersion('snippet-2', 'Text B')
      saveVersion('snippet-1', 'Text A v2')

      expect(useVersionStore.getState().versions).toHaveLength(3)
    })
  })

  describe('getVersionsForSnippet', () => {
    it('returns versions sorted by createdAt descending', async () => {
      const { saveVersion, getVersionsForSnippet } = useVersionStore.getState()

      saveVersion('snippet-1', 'First')
      await new Promise((r) => setTimeout(r, 5)) // ensure different timestamps
      saveVersion('snippet-1', 'Second')
      await new Promise((r) => setTimeout(r, 5))
      saveVersion('snippet-1', 'Third')

      const versions = getVersionsForSnippet('snippet-1')

      expect(versions).toHaveLength(3)
      expect(versions[0].text).toBe('Third')
      expect(versions[2].text).toBe('First')
    })

    it('returns empty array for unknown snippet', () => {
      const { getVersionsForSnippet } = useVersionStore.getState()

      const versions = getVersionsForSnippet('unknown')

      expect(versions).toHaveLength(0)
    })
  })

  describe('deleteVersion', () => {
    it('removes a version by id', () => {
      const { saveVersion, deleteVersion, getVersionsForSnippet } = useVersionStore.getState()

      const version = saveVersion('snippet-1', 'To delete')
      expect(getVersionsForSnippet('snippet-1')).toHaveLength(1)

      deleteVersion(version!.id)

      expect(getVersionsForSnippet('snippet-1')).toHaveLength(0)
    })
  })

  describe('pruneVersions', () => {
    it('keeps only 100 most recent versions per snippet', () => {
      const { saveVersion, getVersionsForSnippet } = useVersionStore.getState()

      // Save 105 versions with distinct timestamps by manipulating Date.now
      const now = Date.now()
      vi.spyOn(Date, 'now').mockImplementation(() => now)

      for (let i = 0; i < 105; i++) {
        vi.spyOn(Date, 'now').mockImplementation(() => now + i)
        saveVersion('snippet-1', `Version ${i}`)
      }

      vi.restoreAllMocks()

      const versions = getVersionsForSnippet('snippet-1')

      expect(versions).toHaveLength(100)
      // Most recent should be kept (versions 5-104)
      expect(versions[0].text).toBe('Version 104')
    })
  })

  describe('clearVersionsForSnippet', () => {
    it('removes all versions for a snippet', () => {
      const { saveVersion, clearVersionsForSnippet, getVersionsForSnippet } = useVersionStore.getState()

      saveVersion('snippet-1', 'A')
      saveVersion('snippet-1', 'B')
      saveVersion('snippet-2', 'C')

      clearVersionsForSnippet('snippet-1')

      expect(getVersionsForSnippet('snippet-1')).toHaveLength(0)
      expect(getVersionsForSnippet('snippet-2')).toHaveLength(1)
    })
  })

  describe('load', () => {
    it('loads versions from localStorage', () => {
      const existingVersions = [
        { id: 'v1', snippetId: 's1', text: 'Stored', createdAt: Date.now() }
      ]
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(existingVersions))

      useVersionStore.getState().load()

      expect(useVersionStore.getState().versions).toHaveLength(1)
      expect(useVersionStore.getState().versions[0].text).toBe('Stored')
    })

    it('handles invalid JSON gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('not valid json')

      // Should not throw
      useVersionStore.getState().load()

      expect(useVersionStore.getState().versions).toHaveLength(0)
    })
  })
})
