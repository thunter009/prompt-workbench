'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { useSyncSettingsStore, SYNC_INTERVALS, type SyncInterval } from '@/lib/sync-settings-store'
import { useIntervalSync } from '@/hooks/useIntervalSync'
import { SyncHistory } from '@/components/SyncHistory'
import {
  pickDefaultExportDirectory,
  clearDefaultExportPath,
  getStoredExportPath,
  hasValidExportHandle,
} from '@/lib/raycast/export'

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false)

  const exportSettings = useSnippetStore((s) => s.exportSettings)
  const setExportSettings = useSnippetStore((s) => s.setExportSettings)

  const fileWatcherEnabled = useSyncSettingsStore((s) => s.fileWatcherEnabled)
  const setFileWatcherEnabled = useSyncSettingsStore((s) => s.setFileWatcherEnabled)

  const {
    enabled: intervalEnabled,
    interval: syncInterval,
    lastSyncTime,
    setEnabled: setIntervalEnabled,
    setInterval: setSyncInterval,
    triggerSync,
  } = useIntervalSync()

  useEffect(() => {
    const storedPath = getStoredExportPath()
    if (storedPath) {
      hasValidExportHandle().then((valid) => {
        setExportSettings({ defaultPath: storedPath, hasDirectoryHandle: valid })
      })
    }
    setMounted(true)
  }, [setExportSettings])

  const handlePickExportDir = async () => {
    const name = await pickDefaultExportDirectory()
    if (name) {
      setExportSettings({ defaultPath: name, hasDirectoryHandle: true })
      toast.success(`Default export path set to ${name}`)
    }
  }

  const handleClearExportDir = async () => {
    await clearDefaultExportPath()
    setExportSettings({ defaultPath: null, hasDirectoryHandle: false })
    toast.success('Default export path cleared')
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
            title="Back to editor"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-medium">Settings</h1>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-lg space-y-6">
            {/* Export settings */}
            <section>
              <h2 className="text-sm font-medium text-zinc-300 mb-3">Default Export Path</h2>
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
            </section>

            {/* Sync settings */}
            <section className="border-t border-zinc-800 pt-6">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Raycast Sync</h2>

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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Now
                </button>
              </div>
            </section>

            {/* Sync History */}
            <section className="border-t border-zinc-800 pt-6">
              <SyncHistory />
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
