'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { X, RefreshCw, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { useSyncSettingsStore, SYNC_INTERVALS, type SyncInterval } from '@/lib/sync-settings-store'
import { useAISettingsStore, DEFAULT_OLLAMA_URL } from '@/lib/ai-settings-store'
import { useIntervalSync } from '@/hooks/useIntervalSync'
import { SyncHistory } from '@/components/SyncHistory'
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

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle')

  const exportSettings = useSnippetStore((s) => s.exportSettings)
  const setExportSettings = useSnippetStore((s) => s.setExportSettings)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)
  const setOllamaUrl = useAISettingsStore((s) => s.setOllamaUrl)
  const setOllamaModel = useAISettingsStore((s) => s.setOllamaModel)
  const loadAISettings = useAISettingsStore((s) => s.load)

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
    }
  }, [open, setExportSettings, loadAISettings])

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

  if (!open) return null

  const canPickDirectory = supportsFileSystemAccess()
  const displayPath = exportSettings.defaultPath || getDefaultExportPath()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-medium">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Export settings */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Default Export Path</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-zinc-800 rounded text-sm text-zinc-300 truncate">
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
                      className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-zinc-500">Fixed path (Firefox)</span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Quick export (⌘⇧E) saves directly to this folder
            </p>
          </section>

          {/* Sync settings */}
          <section className="border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Raycast Sync</h3>

            {/* File watcher toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm text-zinc-300">File Watcher</label>
                <p className="text-xs text-zinc-500">Real-time sync on file changes</p>
              </div>
              <button
                onClick={() => setFileWatcherEnabled(!fileWatcherEnabled)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  fileWatcherEnabled ? 'bg-blue-600' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
                    fileWatcherEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Interval sync toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm text-zinc-300">Interval Sync</label>
                <p className="text-xs text-zinc-500">Scheduled backup sync</p>
              </div>
              <button
                onClick={() => setIntervalEnabled(!intervalEnabled)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  intervalEnabled ? 'bg-blue-600' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
                    intervalEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Interval frequency */}
            {intervalEnabled && (
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm text-zinc-400">Frequency</label>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value as SyncInterval)}
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300"
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
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <div className="text-xs text-zinc-500">
                {lastSyncTime
                  ? `Last sync: ${new Date(lastSyncTime).toLocaleTimeString()}`
                  : 'Not synced yet'}
              </div>
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded text-sm font-medium transition-colors"
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
          <section className="border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">AI Settings</h3>

            {/* Ollama URL */}
            <div className="mb-4">
              <label className="text-sm text-zinc-400 block mb-1.5">Ollama URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder={DEFAULT_OLLAMA_URL}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-500"
                />
                <button
                  onClick={testOllamaConnection}
                  disabled={connectionStatus === 'testing'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded text-sm font-medium transition-colors"
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
              <p className="text-xs text-zinc-500 mt-1.5">
                Used for auto-generating snippet titles
              </p>
            </div>

            {/* Model selection */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1.5">Model</label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                disabled={modelsLoading || ollamaModels.length === 0}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
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

          {/* Sync History */}
          <section className="border-t border-zinc-800 pt-6">
            <SyncHistory />
          </section>
        </div>
      </div>
    </div>
  )
}
