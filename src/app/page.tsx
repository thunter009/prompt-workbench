'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useFileWatcher, type FileChangeEvent } from '@/hooks/useFileWatcher'
import { useTitleInference } from '@/hooks/useTitleInference'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { Editor } from '@/components/editor/Editor'
import { EditorPanelHeader } from '@/components/editor/EditorPanel'
import { Preview } from '@/components/preview/Preview'
import { ResizableDivider } from '@/components/ResizableDivider'
import { Sidebar } from '@/components/Sidebar'
import { ValidationDialog } from '@/components/ValidationDialog'
import { ConflictPanel } from '@/components/ConflictPanel'
import { SearchPalette } from '@/components/SearchPalette'
import { VersionHistorySidebar } from '@/components/VersionHistorySidebar'
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
} from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import Link from 'next/link'
import { PanelRight, PanelRightClose, Download, Settings, Zap, AlertTriangle, History, Check, Loader2 } from 'lucide-react'
import type { Snippet } from '@/types'

const STORAGE_KEY = 'prompt-workbench-content'
const DIVIDER_KEY = 'prompt-workbench-divider'
const PREVIEW_VISIBLE_KEY = 'prompt-workbench-preview-visible'
const DEFAULT_LEFT_PERCENT = 60
const AUTOSAVE_DEBOUNCE_MS = 500

type SaveStatus = 'idle' | 'saving' | 'saved'

export default function HomePage() {
  const [content, setContent] = useState('')
  const [leftPercent, setLeftPercent] = useState(DEFAULT_LEFT_PERCENT)
  const [mounted, setMounted] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewVisible = useSnippetStore((s) => s.previewVisible)
  const togglePreview = useSnippetStore((s) => s.togglePreview)
  const setPreviewVisible = useSnippetStore((s) => s.setPreviewVisible)
  const syncScroll = useSnippetStore((s) => s.syncScroll)
  const exportSettings = useSnippetStore((s) => s.exportSettings)
  const setExportSettings = useSnippetStore((s) => s.setExportSettings)
  const markExported = useSnippetStore((s) => s.markExported)

  const [searchOpen, setSearchOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const addConflicts = useConflictStore((s) => s.addConflicts)
  const conflictCount = useConflictStore((s) => s.conflicts.length)
  const openConflictPanel = useConflictStore((s) => s.openPanel)

  const snippets = useSnippetStore((s) => s.snippets)
  const selectedId = useSnippetStore((s) => s.selectedId)
  const getSelectedSnippet = useSnippetStore((s) => s.getSelectedSnippet)
  const createSnippet = useSnippetStore((s) => s.createSnippet)
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const selectSnippet = useSnippetStore((s) => s.selectSnippet)

  // Sync history
  const addSyncEvent = useSyncHistoryStore((s) => s.addEvent)
  const loadSyncHistory = useSyncHistoryStore((s) => s.load)

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

  // Load from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem(STORAGE_KEY)
    if (savedContent) setContent(savedContent)

    const savedDivider = localStorage.getItem(DIVIDER_KEY)
    if (savedDivider) {
      const parsed = parseFloat(savedDivider)
      if (!isNaN(parsed)) setLeftPercent(parsed)
    }

    const savedPreviewVisible = localStorage.getItem(PREVIEW_VISIBLE_KEY)
    if (savedPreviewVisible !== null) {
      setPreviewVisible(savedPreviewVisible === 'true')
    }

    // Load export settings
    const storedPath = getStoredExportPath()
    if (storedPath) {
      hasValidExportHandle().then((valid) => {
        setExportSettings({ defaultPath: storedPath, hasDirectoryHandle: valid })
      })
    }

    // Load sync history
    loadSyncHistory()

    // Load version history
    loadVersionHistory()

    // Load AI settings
    loadAISettings()

    setMounted(true)
  }, [setPreviewVisible, setExportSettings, loadSyncHistory, loadVersionHistory, loadAISettings])

  // Persist content to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, content)
    }
  }, [content, mounted])

  // Persist divider position to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(DIVIDER_KEY, String(leftPercent))
    }
  }, [leftPercent, mounted])

  // Persist preview visibility to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(PREVIEW_VISIBLE_KEY, String(previewVisible))
    }
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
      setScrollProgress(progress)
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

  const doExport = useCallback(async (toExport: Snippet[], quick = false) => {
    try {
      const filename = quick
        ? await quickExportSnippets(toExport)
        : await exportSnippets(toExport)
      markExported(toExport.map((s) => s.id))

      // Log export to history
      addSyncEvent('push', 'export', toExport.length, {
        snippetNames: toExport.map((s) => s.name),
        filePath: filename,
      })

      toast.success(`Exported ${toExport.length} snippet${toExport.length > 1 ? 's' : ''} to ${filename}`)
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

  const handleQuickExport = useCallback(() => {
    if (!exportSettings.hasDirectoryHandle) {
      toast.error('Set a default export path first (⌘,)')
      return
    }

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

    doExport(toExport, true)
  }, [snippets, content, exportSettings.hasDirectoryHandle, doExport])

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        handleQuickExport()
      }
      // Cmd+, for settings - navigate to settings page
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        window.location.href = '/settings'
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [togglePreview, handleQuickExport])

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
            {exportSettings.hasDirectoryHandle && (
              <button
                onClick={handleQuickExport}
                className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
                title={`Quick export to ${exportSettings.defaultPath} (⌘⇧E)`}
              >
                <Zap className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleExport}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Export to Raycast"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className={`p-2 rounded hover:bg-zinc-800 transition-colors ${historyOpen ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Version history"
            >
              <History className="w-5 h-5" />
            </button>
            <Link
              href="/settings"
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Settings (⌘,)"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={togglePreview}
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
              <Editor value={content} onChange={handleContentChange} onScrollProgress={handleEditorScroll} />
            </div>
          </div>
          {previewVisible && (
            <>
              <ResizableDivider onResize={handleResize} minLeftPx={200} minRightPx={200} />
              <div
                style={{ width: `${100 - leftPercent}%` }}
                className="overflow-auto transition-[width] duration-200 ease-out"
              >
                <Preview content={content} scrollProgress={syncScroll ? scrollProgress : undefined} />
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
    </main>
  )
}
