'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { X, RefreshCw, Loader2, CheckCircle, XCircle, Search } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { useSyncSettingsStore, SYNC_INTERVALS, type SyncInterval } from '@/lib/sync-settings-store'
import { useAISettingsStore, DEFAULT_OLLAMA_URL } from '@/lib/ai-settings-store'
import { useIntervalSync } from '@/hooks/useIntervalSync'
import { SyncHistory } from '@/components/SyncHistory'
import { KeywordAuditModal } from '@/components/KeywordAuditModal'
import {
  useKeywordStyleStore,
  analyzeKeywordPatterns,
  type CasePreference,
} from '@/lib/keyword-style-store'
import {
  pickDefaultExportDirectory,
  clearDefaultExportPath,
  getStoredExportPath,
  hasValidExportHandle,
  supportsFileSystemAccess,
  getDefaultExportPath,
} from '@/lib/raycast/export'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

const CASE_OPTIONS: { value: CasePreference; label: string }[] = [
  { value: 'lowercase', label: 'lowercase' },
  { value: 'UPPERCASE', label: 'UPPERCASE' },
  { value: 'camelCase', label: 'camelCase' },
]

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle')
  const [inferring, setInferring] = useState(false)
  const [auditModalOpen, setAuditModalOpen] = useState(false)

  const exportSettings = useSnippetStore((s) => s.exportSettings)
  const setExportSettings = useSnippetStore((s) => s.setExportSettings)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)
  const setOllamaUrl = useAISettingsStore((s) => s.setOllamaUrl)
  const setOllamaModel = useAISettingsStore((s) => s.setOllamaModel)
  const loadAISettings = useAISettingsStore((s) => s.load)

  const keywordPrefix = useKeywordStyleStore((s) => s.prefix)
  const keywordMaxLength = useKeywordStyleStore((s) => s.maxLength)
  const keywordCase = useKeywordStyleStore((s) => s.casePreference)
  const setKeywordPrefix = useKeywordStyleStore((s) => s.setPrefix)
  const setKeywordMaxLength = useKeywordStyleStore((s) => s.setMaxLength)
  const setKeywordCase = useKeywordStyleStore((s) => s.setCasePreference)
  const setKeywordAll = useKeywordStyleStore((s) => s.setAll)
  const loadKeywordPrefs = useKeywordStyleStore((s) => s.load)
  const snippets = useSnippetStore((s) => s.snippets)

  const fileWatcherEnabled = useSyncSettingsStore((s) => s.fileWatcherEnabled)
  const setFileWatcherEnabled = useSyncSettingsStore((s) => s.setFileWatcherEnabled)

  const {
    enabled: intervalEnabled,
    interval: syncInterval,
    lastSyncTime,
    isSyncing,
    setEnabled: setIntervalEnabled,
    setInterval: setSyncInterval,
    triggerSync,
  } = useIntervalSync()

  const fetchOllamaModels = useCallback(async (url: string) => {
    setModelsLoading(true)
    try {
      const res = await fetch(`/api/ollama/models?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (data.models) {
        setOllamaModels(data.models)
      } else {
        setOllamaModels([])
      }
    } catch {
      setOllamaModels([])
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const testOllamaConnection = useCallback(async () => {
    setConnectionStatus('testing')
    try {
      const res = await fetch(`/api/ollama/test?url=${encodeURIComponent(ollamaUrl)}`)
      const data = await res.json()
      if (data.connected) {
        setConnectionStatus('connected')
        toast.success('Connected to Ollama')
        fetchOllamaModels(ollamaUrl)
      } else {
        setConnectionStatus('failed')
        toast.error(data.error || 'Connection failed')
      }
    } catch {
      setConnectionStatus('failed')
      toast.error('Connection failed')
    }
  }, [ollamaUrl, fetchOllamaModels])

  useEffect(() => {
    if (open) {
      const storedPath = getStoredExportPath()
      if (storedPath) {
        hasValidExportHandle().then((valid) => {
          setExportSettings({ defaultPath: storedPath, hasDirectoryHandle: valid })
        })
      } else if (!supportsFileSystemAccess()) {
        // For Firefox/Safari, show default server-side path
        setExportSettings({ defaultPath: getDefaultExportPath(), hasDirectoryHandle: true })
      }
      loadAISettings()
      loadKeywordPrefs()
    }
  }, [open, setExportSettings, loadAISettings, loadKeywordPrefs])

  useEffect(() => {
    if (open && ollamaUrl) {
      fetchOllamaModels(ollamaUrl)
    }
  }, [open, ollamaUrl, fetchOllamaModels])

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handlePickExportDir = async () => {
    if (!supportsFileSystemAccess()) {
      toast.info('Using default path: ~/.prompt-workbench')
      return
    }
    try {
      const name = await pickDefaultExportDirectory()
      if (name) {
        setExportSettings({ defaultPath: name, hasDirectoryHandle: true })
        toast.success(`Default export path set to ${name}`)
      }
    } catch (err) {
      console.error('Failed to pick export directory:', err)
      toast.error('Failed to set export directory')
    }
  }

  const handleClearExportDir = async () => {
    await clearDefaultExportPath()
    if (!supportsFileSystemAccess()) {
      // Reset to default for non-Chromium browsers
      setExportSettings({ defaultPath: getDefaultExportPath(), hasDirectoryHandle: true })
    } else {
      setExportSettings({ defaultPath: null, hasDirectoryHandle: false })
    }
    toast.success('Export path reset to default')
  }

  const handleInferKeywordStyle = () => {
    setInferring(true)
    try {
      const inferred = analyzeKeywordPatterns(snippets)
      setKeywordAll(inferred)
      toast.success('Keyword style inferred from existing snippets')
    } catch {
      toast.error('Could not infer keyword style')
    } finally {
      setInferring(false)
    }
  }

  if (!open) return null

  const canPickDirectory = supportsFileSystemAccess()
  const displayPath = exportSettings.defaultPath || getDefaultExportPath()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-muted border border-border rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Export settings */}
          <section>
            <h3 className="text-sm font-medium text-secondary-foreground mb-3">Default Export Path</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-accent rounded text-sm text-secondary-foreground truncate">
                {displayPath}
              </div>
              {canPickDirectory ? (
                <>
                  <button
                    onClick={handlePickExportDir}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                  >
                    Choose
                  </button>
                  {exportSettings.defaultPath && exportSettings.defaultPath !== getDefaultExportPath() && (
                    <button
                      onClick={handleClearExportDir}
                      className="px-3 py-2 bg-accent hover:bg-accent-foreground/10 rounded text-sm font-medium transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Fixed path (Firefox)</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Quick export (⌘⇧E) saves directly to this folder
            </p>
          </section>

          {/* Sync settings */}
          <section className="border-t border-border pt-6">
            <h3 className="text-sm font-medium text-secondary-foreground mb-4">Raycast Sync</h3>

            {/* File watcher toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm text-secondary-foreground">File Watcher</label>
                <p className="text-xs text-muted-foreground">Real-time sync on file changes</p>
              </div>
              <button
                onClick={() => setFileWatcherEnabled(!fileWatcherEnabled)}
                data-state={fileWatcherEnabled ? 'on' : 'off'}
                className="w-10 h-6 rounded-full transition-colors duration-150 data-[state=on]:bg-blue-600 data-[state=off]:bg-accent"
              >
                <div
                  className="w-4 h-4 bg-white rounded-full transition-transform duration-150 ease-out mx-1 data-[state=on]:translate-x-4 data-[state=off]:translate-x-0"
                  data-state={fileWatcherEnabled ? 'on' : 'off'}
                />
              </button>
            </div>

            {/* Interval sync toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm text-secondary-foreground">Interval Sync</label>
                <p className="text-xs text-muted-foreground">Scheduled backup sync</p>
              </div>
              <button
                onClick={() => setIntervalEnabled(!intervalEnabled)}
                data-state={intervalEnabled ? 'on' : 'off'}
                className="w-10 h-6 rounded-full transition-colors duration-150 data-[state=on]:bg-blue-600 data-[state=off]:bg-accent"
              >
                <div
                  className="w-4 h-4 bg-white rounded-full transition-transform duration-150 ease-out mx-1 data-[state=on]:translate-x-4 data-[state=off]:translate-x-0"
                  data-state={intervalEnabled ? 'on' : 'off'}
                />
              </button>
            </div>

            {/* Interval frequency */}
            {intervalEnabled && (
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm text-muted-foreground">Frequency</label>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value as SyncInterval)}
                  className="bg-accent border border-border rounded px-3 py-1.5 text-sm text-secondary-foreground"
                >
                  {SYNC_INTERVALS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Last sync + manual sync */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground">
                {lastSyncTime
                  ? `Last sync: ${new Date(lastSyncTime).toLocaleTimeString()}`
                  : 'Not synced yet'}
              </div>
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-foreground/10 disabled:opacity-50 rounded text-sm font-medium transition-colors"
              >
                {isSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </section>

          {/* AI Settings */}
          <section className="border-t border-border pt-6">
            <h3 className="text-sm font-medium text-secondary-foreground mb-4">AI Settings</h3>

            {/* Ollama URL */}
            <div className="mb-4">
              <label className="text-sm text-muted-foreground block mb-1.5">Ollama URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder={DEFAULT_OLLAMA_URL}
                  className="flex-1 bg-accent border border-border rounded px-3 py-2 text-sm text-secondary-foreground placeholder:text-muted-foreground"
                />
                <button
                  onClick={testOllamaConnection}
                  disabled={connectionStatus === 'testing'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-foreground/10 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                >
                  {connectionStatus === 'testing' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : connectionStatus === 'connected' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  ) : connectionStatus === 'failed' ? (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  ) : null}
                  Test
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Used for auto-generating snippet titles
              </p>
            </div>

            {/* Model selection */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Model</label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                disabled={modelsLoading || ollamaModels.length === 0}
                className="w-full bg-accent border border-border rounded px-3 py-2 text-sm text-secondary-foreground disabled:opacity-50"
              >
                {modelsLoading ? (
                  <option>Loading models...</option>
                ) : ollamaModels.length === 0 ? (
                  <option>No models available</option>
                ) : (
                  ollamaModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                )}
              </select>
            </div>
          </section>

          {/* Keyword Style Preferences */}
          <section className="border-t border-border pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-secondary-foreground">Keyword Style</h3>
              <button
                onClick={handleInferKeywordStyle}
                disabled={inferring || snippets.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-accent hover:bg-accent-foreground/10 disabled:opacity-50 rounded text-xs font-medium transition-colors"
              >
                {inferring ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Infer from existing
              </button>
            </div>

            {/* Prefix */}
            <div className="mb-4">
              <label className="text-sm text-muted-foreground block mb-1.5">Prefix</label>
              <input
                type="text"
                value={keywordPrefix}
                onChange={(e) => setKeywordPrefix(e.target.value)}
                placeholder="!, @, //, or leave empty"
                maxLength={3}
                className="w-full bg-accent border border-border rounded px-3 py-2 text-sm text-secondary-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Character(s) that start all keywords
              </p>
            </div>

            {/* Max Length */}
            <div className="mb-4">
              <label className="text-sm text-muted-foreground block mb-1.5">Max Length</label>
              <input
                type="number"
                value={keywordMaxLength}
                onChange={(e) => setKeywordMaxLength(parseInt(e.target.value) || 6)}
                min={2}
                max={12}
                className="w-24 bg-accent border border-border rounded px-3 py-2 text-sm text-secondary-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Max keyword length (2-12 chars)
              </p>
            </div>

            {/* Case Preference */}
            <div className="mb-4">
              <label className="text-sm text-muted-foreground block mb-1.5">Case Style</label>
              <select
                value={keywordCase}
                onChange={(e) => setKeywordCase(e.target.value as CasePreference)}
                className="w-full bg-accent border border-border rounded px-3 py-2 text-sm text-secondary-foreground"
              >
                {CASE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Audit Keywords */}
            <div className="pt-3 border-t border-border">
              <button
                onClick={() => setAuditModalOpen(true)}
                disabled={snippets.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-foreground/10 disabled:opacity-50 rounded text-sm font-medium transition-colors w-full justify-center"
              >
                <Search className="w-4 h-4" />
                Audit Keywords
              </button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Find missing or inconsistent keywords
              </p>
            </div>
          </section>

          {/* Sync History */}
          <section className="border-t border-border pt-6">
            <SyncHistory />
          </section>
        </div>
      </div>

      {/* Keyword Audit Modal */}
      <KeywordAuditModal open={auditModalOpen} onClose={() => setAuditModalOpen(false)} />
    </div>
  )
}
