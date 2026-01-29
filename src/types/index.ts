export interface Snippet {
  id: string
  name: string
  text: string
  keyword?: string
  folderId?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  version: number
  raycastSyncedAt?: number
  lastExportedAt?: number
}

export interface Folder {
  id: string
  name: string
  parentId?: string
  orderIndex: number
}

export interface SnippetVersion {
  id: string
  snippetId: string
  text: string
  createdAt: number
}

export interface SyncSettings {
  watcherEnabled: boolean
  intervalEnabled: boolean
  intervalMinutes: number
  lastSyncAt?: number
  raycastPath: string
}

export interface RaycastSnippet {
  name: string
  text: string
  keyword?: string
}

// Conflict detection types
export type ConflictType = 'modified' | 'deleted_local' | 'deleted_remote' | 'new_remote'

export interface SnippetConflict {
  id: string
  type: ConflictType
  localSnippet?: Snippet      // undefined if deleted locally or new remote
  remoteSnippet?: RaycastSnippet  // undefined if deleted remotely
  filePath: string
  detectedAt: number
}

export type ConflictResolution = 'keep_local' | 'keep_remote' | 'keep_both' | 'merge'

// Merge data passed with merge resolution
export interface MergeData {
  name: string
  text: string
  keyword?: string
}

// Sync history types
export type SyncDirection = 'push' | 'pull' | 'conflict'

export type SyncEventType =
  | 'export'           // push to Raycast
  | 'import'           // pull from Raycast
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'file_change'      // Raycast file changed
  | 'interval_sync'    // scheduled sync ran

export interface SyncEvent {
  id: string
  timestamp: number
  direction: SyncDirection
  type: SyncEventType
  count: number                    // number of snippets affected
  details?: SyncEventDetails
}

export interface SyncEventDetails {
  snippetNames?: string[]          // names of affected snippets
  filePath?: string                // for file changes
  resolution?: ConflictResolution  // for conflict_resolved
  conflictCount?: number           // for conflict_detected
}
