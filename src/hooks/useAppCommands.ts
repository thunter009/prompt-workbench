import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useCommands, type Command } from '@/lib/commands'
import { useSnippetStore } from '@/lib/store'
import { usePlaygroundStore } from '@/lib/playground-store'
import type { PanelImperativeHandle } from 'react-resizable-panels'

interface UseAppCommandsDeps {
  sidebarPanelRef: React.RefObject<PanelImperativeHandle | null>
  previewPanelRef: React.RefObject<PanelImperativeHandle | null>
  openPalette: (initialQuery?: string) => void
  setImportOpen: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setHotkeySheetOpen: (v: boolean) => void
  setDeleteDialogIds: (ids: string[]) => void
  handleSyncToRaycast: () => void
  handleImprove: () => void
}

export function useAppCommands(deps: UseAppCommandsDeps): Command[] {
  const {
    sidebarPanelRef, previewPanelRef,
    openPalette, setImportOpen, setSettingsOpen, setHotkeySheetOpen,
    setDeleteDialogIds, handleSyncToRaycast, handleImprove,
  } = deps

  const {
    selectedId, selectedIds,
    createSnippet, duplicateSnippet, folders, createFolder,
  } = useSnippetStore(
    useShallow((s) => ({
      selectedId: s.selectedId,
      selectedIds: s.selectedIds,
      createSnippet: s.createSnippet,
      duplicateSnippet: s.duplicateSnippet,
      folders: s.folders,
      createFolder: s.createFolder,
    }))
  )

  const activeTab = usePlaygroundStore((s) => s.activeTab)
  const playgroundSetActiveTab = usePlaygroundStore((s) => s.setActiveTab)
  const { resolvedTheme, setTheme } = useTheme()

  return useCommands({
    createSnippet: () => createSnippet({ name: 'New Snippet', text: '' }),
    createFolder: () => {
      const maxOrder = folders.reduce((max, f) => (!f.parentId ? Math.max(max, f.orderIndex) : max), -1)
      createFolder({ name: 'New Folder', orderIndex: maxOrder + 1 })
    },
    duplicateSelected: () => {
      const id = selectedIds.size > 0 ? Array.from(selectedIds)[0] : selectedId
      if (id) {
        const copy = duplicateSnippet(id)
        if (copy) toast.success(`Duplicated "${copy.name}"`)
      }
    },
    deleteSelected: () => {
      if (selectedIds.size > 0) setDeleteDialogIds(Array.from(selectedIds))
    },
    renameSelected: () => {
      toast('Select snippet in sidebar and press F2 to rename')
    },
    togglePreview: () => {
      const panel = previewPanelRef.current
      if (panel) { if (panel.isCollapsed()) { panel.expand() } else { panel.collapse() } }
    },
    toggleSidebar: () => {
      const panel = sidebarPanelRef.current
      if (panel) { if (panel.isCollapsed()) { panel.expand() } else { panel.collapse() } }
    },
    openSearch: () => openPalette(),
    togglePlayground: () => {
      playgroundSetActiveTab(activeTab === 'playground' ? 'preview' : 'playground')
      const panel = previewPanelRef.current
      if (panel?.isCollapsed()) panel.expand()
    },
    improvePrompt: () => handleImprove(),
    suggestKeywords: () => openPalette('>ai '),
    suggestFolder: () => openPalette('>ai '),
    reorganizeFolders: () => {
      window.dispatchEvent(new CustomEvent('command:reorganize-folders'))
    },
    syncToRaycast: handleSyncToRaycast,
    importFromRaycast: () => setImportOpen(true),
    openSettings: () => setSettingsOpen(true),
    toggleDarkMode: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    openShortcuts: () => setHotkeySheetOpen(true),
    hasSelection: selectedIds.size > 0 || !!selectedId,
  })
}
