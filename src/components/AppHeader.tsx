'use client'

import { useShallow } from 'zustand/react/shallow'
import { preloadEditor } from '@/components/editor/EditorDynamic'
import { preloadPreview } from '@/components/preview/PreviewDynamic'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSnippetStore } from '@/lib/store'
import { useConflictStore } from '@/lib/conflict-store'
import {
  PanelRight, PanelRightClose, Download, Upload, Settings,
  Zap, AlertTriangle, History, RefreshCw, HelpCircle, ChevronDown, Menu, X,
} from 'lucide-react'

interface AppHeaderProps {
  isMobile: boolean
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  historyOpen: boolean
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>
  setSettingsOpen: (v: boolean) => void
  setHotkeySheetOpen: (v: boolean) => void
  setImportOpen: (v: boolean) => void
  togglePreviewPanel: () => void
  exportSync: {
    handleSyncToRaycast: () => void
    handleQuickExport: (autoImport: boolean) => void
    handleExport: () => void
    exportMenuOpen: boolean
    setExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
    exportMenuRef: React.RefObject<HTMLDivElement | null>
    exportSettings: { defaultPath: string | null; hasDirectoryHandle: boolean }
  }
}

export function AppHeader({
  isMobile, mobileSidebarOpen, setMobileSidebarOpen,
  historyOpen, setHistoryOpen,
  setSettingsOpen, setHotkeySheetOpen, setImportOpen,
  togglePreviewPanel, exportSync,
}: AppHeaderProps) {
  const previewVisible = useSnippetStore((s) => s.previewVisible)
  const { conflictCount, openConflictPanel } = useConflictStore(
    useShallow((s) => ({
      conflictCount: s.conflicts.length,
      openConflictPanel: s.openPanel,
    }))
  )

  return (
    <header className="border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isMobile && (
          <button
            data-testid="sidebar-toggle"
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label={mobileSidebarOpen ? 'Close sidebar' : 'Menu'}
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <h1 className="text-lg font-medium">Prompt Workbench</h1>
      </div>
      <div className="flex items-center gap-1">
        {conflictCount > 0 && (
          <button
            onClick={openConflictPanel}
            className="p-2 rounded hover:bg-accent transition-colors text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 relative"
            title={`${conflictCount} conflict${conflictCount > 1 ? 's' : ''} - click to review`}
            aria-label={`${conflictCount} conflict${conflictCount > 1 ? 's' : ''} - click to review`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-medium bg-amber-500 text-black rounded-full flex items-center justify-center">
              {conflictCount}
            </span>
          </button>
        )}
        <button
          onClick={exportSync.handleSyncToRaycast}
          className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Sync to Raycast - export & auto-import (⌘⇧S)"
          aria-label="Sync to Raycast"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Import from Raycast"
          aria-label="Import from Raycast"
        >
          <Upload className="w-5 h-5" />
        </button>
        <div className="relative" ref={exportSync.exportMenuRef}>
          <div className="flex items-center">
            <button
              onClick={() => exportSync.handleQuickExport(false)}
              className="p-2 rounded-l hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={`Export to ${exportSync.exportSettings.defaultPath || '~/.prompt-workbench'} (⌘⇧E)`}
              aria-label="Quick export"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => exportSync.setExportMenuOpen((v) => !v)}
              className="p-2 -ml-1 rounded-r hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="More export options"
              aria-label="More export options"
              aria-expanded={exportSync.exportMenuOpen}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          {exportSync.exportMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-accent border border-border rounded-lg shadow-xl z-50 py-1">
              <button
                onClick={() => { exportSync.handleQuickExport(false); exportSync.setExportMenuOpen(false) }}
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-muted-foreground" />
                Quick export
                <span className="ml-auto text-xs text-muted-foreground">⌘⇧E</span>
              </button>
              <button
                onClick={() => { exportSync.handleExport(); exportSync.setExportMenuOpen(false) }}
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                Export to file picker...
              </button>
            </div>
          )}
        </div>
        <button
          data-testid="history-toggle-btn"
          onClick={() => setHistoryOpen((v) => !v)}
          className={`p-2 rounded hover:bg-accent transition-colors ${historyOpen ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
          title="Version history"
          aria-label="Version history"
          aria-expanded={historyOpen}
        >
          <History className="w-5 h-5" />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Settings (⌘,)"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button
          onClick={() => setHotkeySheetOpen(true)}
          className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Keyboard shortcuts (⌘?)"
          aria-label="Keyboard shortcuts"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <ThemeToggle />
        {!isMobile && (
          <button
            onClick={togglePreviewPanel}
            onMouseEnter={previewVisible ? preloadEditor : preloadPreview}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={previewVisible ? 'Hide preview (⌘\\)' : 'Show preview (⌘\\)'}
            aria-label={previewVisible ? 'Hide preview' : 'Show preview'}
            aria-expanded={previewVisible}
          >
            {previewVisible ? (
              <PanelRightClose className="w-5 h-5" />
            ) : (
              <PanelRight className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </header>
  )
}
