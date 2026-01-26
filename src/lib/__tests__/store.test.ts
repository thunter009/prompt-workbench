import { describe, it, expect, beforeEach } from 'vitest'
import { useSnippetStore } from '../store'

describe('useSnippetStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSnippetStore.setState({
      snippets: [],
      folders: [],
      selectedId: null,
      selectedIds: new Set<string>(),
      searchQuery: '',
      editorDirty: false,
    })
  })

  describe('initial state', () => {
    it('should have empty snippets array', () => {
      const { snippets } = useSnippetStore.getState()
      expect(snippets).toEqual([])
    })

    it('should have empty folders array', () => {
      const { folders } = useSnippetStore.getState()
      expect(folders).toEqual([])
    })

    it('should have no selected snippet', () => {
      const { selectedId } = useSnippetStore.getState()
      expect(selectedId).toBeNull()
    })

    it('should have empty search query', () => {
      const { searchQuery } = useSnippetStore.getState()
      expect(searchQuery).toBe('')
    })

    it('should have editorDirty as false', () => {
      const { editorDirty } = useSnippetStore.getState()
      expect(editorDirty).toBe(false)
    })
  })

  describe('selectSnippet', () => {
    it('should set selectedId to the given id', () => {
      const { selectSnippet } = useSnippetStore.getState()
      selectSnippet('snippet-1')
      expect(useSnippetStore.getState().selectedId).toBe('snippet-1')
    })

    it('should clear selectedId when given null', () => {
      const { selectSnippet } = useSnippetStore.getState()
      selectSnippet('snippet-1')
      selectSnippet(null)
      expect(useSnippetStore.getState().selectedId).toBeNull()
    })
  })

  describe('createSnippet', () => {
    it('should add a new snippet with generated id', () => {
      const { createSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test Snippet', text: 'Hello world' })

      expect(snippet.id).toBeDefined()
      expect(snippet.name).toBe('Test Snippet')
      expect(snippet.text).toBe('Hello world')
      expect(useSnippetStore.getState().snippets).toHaveLength(1)
    })

    it('should set default values for optional fields', () => {
      const { createSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test', text: 'Text' })

      expect(snippet.tags).toEqual([])
      expect(snippet.version).toBe(1)
      expect(snippet.createdAt).toBeDefined()
      expect(snippet.updatedAt).toBeDefined()
    })

    it('should auto-select the created snippet', () => {
      const { createSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test', text: 'Text' })

      expect(useSnippetStore.getState().selectedId).toBe(snippet.id)
    })
  })

  describe('updateSnippet', () => {
    it('should update snippet properties', () => {
      const { createSnippet, updateSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Original', text: 'Original text' })

      updateSnippet(snippet.id, { name: 'Updated', text: 'Updated text' })

      const updated = useSnippetStore.getState().snippets.find(s => s.id === snippet.id)
      expect(updated?.name).toBe('Updated')
      expect(updated?.text).toBe('Updated text')
    })

    it('should increment version on update', () => {
      const { createSnippet, updateSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test', text: 'Text' })

      updateSnippet(snippet.id, { text: 'New text' })

      const updated = useSnippetStore.getState().snippets.find(s => s.id === snippet.id)
      expect(updated?.version).toBe(2)
    })

    it('should update updatedAt timestamp', () => {
      const { createSnippet, updateSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test', text: 'Text' })
      const originalUpdatedAt = snippet.updatedAt

      // Small delay to ensure timestamp changes
      updateSnippet(snippet.id, { text: 'New text' })

      const updated = useSnippetStore.getState().snippets.find(s => s.id === snippet.id)
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('deleteSnippet', () => {
    it('should remove snippet from store', () => {
      const { createSnippet, deleteSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test', text: 'Text' })

      deleteSnippet(snippet.id)

      expect(useSnippetStore.getState().snippets).toHaveLength(0)
    })

    it('should clear selectedId if deleted snippet was selected', () => {
      const { createSnippet, deleteSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test', text: 'Text' })

      deleteSnippet(snippet.id)

      expect(useSnippetStore.getState().selectedId).toBeNull()
    })
  })

  describe('search', () => {
    it('should set search query', () => {
      const { search } = useSnippetStore.getState()
      search('test query')
      expect(useSnippetStore.getState().searchQuery).toBe('test query')
    })
  })

  describe('setEditorDirty', () => {
    it('should set editorDirty to true', () => {
      const { setEditorDirty } = useSnippetStore.getState()
      setEditorDirty(true)
      expect(useSnippetStore.getState().editorDirty).toBe(true)
    })

    it('should set editorDirty to false', () => {
      const { setEditorDirty } = useSnippetStore.getState()
      setEditorDirty(true)
      setEditorDirty(false)
      expect(useSnippetStore.getState().editorDirty).toBe(false)
    })
  })

  describe('folder operations', () => {
    describe('createFolder', () => {
      it('should add a new folder with generated id', () => {
        const { createFolder } = useSnippetStore.getState()
        const folder = createFolder({ name: 'Test Folder' })

        expect(folder.id).toBeDefined()
        expect(folder.name).toBe('Test Folder')
        expect(useSnippetStore.getState().folders).toHaveLength(1)
      })

      it('should set default orderIndex', () => {
        const { createFolder } = useSnippetStore.getState()
        const folder = createFolder({ name: 'Test' })

        expect(folder.orderIndex).toBe(0)
      })

      it('should support nested folders via parentId', () => {
        const { createFolder } = useSnippetStore.getState()
        const parent = createFolder({ name: 'Parent' })
        const child = createFolder({ name: 'Child', parentId: parent.id })

        expect(child.parentId).toBe(parent.id)
      })
    })

    describe('updateFolder', () => {
      it('should update folder properties', () => {
        const { createFolder, updateFolder } = useSnippetStore.getState()
        const folder = createFolder({ name: 'Original' })

        updateFolder(folder.id, { name: 'Updated' })

        const updated = useSnippetStore.getState().folders.find(f => f.id === folder.id)
        expect(updated?.name).toBe('Updated')
      })
    })

    describe('deleteFolder', () => {
      it('should remove folder from store', () => {
        const { createFolder, deleteFolder } = useSnippetStore.getState()
        const folder = createFolder({ name: 'Test' })

        deleteFolder(folder.id)

        expect(useSnippetStore.getState().folders).toHaveLength(0)
      })

      it('should clear folderId from snippets in deleted folder', () => {
        const { createSnippet, createFolder, deleteFolder } = useSnippetStore.getState()
        const folder = createFolder({ name: 'Test' })
        const snippet = createSnippet({ name: 'Test', text: 'Text', folderId: folder.id })

        deleteFolder(folder.id)

        const updated = useSnippetStore.getState().snippets.find(s => s.id === snippet.id)
        expect(updated?.folderId).toBeUndefined()
      })
    })
  })

  describe('computed: selectedSnippet', () => {
    it('should return the selected snippet', () => {
      const { createSnippet, getSelectedSnippet } = useSnippetStore.getState()
      const snippet = createSnippet({ name: 'Test', text: 'Text' })

      const selected = getSelectedSnippet()
      expect(selected?.id).toBe(snippet.id)
    })

    it('should return undefined if no snippet selected', () => {
      const { getSelectedSnippet, selectSnippet } = useSnippetStore.getState()
      selectSnippet(null)

      expect(getSelectedSnippet()).toBeUndefined()
    })
  })

  describe('multi-select', () => {
    it('should have empty selectedIds initially', () => {
      const { selectedIds } = useSnippetStore.getState()
      expect(selectedIds.size).toBe(0)
    })

    it('selectSnippet should also set selectedIds', () => {
      const { selectSnippet } = useSnippetStore.getState()
      selectSnippet('snippet-1')
      expect(useSnippetStore.getState().selectedIds.has('snippet-1')).toBe(true)
    })

    it('toggleSelectSnippet should add to selection', () => {
      const { createSnippet, toggleSelectSnippet } = useSnippetStore.getState()
      const s1 = createSnippet({ name: 'S1', text: 'Text' })
      const s2 = createSnippet({ name: 'S2', text: 'Text' })

      toggleSelectSnippet(s1.id)
      toggleSelectSnippet(s2.id)

      const { selectedIds } = useSnippetStore.getState()
      expect(selectedIds.has(s1.id)).toBe(true)
      expect(selectedIds.has(s2.id)).toBe(true)
    })

    it('toggleSelectSnippet should remove if already selected', () => {
      const { createSnippet, toggleSelectSnippet } = useSnippetStore.getState()
      const s1 = createSnippet({ name: 'S1', text: 'Text' })

      toggleSelectSnippet(s1.id)
      toggleSelectSnippet(s1.id)

      const { selectedIds } = useSnippetStore.getState()
      expect(selectedIds.has(s1.id)).toBe(false)
    })

    it('selectAllSnippets should select all', () => {
      const { createSnippet, selectAllSnippets } = useSnippetStore.getState()
      createSnippet({ name: 'S1', text: 'Text' })
      createSnippet({ name: 'S2', text: 'Text' })

      selectAllSnippets()

      const { selectedIds, snippets } = useSnippetStore.getState()
      expect(selectedIds.size).toBe(snippets.length)
    })

    it('clearSelection should clear all selected', () => {
      const { createSnippet, toggleSelectSnippet, clearSelection } = useSnippetStore.getState()
      const s1 = createSnippet({ name: 'S1', text: 'Text' })
      toggleSelectSnippet(s1.id)

      clearSelection()

      const { selectedIds } = useSnippetStore.getState()
      expect(selectedIds.size).toBe(0)
    })

    it('getSelectedSnippets should return selected snippets', () => {
      const { createSnippet, toggleSelectSnippet, getSelectedSnippets } = useSnippetStore.getState()
      const s1 = createSnippet({ name: 'S1', text: 'Text1' })
      createSnippet({ name: 'S2', text: 'Text2' })

      toggleSelectSnippet(s1.id)

      const selected = getSelectedSnippets()
      expect(selected).toHaveLength(1)
      expect(selected[0].id).toBe(s1.id)
    })

    it('shift+click range select should select range', () => {
      const { createSnippet, selectSnippet, toggleSelectSnippet } = useSnippetStore.getState()
      const s1 = createSnippet({ name: 'S1', text: 'Text' })
      const s2 = createSnippet({ name: 'S2', text: 'Text' })
      const s3 = createSnippet({ name: 'S3', text: 'Text' })

      selectSnippet(s1.id)
      toggleSelectSnippet(s3.id, true) // shift+click

      const { selectedIds } = useSnippetStore.getState()
      expect(selectedIds.has(s1.id)).toBe(true)
      expect(selectedIds.has(s2.id)).toBe(true)
      expect(selectedIds.has(s3.id)).toBe(true)
    })
  })

  describe('computed: filteredSnippets', () => {
    it('should return all snippets when search query is empty', () => {
      const { createSnippet, getFilteredSnippets } = useSnippetStore.getState()
      createSnippet({ name: 'First', text: 'Text 1' })
      createSnippet({ name: 'Second', text: 'Text 2' })

      const filtered = getFilteredSnippets()
      expect(filtered).toHaveLength(2)
    })

    it('should filter snippets by name', () => {
      const { createSnippet, search, getFilteredSnippets } = useSnippetStore.getState()
      createSnippet({ name: 'Apple', text: 'Text' })
      createSnippet({ name: 'Banana', text: 'Text' })

      search('apple')
      const filtered = getFilteredSnippets()

      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Apple')
    })

    it('should filter snippets by text content', () => {
      const { createSnippet, search, getFilteredSnippets } = useSnippetStore.getState()
      createSnippet({ name: 'Test 1', text: 'Hello world' })
      createSnippet({ name: 'Test 2', text: 'Goodbye world' })

      search('hello')
      const filtered = getFilteredSnippets()

      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Test 1')
    })

    it('should filter snippets by keyword', () => {
      const { createSnippet, search, getFilteredSnippets } = useSnippetStore.getState()
      createSnippet({ name: 'Test 1', text: 'Text', keyword: 'greet' })
      createSnippet({ name: 'Test 2', text: 'Text', keyword: 'farewell' })

      search('greet')
      const filtered = getFilteredSnippets()

      expect(filtered).toHaveLength(1)
      expect(filtered[0].keyword).toBe('greet')
    })

    it('should be case-insensitive', () => {
      const { createSnippet, search, getFilteredSnippets } = useSnippetStore.getState()
      createSnippet({ name: 'UPPERCASE', text: 'Text' })

      search('upper')
      const filtered = getFilteredSnippets()

      expect(filtered).toHaveLength(1)
    })
  })
})
