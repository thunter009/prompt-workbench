/**
 * Client-side: check if localStorage has data + DB is empty → migrate
 */

const LS_KEYS = {
  snippets: 'prompt-workbench-snippets',
  folders: 'prompt-workbench-folders',
  versions: 'prompt-workbench-versions',
  syncSettings: 'prompt-workbench-sync-settings',
  syncHistory: 'prompt-workbench-sync-history',
  aiSettings: 'prompt-workbench-ai-settings',
  keywordStyle: 'prompt-workbench-keyword-style-prefs',
  methodology: 'prompt-workbench-folder-methodology',
  playground: 'prompt-workbench-playground',
  testValues: 'prompt-workbench-test-values',
  runHistory: 'prompt-workbench-run-history',
  compareModels: 'prompt-workbench-compare-models',
  expandedFolders: 'prompt-workbench-expanded-folders',
  searchSettings: 'prompt-workbench-search-settings',
  keywordExceptions: 'prompt-workbench-keyword-exceptions',
  consolidatedState: 'prompt-workbench-state',
} as const

function readSnapshot(keys: readonly string[]): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {}
  for (const key of keys) {
    snapshot[key] = localStorage.getItem(key)
  }
  return snapshot
}

function safeParseFromSnapshot<T>(snapshot: Record<string, string | null>, key: string, fallback: T): T {
  try {
    const val = snapshot[key]
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

export async function checkAndMigrate(): Promise<{ migrated: boolean; counts?: Record<string, number> }> {
  if (typeof window === 'undefined') return { migrated: false }

  const snapshot = readSnapshot(Object.values(LS_KEYS))

  // Check if localStorage has snippet data
  const snippets = safeParseFromSnapshot<unknown[]>(snapshot, LS_KEYS.snippets, [])
  const folders = safeParseFromSnapshot<unknown[]>(snapshot, LS_KEYS.folders, [])
  const hasLocalData = snippets.length > 0 || folders.length > 0

  if (!hasLocalData) return { migrated: false }

  // Check if DB already has data
  try {
    const res = await fetch('/api/db/snippets')
    const dbSnippets = await res.json()
    if (dbSnippets.length > 0) return { migrated: false } // DB already populated
  } catch {
    return { migrated: false }
  }

  // Build migration payload
  const versions = safeParseFromSnapshot<unknown[]>(snapshot, LS_KEYS.versions, [])

  // Collect settings from various localStorage keys
  const settingsPayload: Record<string, unknown> = {}

  const syncSettings = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.syncSettings, null)
  if (syncSettings) settingsPayload.syncSettings = syncSettings

  const aiSettings = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.aiSettings, null)
  if (aiSettings) settingsPayload.aiSettings = aiSettings

  const keywordStyle = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.keywordStyle, null)
  if (keywordStyle) settingsPayload.keywordStylePrefs = keywordStyle

  const methodology = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.methodology, null)
  if (methodology) {
    // Zustand persist wraps in { state: ..., version: ... }
    const inner = (methodology as { state?: unknown }).state ?? methodology
    settingsPayload.folderMethodology = inner
  }

  const playground = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.playground, null)
  if (playground) {
    const tab = (playground as { activeTab?: string }).activeTab
    if (tab) settingsPayload.playgroundActiveTab = tab
  }

  const testValues = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.testValues, null)
  if (testValues) settingsPayload.playgroundTestValues = testValues

  const compareModels = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.compareModels, null)
  if (compareModels) settingsPayload.playgroundCompareModels = compareModels

  const expandedFolders = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.expandedFolders, null)
  if (expandedFolders) settingsPayload.expandedFolders = expandedFolders

  const searchSettings = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.searchSettings, null)
  if (searchSettings) settingsPayload.searchSettings = searchSettings

  const keywordExceptions = safeParseFromSnapshot<unknown>(snapshot, LS_KEYS.keywordExceptions, null)
  if (keywordExceptions) settingsPayload.keywordExceptions = keywordExceptions

  // Also migrate previewVisible from consolidated state
  const consolidated = safeParseFromSnapshot<{ previewVisible?: boolean }>(snapshot, LS_KEYS.consolidatedState, {})
  if (consolidated.previewVisible !== undefined) {
    settingsPayload.previewVisible = consolidated.previewVisible
  }

  // Send to migration API
  try {
    const res = await fetch('/api/db/migrate-from-localstorage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippets,
        folders,
        versions,
        settings: settingsPayload,
      }),
    })

    const result = await res.json()

    // Clear localStorage (theme stays for next-themes pre-hydration)
    for (const key of Object.values(LS_KEYS)) {
      localStorage.removeItem(key)
    }
    // Also remove legacy keys
    localStorage.removeItem('prompt-workbench-content')
    localStorage.removeItem('prompt-workbench-divider')
    localStorage.removeItem('prompt-workbench-preview-visible')

    return { migrated: true, counts: result.migrated }
  } catch {
    return { migrated: false }
  }
}
