/**
 * Consolidated localStorage persistence with versioned state
 * Reduces multiple storage calls to single read/write operations
 */

const STORAGE_KEY = 'prompt-workbench-state'
const CURRENT_VERSION = 1

// Legacy keys for migration
const LEGACY_KEYS = {
  content: 'prompt-workbench-content',
  divider: 'prompt-workbench-divider',
  previewVisible: 'prompt-workbench-preview-visible',
} as const

export interface PersistedState {
  version: number
  content: string
  dividerPercent: number
  previewVisible: boolean
}

const DEFAULT_STATE: PersistedState = {
  version: CURRENT_VERSION,
  content: '',
  dividerPercent: 60,
  previewVisible: true,
}

/**
 * Migrate from legacy separate keys to consolidated state
 */
function migrateLegacyState(): PersistedState | null {
  const content = localStorage.getItem(LEGACY_KEYS.content)
  const divider = localStorage.getItem(LEGACY_KEYS.divider)
  const previewVisible = localStorage.getItem(LEGACY_KEYS.previewVisible)

  // No legacy data
  if (!content && !divider && previewVisible === null) {
    return null
  }

  const state: PersistedState = {
    version: CURRENT_VERSION,
    content: content ?? '',
    dividerPercent: divider ? parseFloat(divider) || 60 : 60,
    previewVisible: previewVisible !== null ? previewVisible === 'true' : true,
  }

  // Clean up legacy keys
  localStorage.removeItem(LEGACY_KEYS.content)
  localStorage.removeItem(LEGACY_KEYS.divider)
  localStorage.removeItem(LEGACY_KEYS.previewVisible)

  // Save migrated state
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

  return state
}

/**
 * Load persisted state - single localStorage read
 */
export function loadPersistedState(): PersistedState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      const parsed = JSON.parse(stored) as PersistedState
      // Future: handle version migrations here
      return { ...DEFAULT_STATE, ...parsed, version: CURRENT_VERSION }
    }

    // Check for legacy data to migrate
    const migrated = migrateLegacyState()
    if (migrated) return migrated

    return DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

/**
 * Save persisted state - single localStorage write
 */
export function savePersistedState(state: Partial<PersistedState>): void {
  try {
    const current = loadPersistedState()
    const updated = { ...current, ...state, version: CURRENT_VERSION }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Silently fail on storage errors (quota exceeded, etc)
  }
}

/**
 * Update single field - reads current, merges, writes
 */
export function updatePersistedField<K extends keyof PersistedState>(
  key: K,
  value: PersistedState[K]
): void {
  savePersistedState({ [key]: value })
}
