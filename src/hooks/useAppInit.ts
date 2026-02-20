import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { checkAndMigrate } from '@/lib/db/migration-check'
import { useSnippetStore } from '@/lib/store'
import { useVersionStore } from '@/lib/version-store'
import { usePlaygroundStore } from '@/lib/playground-store'
import { useSyncSettingsStore } from '@/lib/sync-settings-store'
import { useSyncHistoryStore } from '@/lib/sync-history-store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import {
  hasValidExportHandle,
  getStoredExportPath,
  supportsFileSystemAccess,
  getDefaultExportPath,
} from '@/lib/raycast/export'

export function useAppInit(): { mounted: boolean } {
  const [mounted, setMounted] = useState(false)
  const setExportSettings = useSnippetStore((s) => s.setExportSettings)

  useEffect(() => {
    async function init() {
      const migration = await checkAndMigrate()
      if (migration.migrated) {
        toast.success('Data migrated from browser to SQLite', {
          description: `${migration.counts?.snippets ?? 0} snippets, ${migration.counts?.folders ?? 0} folders`,
        })
      }

      await Promise.all([
        useSnippetStore.getState().hydrate(),
        useVersionStore.getState().hydrate(),
        usePlaygroundStore.getState().hydrate(),
        useSyncSettingsStore.getState().hydrate(),
        useSyncHistoryStore.getState().hydrate(),
        useAISettingsStore.getState().hydrate(),
      ])

      const storedPath = getStoredExportPath()
      if (storedPath) {
        hasValidExportHandle().then((valid) => {
          setExportSettings({ defaultPath: storedPath, hasDirectoryHandle: valid })
        })
      } else if (!supportsFileSystemAccess()) {
        setExportSettings({ defaultPath: getDefaultExportPath(), hasDirectoryHandle: true })
      }

      setMounted(true)
    }
    init()
  }, [setExportSettings])

  return { mounted }
}
