import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { useFileWatcher, type FileChangeEvent } from '@/hooks/useFileWatcher'
import { useSnippetStore } from '@/lib/store'
import { useConflictStore } from '@/lib/conflict-store'
import { useSyncSettingsStore } from '@/lib/sync-settings-store'
import { useSyncHistoryStore } from '@/lib/sync-history-store'
import { detectConflicts } from '@/lib/sync/conflict-detection'

export function useFileSync(): void {
  const snippets = useSnippetStore((s) => s.snippets)
  const { addConflicts, openConflictPanel } = useConflictStore(
    useShallow((s) => ({
      addConflicts: s.addConflicts,
      openConflictPanel: s.openPanel,
    }))
  )
  const addSyncEvent = useSyncHistoryStore((s) => s.addEvent)
  const fileWatcherEnabled = useSyncSettingsStore((s) => s.fileWatcherEnabled)

  const handleFileChanges = useCallback(async (events: FileChangeEvent[]) => {
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

      const conflicts = detectConflicts(events, fileContents, snippets)

      addSyncEvent('pull', 'file_change', events.length, {
        filePath: events[0]?.path,
      })

      if (conflicts.length > 0) {
        addConflicts(conflicts)
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
}
