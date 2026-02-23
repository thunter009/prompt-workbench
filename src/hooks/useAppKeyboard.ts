import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { useSnippetStore } from '@/lib/store'
import { usePlaygroundStore } from '@/lib/playground-store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import type { PanelImperativeHandle } from 'react-resizable-panels'

interface UseAppKeyboardDeps {
  previewPanelRef: React.RefObject<PanelImperativeHandle | null>
  openPalette: (initialQuery?: string) => void
  setSettingsOpen: (v: boolean) => void
  setHotkeySheetOpen: (v: boolean) => void
  setDeleteDialogIds: (ids: string[]) => void
  handleQuickExport: (autoImport: boolean) => void
  handleSyncToRaycast: () => void
}

export function useAppKeyboard(deps: UseAppKeyboardDeps): void {
  const {
    previewPanelRef,
    openPalette,
    setSettingsOpen, setHotkeySheetOpen, setDeleteDialogIds,
    handleQuickExport, handleSyncToRaycast,
  } = deps

  const {
    snippets, selectedId, selectedIds, getSelectedSnippet,
    createSnippet, duplicateSnippet, folders, createFolder,
    selectAllSnippets, clearSelection,
  } = useSnippetStore(
    useShallow((s) => ({
      snippets: s.snippets,
      selectedId: s.selectedId,
      selectedIds: s.selectedIds,
      getSelectedSnippet: s.getSelectedSnippet,
      createSnippet: s.createSnippet,
      duplicateSnippet: s.duplicateSnippet,
      folders: s.folders,
      createFolder: s.createFolder,
      selectAllSnippets: s.selectAllSnippets,
      clearSelection: s.clearSelection,
    }))
  )

  const playgroundRun = usePlaygroundStore((s) => s.run)
  const playgroundSetActiveTab = usePlaygroundStore((s) => s.setActiveTab)

  const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {})

  handlerRef.current = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      openPalette()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault()
      openPalette()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault()
      const panel = previewPanelRef.current
      if (panel) {
        if (panel.isCollapsed()) { panel.expand() } else { panel.collapse() }
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault()
      openPalette('>ai ')
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      openPalette('/ ')
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      handleQuickExport(false)
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      handleSyncToRaycast()
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      const s = getSelectedSnippet()
      if (s) {
        playgroundSetActiveTab('playground')
        playgroundRun({
          text: s.text,
          snippetId: s.id,
          ollamaUrl: useAISettingsStore.getState().ollamaUrl,
          model: useAISettingsStore.getState().ollamaModel,
          snippets,
        })
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault()
      setSettingsOpen(true)
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === '?' || e.key === '/')) {
      e.preventDefault()
      setHotkeySheetOpen(true)
    }

    // Snippet CRUD shortcuts — skip when typing in inputs or editor
    const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    const inEditor = (e.target as HTMLElement)?.closest?.('.cm-editor')
    if (inInput || inEditor) return

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
      e.preventDefault()
      createSnippet({ name: 'New Snippet', text: '' })
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      const maxOrder = folders.reduce((max, f) => (!f.parentId ? Math.max(max, f.orderIndex) : max), -1)
      createFolder({ name: 'New Folder', orderIndex: maxOrder + 1 })
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
      if (selectedIds.size > 0) {
        e.preventDefault()
        setDeleteDialogIds(Array.from(selectedIds))
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      const id = selectedIds.size > 0 ? Array.from(selectedIds)[0] : selectedId
      if (id) {
        e.preventDefault()
        const copy = duplicateSnippet(id)
        if (copy) toast.success(`Duplicated "${copy.name}"`)
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault()
      selectAllSnippets()
    }
    if (e.key === 'Escape') {
      if (selectedIds.size > 0) {
        e.preventDefault()
        clearSelection()
      }
    }
  }

  // Bind keyboard listener once on mount
  useEffect(() => {
    const handler = (e: KeyboardEvent) => handlerRef.current(e)
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
