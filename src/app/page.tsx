'use client'

import { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'
import { useFileWatcher, type FileChangeEvent } from '@/hooks/useFileWatcher'
import { useTitleInference } from '@/hooks/useTitleInference'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { usePlaygroundStore } from '@/lib/playground-store'
import { cn } from '@/lib/utils'
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel'
import { EditorDynamic, preloadEditor } from '@/components/editor/EditorDynamic'
import { EditorPanelHeader } from '@/components/editor/EditorPanel'
import { PreviewDynamic, preloadPreview } from '@/components/preview/PreviewDynamic'
import { Sidebar } from '@/components/Sidebar'
import { SidebarRail } from '@/components/SidebarRail'
import { ValidationDialog } from '@/components/ValidationDialog'
import { ConflictPanel } from '@/components/ConflictPanel'
import { SearchPalette } from '@/components/SearchPalette'
import { VersionHistorySidebar } from '@/components/VersionHistorySidebar'
import { SettingsModal } from '@/components/SettingsModal'
import { ImportModal } from '@/components/ImportModal'
import { HotkeyCheatsheet } from '@/components/HotkeyCheatsheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { loadPersistedState, updatePersistedField } from '@/lib/persistence'
import { useSnippetStore } from '@/lib/store'
import { useUndoStore } from '@/lib/undo-store'
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
import { useImprovePrompt, ImprovePromptButton, ImprovePromptReview } from '@/components/ImprovePrompt'
import { PanelRight, PanelRightClose, Download, Upload, Settings, Zap, AlertTriangle, History, Check, Loader2, RefreshCw, HelpCircle, ChevronDown, Menu, X } from 'lucide-react'
import type { Snippet } from '@/types'

const AUTOSAVE_DEBOUNCE_MS = 500

type SaveStatus = 'idle' | 'saving' | 'saved'

export default function HomePage() {
  const [content, setContent] = useState('')
  const [mounted, setMounted] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyboardHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {})
  const sidebarPanelRef = usePanelRef()
  const previewPanelRef = usePanelRef()
  const [, startTransition] = useTransition()

  // UI state - grouped to reduce re-renders
  const { previewVisible, setPreviewVisible, syncScroll } = useSnippetStore(
    useShallow((s) => ({
      previewVisible: s.previewVisible,
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
  const {
    snippets, selectedId, selectedIds, getSelectedSnippet,
    createSnippet, updateSnippet, selectSnippet,
    deleteSnippets, duplicateSnippet, folders, createFolder,
    selectAllSnippets, clearSelection,
  } = useSnippetStore(
    useShallow((s) => ({
      snippets: s.snippets,
      selectedId: s.selectedId,
      selectedIds: s.selectedIds,
      getSelectedSnippet: s.getSelectedSnippet,
      createSnippet: s.createSnippet,
      updateSnippet: s.updateSnippet,
      selectSnippet: s.selectSnippet,
      deleteSnippets: s.deleteSnippets,
      duplicateSnippet: s.duplicateSnippet,
      folders: s.folders,
      createFolder: s.createFolder,
      selectAllSnippets: s.selectAllSnippets,
      clearSelection: s.clearSelection,
    }))
  )

  // Undo
  const pushUndoAction = useUndoStore((s) => s.pushAction)
  const undo = useUndoStore((s) => s.undo)

  const [searchOpen, setSearchOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [hotkeySheetOpen, setHotkeySheetOpen] = useState(false)
  const [deleteDialogIds, setDeleteDialogIds] = useState<string[]>([])
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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

  // Playground
  const loadPlayground = usePlaygroundStore((s) => s.load)
  const activeTab = usePlaygroundStore((s) => s.activeTab)
  const playgroundRun = usePlaygroundStore((s) => s.run)
  const playgroundSetActiveTab = usePlaygroundStore((s) => s.setActiveTab)

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

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch('/api/read-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
        signal: controller.signal,
      })
      if (!res.ok) {
        toast.error(`Failed to read sync files: ${res.status} ${res.statusText}`)
        return
      }

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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('File sync timed out. Is Ollama running?')
      } else {
        toast.error(`Failed to check for conflicts: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    } finally {
      clearTimeout(timeout)
    }
  }, [snippets, addConflicts, openConflictPanel, addSyncEvent])

  useFileWatcher({ onChanges: handleFileChanges, enabled: fileWatcherEnabled })

  // Load from localStorage on mount - single consolidated read
  useEffect(() => {
    const state = loadPersistedState()
    setContent(state.content)
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

    // Load playground tab
    loadPlayground()

    setMounted(true)
  }, [setPreviewVisible, setExportSettings, loadSyncHistory, loadVersionHistory, loadAISettings, loadPlayground])

  // Persist state to localStorage
  useEffect(() => {
    if (mounted) updatePersistedField('content', content)
  }, [content, mounted])

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

  // Auto-expand preview panel when switching to Playground tab while collapsed
  useEffect(() => {
    if (!mounted) return
    const panel = previewPanelRef.current
    if (activeTab === 'playground' && panel?.isCollapsed()) {
      panel.expand()
    }
  }, [activeTab, mounted, previewPanelRef])

  // Manage delete snippet dialog
  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (deleteDialogIds.length > 0) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [deleteDialogIds])

  const handleDeleteConfirm = useCallback(() => {
    if (deleteDialogIds.length === 0) return
    const deleted = deleteSnippets(deleteDialogIds)
    if (deleted.length > 0) {
      pushUndoAction({ type: 'snippetDelete', deletedSnippets: deleted })
      toast.success(`Deleted ${deleted.length} snippet${deleted.length > 1 ? 's' : ''}`, {
        duration: 5000,
        action: { label: 'Undo', onClick: () => undo() },
      })
    }
    setDeleteDialogIds([])
  }, [deleteDialogIds, deleteSnippets, pushUndoAction, undo])

  const handleAcceptImproved = useCallback((improved: string) => {
    setContent(improved)
    if (selectedId) {
      updateSnippet(selectedId, { text: improved })
    }
  }, [selectedId, updateSnippet])

  const improve = useImprovePrompt(content, handleAcceptImproved)

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
      }, 3000)
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
    // Cmd+\ to toggle preview panel
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault()
      const panel = previewPanelRef.current
      if (panel) {
        if (panel.isCollapsed()) {
          panel.expand()
        } else {
          panel.collapse()
        }
      }
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
    // Cmd+Shift+R for run/re-run in playground
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
        })
      }
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

    // Snippet CRUD shortcuts — skip when typing in inputs or editor
    const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    const inEditor = (e.target as HTMLElement)?.closest?.('.cm-editor')
    if (inInput || inEditor) return

    // Cmd+N: new snippet
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
      e.preventDefault()
      createSnippet({ name: 'New Snippet', text: '' })
    }
    // Cmd+Shift+N: new folder
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      const maxOrder = folders.reduce((max, f) => (!f.parentId ? Math.max(max, f.orderIndex) : max), -1)
      createFolder({ name: 'New Folder', orderIndex: maxOrder + 1 })
    }
    // Delete/Backspace: delete selected snippet(s) with confirmation
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
      if (selectedIds.size > 0) {
        e.preventDefault()
        setDeleteDialogIds(Array.from(selectedIds))
      }
    }
    // Cmd+D: duplicate selected snippet
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      const id = selectedIds.size > 0 ? Array.from(selectedIds)[0] : selectedId
      if (id) {
        e.preventDefault()
        const copy = duplicateSnippet(id)
        if (copy) toast.success(`Duplicated "${copy.name}"`)
      }
    }
    // Cmd+A: select all visible snippets
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') { // select all
      e.preventDefault()
      selectAllSnippets()
    }
    // Escape: clear selection
    if (e.key === 'Escape') {
      if (selectedIds.size > 0) {
        e.preventDefault()
        clearSelection()
      }
    }
  }

  // Track viewport width for responsive layout
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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

  // Persist panel layout across reloads (SSR-safe storage)
  const ssrSafeStorage = useMemo(() => ({
    getItem: (key: string) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
    setItem: (key: string, value: string) => { if (typeof window !== 'undefined') localStorage.setItem(key, value) },
  }), [])
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'prompt-workbench-layout',
    storage: ssrSafeStorage,
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
                className="p-2 rounded hover:bg-accent transition-colors text-amber-400 hover:text-amber-300 relative"
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
              onClick={handleSyncToRaycast}
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
            <div className="relative" ref={exportMenuRef}>
              <div className="flex items-center">
                <button
                  onClick={() => handleQuickExport(false)}
                  className="p-2 rounded-l hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  title={`Export to ${exportSettings.defaultPath || '~/.prompt-workbench'} (⌘⇧E)`}
                  aria-label="Quick export"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  className="p-2 -ml-1 rounded-r hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  title="More export options"
                  aria-label="More export options"
                  aria-expanded={exportMenuOpen}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-accent border border-border rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={() => { handleQuickExport(false); setExportMenuOpen(false) }}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    Quick export
                    <span className="ml-auto text-xs text-muted-foreground">⌘⇧E</span>
                  </button>
                  <button
                    onClick={() => { handleExport(); setExportMenuOpen(false) }}
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
              className={`p-2 rounded hover:bg-accent transition-colors ${historyOpen ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
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
                    <div className="flex items-center border-b border-border">
                      <EditorPanelHeader />
                      <div className="ml-auto px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <ImprovePromptButton disabled={improve.disabled} loading={improve.status === 'loading'} onImprove={improve.handleImprove} />
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
                    <div className="flex-1 overflow-auto relative">
                      <EditorDynamic value={content} onChange={handleContentChange} onScrollProgress={handleEditorScroll} />
                      <ImprovePromptReview status={improve.status} improved={improve.improved} error={improve.error} onAccept={improve.accept} onReject={improve.reject} />
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
                    </div>
                    {activeTab === 'preview' ? (
                      <div className="flex-1 overflow-auto">
                        <PreviewDynamic content={content} scrollProgress={syncScroll ? scrollProgress : undefined} />
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
              <div className="flex items-center border-b border-border">
                <EditorPanelHeader />
                <div className="ml-auto px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <ImprovePromptButton disabled={improve.disabled} loading={improve.status === 'loading'} onImprove={improve.handleImprove} />
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
              <div className="flex-1 overflow-auto relative">
                <EditorDynamic value={content} onChange={handleContentChange} onScrollProgress={handleEditorScroll} />
                <ImprovePromptReview status={improve.status} improved={improve.improved} error={improve.error} onAccept={improve.accept} onReject={improve.reject} />
              </div>
            </div>
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

      {/* Delete Snippet Confirmation (keyboard shortcut) */}
      {deleteDialogIds.length > 0 && (
        <dialog
          ref={deleteDialogRef}
          onClick={(e) => { if (e.target === deleteDialogRef.current) setDeleteDialogIds([]) }}
          className="backdrop:bg-black/50 bg-transparent p-0 max-w-sm w-full"
        >
          <div className="bg-muted border border-border rounded-lg shadow-xl p-4 mx-4">
            <h3 className="text-lg font-medium text-foreground mb-2">
              Delete {deleteDialogIds.length === 1 ? 'Snippet' : `${deleteDialogIds.length} Snippets`}?
            </h3>
            <div className="text-sm text-muted-foreground mb-4">
              {deleteDialogIds.length === 1
                ? <p>&ldquo;{snippets.find((s) => s.id === deleteDialogIds[0])?.name}&rdquo; will be permanently deleted.</p>
                : (
                  <>
                    <p className="mb-2">{deleteDialogIds.length} snippets will be permanently deleted:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {deleteDialogIds.slice(0, 5).map((id) => (
                        <li key={id} className="truncate">{snippets.find((s) => s.id === id)?.name}</li>
                      ))}
                      {deleteDialogIds.length > 5 && (
                        <li className="text-muted-foreground/70">+ {deleteDialogIds.length - 5} more</li>
                      )}
                    </ul>
                  </>
                )}
              <p className="mt-2">You can undo this with &#x2318;Z.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteDialogIds([])}
                data-testid="kbd-delete-cancel"
                className="px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
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
