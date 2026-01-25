import { describe, it, expect, beforeEach } from 'vitest'
import { useSnippetStore } from '../store'

describe('useSnippetStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSnippetStore.setState({
      snippets: [],
      folders: [],
      selectedId: null,
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
