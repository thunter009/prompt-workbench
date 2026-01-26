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
