/**
 * Typed fetch wrapper for DB API routes.
 * All methods are fire-and-forget safe -- catch errors silently for writes.
 *
 * The API routes pass data directly to/from Drizzle, which uses camelCase
 * JS property names (matching the schema definition). No case conversion needed.
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

// Drizzle returns camelCase with nulls; app types use undefined for optional fields.
// These helpers convert null↔undefined at the boundary.

interface DrizzleSnippet {
  id: string
  name: string
  text: string
  keyword: string | null
  folderId: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
  version: number
  raycastSyncedAt: number | null
  lastExportedAt: number | null
}

interface DrizzleFolder {
  id: string
  name: string
  parentId: string | null
  orderIndex: number
}

interface DrizzleVersion {
  id: string
  snippetId: string
  text: string
  createdAt: number
}

interface DrizzlePlaygroundRun {
  id: string
  snippetId: string
  model: string
  testValues: Record<string, string>
  assembledPrompt: string
  response: string
  tokenCount: number
  durationMs: number
  compareGroup: string[] | null
  createdAt: number
}

interface SettingRow {
  key: string
  value: unknown
}

interface SyncHistoryRow {
  id: string
  timestamp: number
  direction: string
  type: string
  count: number
  details: Record<string, unknown> | null
}

function toSnippet(r: DrizzleSnippet): Snippet {
  return {
    id: r.id,
    name: r.name,
    text: r.text,
    keyword: r.keyword ?? undefined,
    folderId: r.folderId ?? undefined,
    tags: r.tags ?? [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    version: r.version,
    raycastSyncedAt: r.raycastSyncedAt ?? undefined,
    lastExportedAt: r.lastExportedAt ?? undefined,
  }
}

function fromSnippet(s: Snippet): DrizzleSnippet {
  return {
    id: s.id,
    name: s.name,
    text: s.text,
    keyword: s.keyword ?? null,
    folderId: s.folderId ?? null,
    tags: s.tags,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    version: s.version,
    raycastSyncedAt: s.raycastSyncedAt ?? null,
    lastExportedAt: s.lastExportedAt ?? null,
  }
}

function toFolder(r: DrizzleFolder): Folder {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parentId ?? undefined,
    orderIndex: r.orderIndex,
  }
}

function fromFolder(f: Folder): DrizzleFolder {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId ?? null,
    orderIndex: f.orderIndex,
  }
}

function toVersion(r: DrizzleVersion): SnippetVersion {
  return {
    id: r.id,
    snippetId: r.snippetId,
    text: r.text,
    createdAt: r.createdAt,
  }
}

function toPlaygroundRun(r: DrizzlePlaygroundRun): PlaygroundRun {
  return {
    timestamp: r.createdAt,
    model: r.model,
    testValues: r.testValues,
    assembledPrompt: r.assembledPrompt,
    response: r.response,
    tokenCount: r.tokenCount,
    durationMs: r.durationMs,
    compareGroup: r.compareGroup ?? undefined,
  }
}

function toSyncEvent(r: SyncHistoryRow): SyncEvent {
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
    const rows = await json<DrizzleSnippet[]>(`${BASE}/snippets`)
    return rows.map(toSnippet)
  },

  createSnippet(s: Snippet) {
    post(`${BASE}/snippets`, fromSnippet(s)).catch(() => {})
  },

  updateSnippet(id: string, data: Partial<Snippet>) {
    const mapped: Record<string, unknown> = { id }
    if (data.name !== undefined) mapped.name = data.name
    if (data.text !== undefined) mapped.text = data.text
    if (data.keyword !== undefined) mapped.keyword = data.keyword ?? null
    if (data.folderId !== undefined) mapped.folderId = data.folderId ?? null
    if (data.tags !== undefined) mapped.tags = data.tags
    if (data.createdAt !== undefined) mapped.createdAt = data.createdAt
    if (data.updatedAt !== undefined) mapped.updatedAt = data.updatedAt
    if (data.version !== undefined) mapped.version = data.version
    if (data.raycastSyncedAt !== undefined) mapped.raycastSyncedAt = data.raycastSyncedAt ?? null
    if (data.lastExportedAt !== undefined) mapped.lastExportedAt = data.lastExportedAt ?? null
    put(`${BASE}/snippets`, mapped).catch(() => {})
  },

  deleteSnippets(ids: string[]) {
    del(`${BASE}/snippets`, { ids }).catch(() => {})
  },

  // ── Folders ──
  async getFolders(): Promise<Folder[]> {
    const rows = await json<DrizzleFolder[]>(`${BASE}/folders`)
    return rows.map(toFolder)
  },

  createFolder(f: Folder) {
    post(`${BASE}/folders`, fromFolder(f)).catch(() => {})
  },

  updateFolder(id: string, data: Partial<Folder>) {
    const mapped: Record<string, unknown> = { id }
    if (data.name !== undefined) mapped.name = data.name
    if (data.parentId !== undefined) mapped.parentId = data.parentId ?? null
    if (data.orderIndex !== undefined) mapped.orderIndex = data.orderIndex
    put(`${BASE}/folders`, mapped).catch(() => {})
  },

  deleteFolder(id: string) {
    del(`${BASE}/folders`, { id }).catch(() => {})
  },

  // ── Versions ──
  async getVersions(): Promise<SnippetVersion[]> {
    const rows = await json<DrizzleVersion[]>(`${BASE}/versions`)
    return rows.map(toVersion)
  },

  async getVersionsBySnippet(snippetId: string): Promise<SnippetVersion[]> {
    const rows = await json<DrizzleVersion[]>(`${BASE}/versions?snippetId=${snippetId}`)
    return rows.map(toVersion)
  },

  createVersion(v: SnippetVersion) {
    post(`${BASE}/versions`, {
      id: v.id,
      snippetId: v.snippetId,
      text: v.text,
      createdAt: v.createdAt,
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
    const rows = await json<DrizzlePlaygroundRun[]>(url)
    return rows.map(toPlaygroundRun)
  },

  async getPlaygroundRunHistory(limitPerSnippet = 5): Promise<Record<string, PlaygroundRun[]>> {
    const rows = await json<DrizzlePlaygroundRun[]>(`${BASE}/playground`)
    const grouped: Record<string, PlaygroundRun[]> = {}

    for (const row of rows) {
      const existing = grouped[row.snippetId] ?? []
      if (existing.length >= limitPerSnippet) continue
      grouped[row.snippetId] = [...existing, toPlaygroundRun(row)]
    }

    return grouped
  },

  createPlaygroundRun(snippetId: string, run: PlaygroundRun) {
    post(`${BASE}/playground`, {
      id: crypto.randomUUID(),
      snippetId,
      model: run.model,
      testValues: run.testValues,
      assembledPrompt: run.assembledPrompt,
      response: run.response,
      tokenCount: run.tokenCount,
      durationMs: run.durationMs,
      compareGroup: run.compareGroup ?? null,
      createdAt: run.timestamp,
    }).catch(() => {})
  },

  // ── Sync History ──
  async getSyncHistory(): Promise<SyncEvent[]> {
    const rows = await json<SyncHistoryRow[]>(`${BASE}/sync-history`)
    return rows.map(toSyncEvent)
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
