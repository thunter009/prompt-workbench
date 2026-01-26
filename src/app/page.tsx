'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Editor } from '@/components/editor/Editor'
import { Preview } from '@/components/preview/Preview'
import { ResizableDivider } from '@/components/ResizableDivider'
import { Sidebar } from '@/components/Sidebar'
import { ValidationDialog } from '@/components/ValidationDialog'
import { useSnippetStore } from '@/lib/store'
import {
  exportSnippets,
  quickExportSnippets,
  hasValidExportHandle,
  getStoredExportPath,
  pickDefaultExportDirectory,
  clearDefaultExportPath
} from '@/lib/raycast/export'
import { validateSnippets, type ValidationResult } from '@/lib/raycast/validation'
import { PanelRight, PanelRightClose, Download, Settings, Zap } from 'lucide-react'
import type { Snippet } from '@/types'

const STORAGE_KEY = 'prompt-workbench-content'
const DIVIDER_KEY = 'prompt-workbench-divider'
const PREVIEW_VISIBLE_KEY = 'prompt-workbench-preview-visible'
const DEFAULT_LEFT_PERCENT = 60

export default function HomePage() {
  const [content, setContent] = useState('')
  const [leftPercent, setLeftPercent] = useState(DEFAULT_LEFT_PERCENT)
  const [mounted, setMounted] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExport, setPendingExport] = useState<Snippet[] | null>(null)

  const previewVisible = useSnippetStore((s) => s.previewVisible)
  const togglePreview = useSnippetStore((s) => s.togglePreview)
  const setPreviewVisible = useSnippetStore((s) => s.setPreviewVisible)
  const exportSettings = useSnippetStore((s) => s.exportSettings)
  const setExportSettings = useSnippetStore((s) => s.setExportSettings)
  const markExported = useSnippetStore((s) => s.markExported)

  const [settingsOpen, setSettingsOpen] = useState(false)

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

    setMounted(true)
  }, [setPreviewVisible, setExportSettings])

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

  const handleResize = useCallback((percent: number) => {
    setLeftPercent(percent)
  }, [])

  const snippets = useSnippetStore((s) => s.snippets)
  const selectSnippet = useSnippetStore((s) => s.selectSnippet)

  const doExport = useCallback(async (toExport: Snippet[], quick = false) => {
    try {
      const filename = quick
        ? await quickExportSnippets(toExport)
        : await exportSnippets(toExport)
      markExported(toExport.map((s) => s.id))
      toast.success(`Exported ${toExport.length} snippet${toExport.length > 1 ? 's' : ''} to ${filename}`)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (err instanceof Error && err.message === 'No default export path set') {
        toast.error('Set a default export path first')
        return
      }
      toast.error('Export failed')
    }
  }, [markExported])

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

  const handlePickExportDir = useCallback(async () => {
    const name = await pickDefaultExportDirectory()
    if (name) {
      setExportSettings({ defaultPath: name, hasDirectoryHandle: true })
      toast.success(`Default export path set to ${name}`)
    }
  }, [setExportSettings])

  const handleClearExportDir = useCallback(async () => {
    await clearDefaultExportPath()
    setExportSettings({ defaultPath: null, hasDirectoryHandle: false })
    toast.success('Default export path cleared')
  }, [setExportSettings])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      // Cmd+, for settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen((v) => !v)
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
              onClick={() => setSettingsOpen((v) => !v)}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
              title="Settings (⌘,)"
            >
              <Settings className="w-5 h-5" />
            </button>
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
            className="flex-1 overflow-auto transition-[width] duration-200 ease-out"
          >
            <Editor initialValue={content} onChange={setContent} />
          </div>
          {previewVisible && (
            <>
              <ResizableDivider onResize={handleResize} minLeftPx={200} minRightPx={200} />
              <div
                style={{ width: `${100 - leftPercent}%` }}
                className="overflow-auto transition-[width] duration-200 ease-out"
              >
                <Preview content={content} />
              </div>
            </>
          )}
        </div>
      </div>

      {validationResult && (
        <ValidationDialog
          result={validationResult}
          open={!!validationResult}
          onClose={handleValidationClose}
          onProceed={handleValidationProceed}
          onNavigateToSnippet={handleNavigateToSnippet}
        />
      )}

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSettingsOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Default Export Path</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-zinc-800 rounded text-sm text-zinc-300 truncate">
                    {exportSettings.defaultPath || 'Not set'}
                  </div>
                  <button
                    onClick={handlePickExportDir}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                  >
                    Choose
                  </button>
                  {exportSettings.defaultPath && (
                    <button
                      onClick={handleClearExportDir}
                      className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Quick export (⌘⇧E) saves directly to this folder
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
