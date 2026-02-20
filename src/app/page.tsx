'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'
import { useFileSync } from '@/hooks/useFileSync'
import { useEditorSync } from '@/hooks/useEditorSync'
import { useExportSync } from '@/hooks/useExportSync'
import { useAppKeyboard } from '@/hooks/useAppKeyboard'
import { useAppCommands } from '@/hooks/useAppCommands'
import { useDeleteDialog } from '@/hooks/useDeleteDialog'
import { AppHeader } from '@/components/AppHeader'
import { usePlaygroundStore } from '@/lib/playground-store'
import { cn } from '@/lib/utils'
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel'
import { EditorDynamic } from '@/components/editor/EditorDynamic'
import { EditorPanelHeader } from '@/components/editor/EditorPanel'
import { PreviewDynamic } from '@/components/preview/PreviewDynamic'
import { PreviewToolbar } from '@/components/preview'
import { Sidebar } from '@/components/Sidebar'
import { SidebarRail } from '@/components/SidebarRail'
import { ValidationDialog } from '@/components/ValidationDialog'
import { ConflictPanel } from '@/components/ConflictPanel'
import { SearchPalette } from '@/components/SearchPalette'
import { CommandPalette } from '@/components/CommandPalette'
import { CrossSnippetSearch } from '@/components/CrossSnippetSearch'
import { VersionHistorySidebar } from '@/components/VersionHistorySidebar'
import { SettingsModal } from '@/components/SettingsModal'
import { ImportModal } from '@/components/ImportModal'
import { HotkeyCheatsheet } from '@/components/HotkeyCheatsheet'
import { useAppInit } from '@/hooks/useAppInit'
import { useSnippetStore } from '@/lib/store'
import { ImprovePromptButton, ImprovePromptReview } from '@/components/ImprovePrompt'
import { Check, Loader2, Eye, EyeOff } from 'lucide-react'
import { InlineDiffView } from '@/components/editor/InlineDiffView'


export default function HomePage() {
  const { mounted } = useAppInit()
  const editor = useEditorSync()
  const exportSync = useExportSync(editor.content)
  const deleteDialog = useDeleteDialog()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sidebarPanelRef = usePanelRef()
  const previewPanelRef = usePanelRef()

  // UI state
  const { previewVisible, setPreviewVisible, syncScroll } = useSnippetStore(
    useShallow((s) => ({
      previewVisible: s.previewVisible,
      setPreviewVisible: s.setPreviewVisible,
      syncScroll: s.syncScroll,
    }))
  )

  const { snippets, selectedId } = useSnippetStore(
    useShallow((s) => ({
      snippets: s.snippets,
      selectedId: s.selectedId,
    }))
  )

  const [searchOpen, setSearchOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [hotkeySheetOpen, setHotkeySheetOpen] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Playground
  const activeTab = usePlaygroundStore((s) => s.activeTab)
  const playgroundSetActiveTab = usePlaygroundStore((s) => s.setActiveTab)

  useFileSync()

  // Auto-expand preview panel when switching to Playground tab while collapsed
  useEffect(() => {
    if (!mounted) return
    const panel = previewPanelRef.current
    if (activeTab === 'playground' && panel?.isCollapsed()) {
      panel.expand()
    }
  }, [activeTab, mounted, previewPanelRef])



  useAppKeyboard({
    previewPanelRef,
    setSearchOpen,
    setCommandPaletteOpen,
    setGlobalSearchOpen,
    setSettingsOpen,
    setHotkeySheetOpen,
    setDeleteDialogIds: deleteDialog.setDeleteDialogIds,
    handleQuickExport: exportSync.handleQuickExport,
    handleSyncToRaycast: exportSync.handleSyncToRaycast,
    handleImprove: editor.improve.handleImprove,
  })

  // Track viewport width for responsive layout
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Close export menu on outside click
  useEffect(() => {
    if (!exportSync.exportMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (exportSync.exportMenuRef.current && !exportSync.exportMenuRef.current.contains(e.target as Node)) {
        exportSync.setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportSync.exportMenuOpen, exportSync.exportMenuRef, exportSync.setExportMenuOpen])

  // Persist panel layout across reloads (SSR-safe storage)
  const ssrSafeStorage = useMemo(() => ({
    getItem: (key: string) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
    setItem: (key: string, value: string) => { if (typeof window !== 'undefined') localStorage.setItem(key, value) },
  }), [])
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'prompt-workbench-layout',
    storage: ssrSafeStorage,
  })

  const appCommands = useAppCommands({
    sidebarPanelRef,
    previewPanelRef,
    setSearchOpen,
    setImportOpen,
    setSettingsOpen,
    setHotkeySheetOpen,
    setDeleteDialogIds: deleteDialog.setDeleteDialogIds,
    handleSyncToRaycast: exportSync.handleSyncToRaycast,
    handleImprove: editor.improve.handleImprove,
  })

  const togglePreviewPanel = useCallback(() => {
    const panel = previewPanelRef.current
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand()
      } else {
        panel.collapse()
      }
    }
  }, [previewPanelRef])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="h-screen flex flex-col">
        <AppHeader
          isMobile={isMobile}
          mobileSidebarOpen={mobileSidebarOpen}
          setMobileSidebarOpen={setMobileSidebarOpen}
          historyOpen={historyOpen}
          setHistoryOpen={setHistoryOpen}
          setSettingsOpen={setSettingsOpen}
          setHotkeySheetOpen={setHotkeySheetOpen}
          setImportOpen={setImportOpen}
          togglePreviewPanel={togglePreviewPanel}
          exportSync={exportSync}
        />
        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile sidebar overlay */}
          {isMobile && mobileSidebarOpen && (
            <>
              <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setMobileSidebarOpen(false)} />
              <aside className="absolute inset-y-0 left-0 w-72 z-40 bg-background shadow-xl animate-in slide-in-from-left duration-150">
                <Sidebar />
              </aside>
            </>
          )}

          {/* Desktop layout with resizable panels */}
          {!isMobile && (
            <>
              {sidebarCollapsed && (
                <SidebarRail
                  onExpand={() => sidebarPanelRef.current?.expand()}
                  onOpenSearch={() => setSearchOpen(true)}
                />
              )}
              <Group
                orientation="horizontal"
                id="prompt-workbench-layout"
                defaultLayout={defaultLayout}
                onLayoutChanged={onLayoutChanged}
              >
                {/* Sidebar panel - collapsible to icon rail */}
                <Panel
                  id="sidebar"
                  panelRef={sidebarPanelRef}
                  defaultSize="20%"
                  minSize="15%"
                  collapsible
                  collapsedSize="0%"
                  onResize={(size) => setSidebarCollapsed(size.asPercentage === 0)}
                >
                  <Sidebar />
                </Panel>
                {!sidebarCollapsed && (
                  <Separator className="w-1 bg-border hover:bg-blue-500 transition-colors data-[active]:bg-blue-500" />
                )}

                {/* Editor panel */}
                <Panel id="editor" defaultSize="50%" minSize="20%">
                  <div className="flex flex-col h-full overflow-hidden">
                    {!editor.activeDiff && (
                      <div className="flex items-center border-b border-border">
                        <EditorPanelHeader />
                        <div className="ml-auto px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <button
                            onClick={editor.toggleInlinePreviews}
                            className={cn(
                              'p-1.5 rounded hover:bg-accent transition-colors',
                              editor.inlinePreviewsOn ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-secondary-foreground'
                            )}
                            title={editor.inlinePreviewsOn ? 'Hide placeholder previews' : 'Show placeholder previews'}
                          >
                            {editor.inlinePreviewsOn ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <ImprovePromptButton disabled={editor.improve.disabled} loading={editor.improve.status === 'loading'} onImprove={editor.improve.handleImprove} />
                          <span data-testid="save-indicator" className="flex items-center gap-1">
                            {editor.saveStatus === 'saving' && (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Saving...</span>
                              </>
                            )}
                            {editor.saveStatus === 'saved' && (
                              <>
                                <Check className="w-3 h-3 text-green-500" />
                                <span className="text-green-500">Saved</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex-1 overflow-auto relative">
                      {!selectedId && !editor.activeDiff ? (
                        <div data-testid="empty-state" className="flex-1 flex items-center justify-center h-full">
                          <span className="text-sm text-muted-foreground">Select a snippet to start editing</span>
                        </div>
                      ) : editor.activeDiff ? (
                        <InlineDiffView {...editor.activeDiff} />
                      ) : (
                        <>
                          <EditorDynamic value={editor.content} onChange={editor.handleContentChange} onScrollProgress={editor.handleEditorScroll} onViewReady={editor.handleEditorViewReady} />
                          <ImprovePromptReview status={editor.improve.status} improved={editor.improve.improved} error={editor.improve.error} onAccept={editor.improve.accept} onReject={editor.improve.reject} />
                        </>
                      )}
                    </div>
                  </div>
                </Panel>
                <Separator className="w-1 bg-border hover:bg-blue-500 transition-colors data-[active]:bg-blue-500" />

                {/* Preview panel - collapsible */}
                <Panel
                  id="preview"
                  panelRef={previewPanelRef}
                  defaultSize="30%"
                  minSize="15%"
                  collapsible
                  collapsedSize="0%"
                  onResize={(size) => setPreviewVisible(size.asPercentage > 0)}
                >
                  <div className="h-full flex flex-col overflow-hidden">
                    {/* Tab bar: Preview | Playground */}
                    <div className="flex border-b border-border shrink-0">
                      <button
                        onClick={() => playgroundSetActiveTab('preview')}
                        className={cn(
                          'px-4 py-2 text-sm font-medium transition-colors',
                          activeTab === 'preview'
                            ? 'text-foreground border-b-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => playgroundSetActiveTab('playground')}
                        className={cn(
                          'px-4 py-2 text-sm font-medium transition-colors',
                          activeTab === 'playground'
                            ? 'text-foreground border-b-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Playground
                      </button>
                      <div className="ml-auto flex items-center pr-2">
                        {activeTab === 'preview' && <PreviewToolbar />}
                      </div>
                    </div>
                    {activeTab === 'preview' ? (
                      <div className="flex-1 overflow-auto">
                        <PreviewDynamic content={editor.content} scrollProgress={syncScroll ? editor.scrollProgress : undefined} />
                      </div>
                    ) : (
                      <PlaygroundPanel />
                    )}
                  </div>
                </Panel>
              </Group>
            </>
          )}

          {/* Mobile editor (full-width, no preview) */}
          {isMobile && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {!editor.activeDiff && (
                <div className="flex items-center border-b border-border">
                  <EditorPanelHeader />
                  <div className="ml-auto px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <button
                      onClick={editor.toggleInlinePreviews}
                      className={cn(
                        'p-1.5 rounded hover:bg-accent transition-colors',
                        editor.inlinePreviewsOn ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-secondary-foreground'
                      )}
                      title={editor.inlinePreviewsOn ? 'Hide placeholder previews' : 'Show placeholder previews'}
                    >
                      {editor.inlinePreviewsOn ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <ImprovePromptButton disabled={editor.improve.disabled} loading={editor.improve.status === 'loading'} onImprove={editor.improve.handleImprove} />
                    <span data-testid="save-indicator" className="flex items-center gap-1">
                      {editor.saveStatus === 'saving' && (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </>
                      )}
                      {editor.saveStatus === 'saved' && (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">Saved</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto relative">
                {editor.activeDiff ? (
                  <InlineDiffView {...editor.activeDiff} />
                ) : (
                  <>
                    <EditorDynamic value={editor.content} onChange={editor.handleContentChange} onScrollProgress={editor.handleEditorScroll} onViewReady={editor.handleEditorViewReady} />
                    <ImprovePromptReview status={editor.improve.status} improved={editor.improve.improved} error={editor.improve.error} onAccept={editor.improve.accept} onReject={editor.improve.reject} />
                  </>
                )}
              </div>
            </div>
          )}

          <VersionHistorySidebar open={historyOpen} onOpenChange={setHistoryOpen} onDiffChange={editor.setActiveDiff} />
        </div>
      </div>

      <ConflictPanel />

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} commands={appCommands} />
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <CrossSnippetSearch open={globalSearchOpen} onOpenChange={setGlobalSearchOpen} />

      {exportSync.validationResult && (
        <ValidationDialog
          result={exportSync.validationResult}
          open={!!exportSync.validationResult}
          onClose={exportSync.handleValidationClose}
          onProceed={exportSync.handleValidationProceed}
          onNavigateToSnippet={exportSync.handleNavigateToSnippet}
        />
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <HotkeyCheatsheet open={hotkeySheetOpen} onClose={() => setHotkeySheetOpen(false)} />

      {/* Delete Snippet Confirmation (keyboard shortcut) */}
      {deleteDialog.deleteDialogIds.length > 0 && (
        <dialog
          ref={deleteDialog.deleteDialogRef}
          onClick={(e) => { if (e.target === deleteDialog.deleteDialogRef.current) deleteDialog.setDeleteDialogIds([]) }}
          className="backdrop:bg-black/50 bg-transparent p-0 max-w-sm w-full"
        >
          <div className="bg-muted border border-border rounded-lg shadow-xl p-4 mx-4">
            <h3 className="text-lg font-medium text-foreground mb-2">
              Delete {deleteDialog.deleteDialogIds.length === 1 ? 'Snippet' : `${deleteDialog.deleteDialogIds.length} Snippets`}?
            </h3>
            <div className="text-sm text-muted-foreground mb-4">
              {deleteDialog.deleteDialogIds.length === 1
                ? <p>&ldquo;{snippets.find((s) => s.id === deleteDialog.deleteDialogIds[0])?.name}&rdquo; will be permanently deleted.</p>
                : (
                  <>
                    <p className="mb-2">{deleteDialog.deleteDialogIds.length} snippets will be permanently deleted:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {deleteDialog.deleteDialogIds.slice(0, 5).map((id) => (
                        <li key={id} className="truncate">{snippets.find((s) => s.id === id)?.name}</li>
                      ))}
                      {deleteDialog.deleteDialogIds.length > 5 && (
                        <li className="text-muted-foreground/70">+ {deleteDialog.deleteDialogIds.length - 5} more</li>
                      )}
                    </ul>
                  </>
                )}
              <p className="mt-2">You can undo this with &#x2318;Z.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => deleteDialog.setDeleteDialogIds([])}
                data-testid="kbd-delete-cancel"
                className="px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteDialog.handleDeleteConfirm}
                data-testid="kbd-delete-confirm"
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  )
}
