'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { useFileWatcher, type FileChangeEvent } from '@/hooks/useFileWatcher'
import { useTitleInference } from '@/hooks/useTitleInference'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { EditorDynamic, preloadEditor } from '@/components/editor/EditorDynamic'
import { EditorPanelHeader } from '@/components/editor/EditorPanel'
import { PreviewDynamic, preloadPreview } from '@/components/preview/PreviewDynamic'
import { ResizableDivider } from '@/components/ResizableDivider'
import { Sidebar } from '@/components/Sidebar'
import { ValidationDialog } from '@/components/ValidationDialog'
import { ConflictPanel } from '@/components/ConflictPanel'
import { SearchPalette } from '@/components/SearchPalette'
import { VersionHistorySidebar } from '@/components/VersionHistorySidebar'
import { SettingsModal } from '@/components/SettingsModal'
import { ImportModal } from '@/components/ImportModal'
import { HotkeyCheatsheet } from '@/components/HotkeyCheatsheet'
import { loadPersistedState, updatePersistedField } from '@/lib/persistence'
import { useSnippetStore } from '@/lib/store'
import { useConflictStore } from '@/lib/conflict-store'
import { useSyncSettingsStore } from '@/lib/sync-settings-store'
import { useSyncHistoryStore } from '@/lib/sync-history-store'
import { useVersionStore } from '@/lib/version-store'
import { detectConflicts } from '@/lib/sync/conflict-detection'
import {
  exportSnippets,
  quickExportSnippets,
  hasValidExportHandle,
  getStoredExportPath,
  supportsFileSystemAccess,
  getDefaultExportPath,
} from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import { PanelRight, PanelRightClose, Download, Upload, Settings, Zap, AlertTriangle, History, Check, Loader2, RefreshCw, HelpCircle, ChevronDown } from 'lucide-react'
import type { Snippet } from '@/types'

const DEFAULT_LEFT_PERCENT = 60
const AUTOSAVE_DEBOUNCE_MS = 500

type SaveStatus = 'idle' | 'saving' | 'saved'

export default function HomePage() {
  const [content, setContent] = useState('')
  const [leftPercent, setLeftPercent] = useState(DEFAULT_LEFT_PERCENT)
  const [mounted, setMounted] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyboardHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {})
  const [, startTransition] = useTransition()

  // UI state - grouped to reduce re-renders
  const { previewVisible, togglePreview, setPreviewVisible, syncScroll } = useSnippetStore(
    useShallow((s) => ({
      previewVisible: s.previewVisible,
      togglePreview: s.togglePreview,
      setPreviewVisible: s.setPreviewVisible,
      syncScroll: s.syncScroll,
    }))
  )

  // Export state
  const { exportSettings, setExportSettings, markExported } = useSnippetStore(
    useShallow((s) => ({
      exportSettings: s.exportSettings,
      setExportSettings: s.setExportSettings,
      markExported: s.markExported,
    }))
  )

  // Snippet CRUD
  const { snippets, selectedId, getSelectedSnippet, createSnippet, updateSnippet, selectSnippet } = useSnippetStore(
    useShallow((s) => ({
      snippets: s.snippets,
      selectedId: s.selectedId,
      getSelectedSnippet: s.getSelectedSnippet,
      createSnippet: s.createSnippet,
      updateSnippet: s.updateSnippet,
      selectSnippet: s.selectSnippet,
    }))
  )

  const [searchOpen, setSearchOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [hotkeySheetOpen, setHotkeySheetOpen] = useState(false)

  // Conflict state
  const { addConflicts, conflictCount, openConflictPanel } = useConflictStore(
    useShallow((s) => ({
      addConflicts: s.addConflicts,
      conflictCount: s.conflicts.length,
      openConflictPanel: s.openPanel,
    }))
  )

  // Sync history
  const { addSyncEvent, loadSyncHistory } = useSyncHistoryStore(
    useShallow((s) => ({ addSyncEvent: s.addEvent, loadSyncHistory: s.load }))
  )

  // Version history
  const loadVersionHistory = useVersionStore((s) => s.load)

  // Sync settings
  const fileWatcherEnabled = useSyncSettingsStore((s) => s.fileWatcherEnabled)

  // AI settings
  const loadAISettings = useAISettingsStore((s) => s.load)

  // Title inference handler
  const handleTitleInferred = useCallback((title: string) => {
    if (selectedId) {
      updateSnippet(selectedId, { name: title })
    }
  }, [selectedId, updateSnippet])

  const { scheduleInference, cancelInference } = useTitleInference({
    onTitleInferred: handleTitleInferred,
  })

  // File watcher for Raycast sync
  const handleFileChanges = useCallback(async (events: FileChangeEvent[]) => {
    // Fetch file contents from server
    const paths = events.filter((e) => e.type !== 'unlink').map((e) => e.path)
    if (paths.length === 0) return

    try {
      const res = await fetch('/api/read-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      })
      if (!res.ok) return

      const { files } = await res.json()
      const fileContents = new Map<string, string>()
      for (const [path, content] of Object.entries(files)) {
        if (content) fileContents.set(path, content as string)
      }

      // Detect conflicts with current local snippets
      const conflicts = detectConflicts(events, fileContents, snippets)

      // Log file change event
      addSyncEvent('pull', 'file_change', events.length, {
        filePath: events[0]?.path,
      })

      if (conflicts.length > 0) {
        addConflicts(conflicts)

        // Log conflict detection
        addSyncEvent('conflict', 'conflict_detected', conflicts.length, {
          conflictCount: conflicts.length,
          snippetNames: conflicts.map((c) => c.remoteSnippet?.name || c.localSnippet?.name || 'Unknown').filter(Boolean),
        })

        toast.warning(`${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} detected`, {
          description: 'Raycast snippets differ from local',
          action: {
            label: 'Review',
            onClick: openConflictPanel,
          },
        })
      } else {
        toast(`${events.length} file${events.length > 1 ? 's' : ''} changed`, {
          description: 'No conflicts with local snippets',
          duration: 3000,
        })
      }
    } catch {
      toast.error('Failed to check for conflicts')
    }
  }, [snippets, addConflicts, openConflictPanel, addSyncEvent])

  useFileWatcher({ onChanges: handleFileChanges, enabled: fileWatcherEnabled })

  // Load from localStorage on mount - single consolidated read
  useEffect(() => {
    const state = loadPersistedState()
    setContent(state.content)
    setLeftPercent(state.dividerPercent)
    setPreviewVisible(state.previewVisible)

    // Load export settings
    const storedPath = getStoredExportPath()
    if (storedPath) {
      hasValidExportHandle().then((valid) => {
        setExportSettings({ defaultPath: storedPath, hasDirectoryHandle: valid })
      })
    } else if (!supportsFileSystemAccess()) {
      // For Firefox/Safari, use default server-side path
      setExportSettings({ defaultPath: getDefaultExportPath(), hasDirectoryHandle: true })
    }

    // Load sync history
    loadSyncHistory()

    // Load version history
    loadVersionHistory()

    // Load AI settings
    loadAISettings()

    setMounted(true)
  }, [setPreviewVisible, setExportSettings, loadSyncHistory, loadVersionHistory, loadAISettings])

  // Persist state to localStorage
  useEffect(() => {
    if (mounted) updatePersistedField('content', content)
  }, [content, mounted])

  useEffect(() => {
    if (mounted) updatePersistedField('dividerPercent', leftPercent)
  }, [leftPercent, mounted])

  useEffect(() => {
    if (mounted) updatePersistedField('previewVisible', previewVisible)
  }, [previewVisible, mounted])

  // Sync editor content with selected snippet
  useEffect(() => {
    const snippet = getSelectedSnippet()
    setContent(snippet?.text ?? '')
  }, [selectedId, getSelectedSnippet])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current)
      cancelInference()
    }
  }, [cancelInference])

  const handleResize = useCallback((percent: number) => {
    setLeftPercent(percent)
  }, [])

  const handleEditorScroll = useCallback((progress: number) => {
    if (syncScroll) {
      startTransition(() => {
        setScrollProgress(progress)
      })
    }
  }, [syncScroll])

  // Auto-save handler with debounce
  const handleContentChange = useCallback((value: string) => {
    setContent(value)

    // Clear existing timers
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current)

    // Show saving indicator
    setSaveStatus('saving')

    // Debounced save
    saveTimerRef.current = setTimeout(() => {
      if (selectedId) {
        // Update existing snippet
        updateSnippet(selectedId, { text: value })

        // Schedule title inference for untitled snippets
        const snippet = getSelectedSnippet()
        if (snippet?.name === 'Untitled') {
          scheduleInference('Untitled', value)
        }
      } else if (value.trim()) {
        // Create new snippet when typing in empty editor
        createSnippet({ name: 'Untitled', text: value })
        // New snippet gets selected, will infer on next edit
      }

      // Show saved indicator briefly
      setSaveStatus('saved')
      savedIndicatorTimerRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, 1500)
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [selectedId, updateSnippet, createSnippet, getSelectedSnippet, scheduleInference])

  const doExport = useCallback(async (toExport: Snippet[], quick = false, autoImportToRaycast = false) => {
    try {
      let path: string
      let autoImportTriggered = false

      if (quick) {
        const result = await quickExportSnippets(toExport, { autoImportToRaycast })
        path = result.path
        autoImportTriggered = result.autoImportTriggered ?? false
      } else {
        path = await exportSnippets(toExport)
      }

      markExported(toExport.map((s) => s.id))

      // Log export to history
      addSyncEvent('push', 'export', toExport.length, {
        snippetNames: toExport.map((s) => s.name),
        filePath: path,
      })

      if (autoImportTriggered) {
        toast.success(`Exported & importing to Raycast`, {
          description: `${toExport.length} snippet${toExport.length > 1 ? 's' : ''} → ${path}`,
        })
      } else {
        toast.success(`Exported ${toExport.length} snippet${toExport.length > 1 ? 's' : ''} to ${path}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (err instanceof Error && err.message === 'No default export path set') {
        toast.error('Set a default export path first')
        return
      }
      toast.error('Export failed')
    }
  }, [markExported, addSyncEvent])

  const handleExport = useCallback(() => {
    // Use store snippets if available, otherwise create one from current editor content
    const toExport = snippets.length > 0
      ? snippets
      : [{ id: '1', name: 'Untitled', text: content, tags: [], createdAt: Date.now(), updatedAt: Date.now(), version: 1 }]

    if (toExport.length === 0 || (toExport.length === 1 && !toExport[0].text.trim())) {
      toast.error('Nothing to export')
      return
    }

    // Validate before export
    const result = validateSnippets(toExport)
    if (result.issues.length > 0) {
      setValidationResult(result)
      setPendingExport(toExport)
      return
    }

    // No issues, export directly
    doExport(toExport)
  }, [snippets, content, doExport])

  const handleQuickExport = useCallback((autoImportToRaycast = false) => {
    const toExport = snippets.length > 0
      ? snippets
      : [{ id: '1', name: 'Untitled', text: content, tags: [], createdAt: Date.now(), updatedAt: Date.now(), version: 1 }]

    if (toExport.length === 0 || (toExport.length === 1 && !toExport[0].text.trim())) {
      toast.error('Nothing to export')
      return
    }

    const result = validateSnippets(toExport)
    if (result.issues.length > 0) {
      setValidationResult(result)
      setPendingExport(toExport)
      return
    }

    doExport(toExport, true, autoImportToRaycast)
  }, [snippets, content, doExport])

  // Export and auto-import to Raycast
  const handleSyncToRaycast = useCallback(() => {
    handleQuickExport(true)
  }, [handleQuickExport])

  const handleValidationClose = useCallback(() => {
    setValidationResult(null)
    setPendingExport(null)
  }, [])

  const handleValidationProceed = useCallback(() => {
    if (pendingExport) {
      doExport(pendingExport)
    }
    setValidationResult(null)
    setPendingExport(null)
  }, [pendingExport, doExport])

  const handleNavigateToSnippet = useCallback((snippetId: string) => {
    selectSnippet(snippetId)
  }, [selectSnippet])

  // Keep keyboard handler ref updated without rebinding listener
  keyboardHandlerRef.current = (e: KeyboardEvent) => {
    // Cmd+P for search palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault()
      setSearchOpen(true)
    }
    // Cmd+\ to toggle preview
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault()
      togglePreview()
    }
    // Cmd+Shift+E for quick export
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      handleQuickExport(false)
    }
    // Cmd+Shift+S for sync to Raycast (export + auto-import)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      handleSyncToRaycast()
    }
    // Cmd+, for settings modal
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault()
      setSettingsOpen(true)
    }
    // Cmd+? or Cmd+/ for hotkey cheatsheet
    if ((e.metaKey || e.ctrlKey) && (e.key === '?' || e.key === '/')) {
      e.preventDefault()
      setHotkeySheetOpen(true)
    }
  }

  // Bind keyboard listener once on mount
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyboardHandlerRef.current(e)
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportMenuOpen])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-medium">Prompt Workbench</h1>
          <div className="flex items-center gap-1">
            {conflictCount > 0 && (
              <button
                onClick={openConflictPanel}
                className="p-2 rounded hover:bg-zinc-800 transition-colors text-amber-400 hover:text-amber-300 relative"
                title={`${conflictCount} conflict${conflictCount > 1 ? 's' : ''} - click to review`}
              >
                <AlertTriangle className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-medium bg-amber-500 text-black rounded-full flex items-center justify-center">
                  {conflictCount}
                </span>
              </button>
            )}
            <button
              onClick={handleSyncToRaycast}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Sync to Raycast - export & auto-import (⌘⇧S)"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Import from Raycast"
            >
              <Upload className="w-5 h-5" />
            </button>
            <div className="relative" ref={exportMenuRef}>
              <div className="flex items-center">
                <button
                  onClick={() => handleQuickExport(false)}
                  className="p-2 rounded-l hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
                  title={`Export to ${exportSettings.defaultPath || '~/.prompt-workbench'} (⌘⇧E)`}
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  className="p-2 -ml-1 rounded-r hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
                  title="More export options"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={() => { handleQuickExport(false); setExportMenuOpen(false) }}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 text-zinc-400" />
                    Quick export
                    <span className="ml-auto text-xs text-zinc-500">⌘⇧E</span>
                  </button>
                  <button
                    onClick={() => { handleExport(); setExportMenuOpen(false) }}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4 text-zinc-400" />
                    Export to file picker...
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className={`p-2 rounded hover:bg-zinc-800 transition-colors ${historyOpen ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Version history"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Settings (⌘,)"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setHotkeySheetOpen(true)}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Keyboard shortcuts (⌘?)"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={togglePreview}
              onMouseEnter={previewVisible ? preloadEditor : preloadPreview}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title={previewVisible ? 'Hide preview (⌘\\)' : 'Show preview (⌘\\)'}
            >
              {previewVisible ? (
                <PanelRightClose className="w-5 h-5" />
              ) : (
                <PanelRight className="w-5 h-5" />
              )}
            </button>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <div
            style={{ width: previewVisible ? `${leftPercent}%` : '100%' }}
            className="flex-1 flex flex-col overflow-hidden transition-[width] duration-200 ease-out"
          >
            <div className="flex items-center border-b border-zinc-800">
              <EditorPanelHeader />
              <div className="ml-auto px-4 py-2 flex items-center gap-2 text-xs text-zinc-500">
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span className="text-green-500">Saved</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <EditorDynamic value={content} onChange={handleContentChange} onScrollProgress={handleEditorScroll} />
            </div>
          </div>
          {previewVisible && (
            <>
              <ResizableDivider onResize={handleResize} minLeftPx={200} minRightPx={200} />
              <div
                style={{ width: `${100 - leftPercent}%` }}
                className="overflow-auto transition-[width] duration-200 ease-out"
              >
                <PreviewDynamic content={content} scrollProgress={syncScroll ? scrollProgress : undefined} />
              </div>
            </>
          )}
          <VersionHistorySidebar open={historyOpen} onOpenChange={setHistoryOpen} />
        </div>
      </div>

      <ConflictPanel />

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />

      {validationResult && (
        <ValidationDialog
          result={validationResult}
          open={!!validationResult}
          onClose={handleValidationClose}
          onProceed={handleValidationProceed}
          onNavigateToSnippet={handleNavigateToSnippet}
        />
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <HotkeyCheatsheet open={hotkeySheetOpen} onClose={() => setHotkeySheetOpen(false)} />
    </main>
  )
}
