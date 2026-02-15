/**
 * Typed fetch wrapper for DB API routes.
 * All methods are fire-and-forget safe -- catch errors silently for writes.
 */

import type { Snippet, Folder, SnippetVersion, SyncEvent, SyncEventDetails } from '@/types'
import type { PlaygroundRun } from '@/lib/playground-store'

const BASE = '/api/db'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

function post(url: string, body: unknown) {
  return json(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function put(url: string, body: unknown) {
  return json(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function del(url: string, body?: unknown) {
  return json(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// DB row uses snake_case, app uses camelCase. Transform.
interface SnippetRow {
  id: string
  name: string
  text: string
  keyword: string | null
  folder_id: string | null
  tags: string[]
  created_at: number
  updated_at: number
  version: number
  raycast_synced_at: number | null
  last_exported_at: number | null
}

interface FolderRow {
  id: string
  name: string
  parent_id: string | null
  order_index: number
}

interface VersionRow {
  id: string
  snippet_id: string
  text: string
  created_at: number
}

interface SettingRow {
  key: string
  value: unknown
}

interface PlaygroundRunRow {
  id: string
  snippet_id: string
  model: string
  test_values: Record<string, string>
  assembled_prompt: string
  response: string
  token_count: number
  duration_ms: number
  compare_group: string[] | null
  created_at: number
}

interface SyncHistoryRow {
  id: string
  timestamp: number
  direction: string
  type: string
  count: number
  details: Record<string, unknown> | null
}

function rowToSnippet(r: SnippetRow): Snippet {
  return {
    id: r.id,
    name: r.name,
    text: r.text,
    keyword: r.keyword ?? undefined,
    folderId: r.folder_id ?? undefined,
    tags: r.tags ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version,
    raycastSyncedAt: r.raycast_synced_at ?? undefined,
    lastExportedAt: r.last_exported_at ?? undefined,
  }
}

function snippetToRow(s: Snippet): SnippetRow {
  return {
    id: s.id,
    name: s.name,
    text: s.text,
    keyword: s.keyword ?? null,
    folder_id: s.folderId ?? null,
    tags: s.tags,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    version: s.version,
    raycast_synced_at: s.raycastSyncedAt ?? null,
    last_exported_at: s.lastExportedAt ?? null,
  }
}

function rowToFolder(r: FolderRow): Folder {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parent_id ?? undefined,
    orderIndex: r.order_index,
  }
}

function folderToRow(f: Folder): FolderRow {
  return {
    id: f.id,
    name: f.name,
    parent_id: f.parentId ?? null,
    order_index: f.orderIndex,
  }
}

function rowToVersion(r: VersionRow): SnippetVersion {
  return {
    id: r.id,
    snippetId: r.snippet_id,
    text: r.text,
    createdAt: r.created_at,
  }
}

function rowToPlaygroundRun(r: PlaygroundRunRow): PlaygroundRun {
  return {
    timestamp: r.created_at,
    model: r.model,
    testValues: r.test_values,
    assembledPrompt: r.assembled_prompt,
    response: r.response,
    tokenCount: r.token_count,
    durationMs: r.duration_ms,
    compareGroup: r.compare_group ?? undefined,
  }
}

function rowToSyncEvent(r: SyncHistoryRow): SyncEvent {
  return {
    id: r.id,
    timestamp: r.timestamp,
    direction: r.direction as SyncEvent['direction'],
    type: r.type as SyncEvent['type'],
    count: r.count,
    details: r.details as SyncEventDetails | undefined,
  }
}

export const dbClient = {
  // ── Snippets ──
  async getSnippets(): Promise<Snippet[]> {
    const rows = await json<SnippetRow[]>(`${BASE}/snippets`)
    return rows.map(rowToSnippet)
  },

  createSnippet(s: Snippet) {
    post(`${BASE}/snippets`, snippetToRow(s)).catch(() => {})
  },

  updateSnippet(id: string, data: Partial<Snippet>) {
    const mapped: Record<string, unknown> = { id }
    if (data.name !== undefined) mapped.name = data.name
    if (data.text !== undefined) mapped.text = data.text
    if (data.keyword !== undefined) mapped.keyword = data.keyword ?? null
    if (data.folderId !== undefined) mapped.folder_id = data.folderId ?? null
    if (data.tags !== undefined) mapped.tags = data.tags
    if (data.createdAt !== undefined) mapped.created_at = data.createdAt
    if (data.updatedAt !== undefined) mapped.updated_at = data.updatedAt
    if (data.version !== undefined) mapped.version = data.version
    if (data.raycastSyncedAt !== undefined) mapped.raycast_synced_at = data.raycastSyncedAt ?? null
    if (data.lastExportedAt !== undefined) mapped.last_exported_at = data.lastExportedAt ?? null
    put(`${BASE}/snippets`, mapped).catch(() => {})
  },

  deleteSnippets(ids: string[]) {
    del(`${BASE}/snippets`, { ids }).catch(() => {})
  },

  // ── Folders ──
  async getFolders(): Promise<Folder[]> {
    const rows = await json<FolderRow[]>(`${BASE}/folders`)
    return rows.map(rowToFolder)
  },

  createFolder(f: Folder) {
    post(`${BASE}/folders`, folderToRow(f)).catch(() => {})
  },

  updateFolder(id: string, data: Partial<Folder>) {
    const mapped: Record<string, unknown> = { id }
    if (data.name !== undefined) mapped.name = data.name
    if (data.parentId !== undefined) mapped.parent_id = data.parentId ?? null
    if (data.orderIndex !== undefined) mapped.order_index = data.orderIndex
    put(`${BASE}/folders`, mapped).catch(() => {})
  },

  deleteFolder(id: string) {
    del(`${BASE}/folders`, { id }).catch(() => {})
  },

  // ── Versions ──
  async getVersions(): Promise<SnippetVersion[]> {
    const rows = await json<VersionRow[]>(`${BASE}/versions`)
    return rows.map(rowToVersion)
  },

  async getVersionsBySnippet(snippetId: string): Promise<SnippetVersion[]> {
    const rows = await json<VersionRow[]>(`${BASE}/versions?snippetId=${snippetId}`)
    return rows.map(rowToVersion)
  },

  createVersion(v: SnippetVersion) {
    post(`${BASE}/versions`, {
      id: v.id,
      snippet_id: v.snippetId,
      text: v.text,
      created_at: v.createdAt,
    }).catch(() => {})
  },

  deleteVersion(id: string) {
    del(`${BASE}/versions`, { id }).catch(() => {})
  },

  deleteVersionsBySnippet(snippetId: string) {
    del(`${BASE}/versions`, { snippetId }).catch(() => {})
  },

  pruneVersions(snippetId: string, keepCount: number) {
    del(`${BASE}/versions`, { snippetId, pruneKeep: keepCount }).catch(() => {})
  },

  // ── Settings ──
  async getAllSettings(): Promise<Record<string, unknown>> {
    const rows = await json<SettingRow[]>(`${BASE}/settings`)
    const map: Record<string, unknown> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  },

  async getSettings(keys: string[]): Promise<Record<string, unknown>> {
    const rows = await json<SettingRow[]>(`${BASE}/settings?keys=${keys.join(',')}`)
    const map: Record<string, unknown> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  },

  saveSettings(entries: Array<{ key: string; value: unknown }>) {
    put(`${BASE}/settings`, { entries }).catch(() => {})
  },

  saveSetting(key: string, value: unknown) {
    put(`${BASE}/settings`, { entries: [{ key, value }] }).catch(() => {})
  },

  // ── Playground Runs ──
  async getPlaygroundRuns(snippetId?: string): Promise<PlaygroundRun[]> {
    const url = snippetId ? `${BASE}/playground?snippetId=${snippetId}` : `${BASE}/playground`
    const rows = await json<PlaygroundRunRow[]>(url)
    return rows.map(rowToPlaygroundRun)
  },

  createPlaygroundRun(snippetId: string, run: PlaygroundRun) {
    post(`${BASE}/playground`, {
      id: crypto.randomUUID(),
      snippet_id: snippetId,
      model: run.model,
      test_values: run.testValues,
      assembled_prompt: run.assembledPrompt,
      response: run.response,
      token_count: run.tokenCount,
      duration_ms: run.durationMs,
      compare_group: run.compareGroup ?? null,
      created_at: run.timestamp,
    }).catch(() => {})
  },

  // ── Sync History ──
  async getSyncHistory(): Promise<SyncEvent[]> {
    const rows = await json<SyncHistoryRow[]>(`${BASE}/sync-history`)
    return rows.map(rowToSyncEvent)
  },

  createSyncEvent(event: SyncEvent) {
    post(`${BASE}/sync-history`, {
      id: event.id,
      timestamp: event.timestamp,
      direction: event.direction,
      type: event.type,
      count: event.count,
      details: event.details ?? null,
    }).catch(() => {})
  },

  clearSyncHistory() {
    del(`${BASE}/sync-history`).catch(() => {})
  },
}
