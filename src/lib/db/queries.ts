import { eq, desc, inArray } from 'drizzle-orm'
import { getDb } from './connection'
import * as schema from './schema'

// ── Snippets ──

export function getAllSnippets() {
  return getDb().select().from(schema.snippets).all()
}

export function createSnippet(data: typeof schema.snippets.$inferInsert) {
  return getDb().insert(schema.snippets).values(data).returning().get()
}

export function updateSnippet(id: string, data: Partial<Omit<typeof schema.snippets.$inferInsert, 'id'>>) {
  return getDb().update(schema.snippets).set(data).where(eq(schema.snippets.id, id)).returning().get()
}

export function deleteSnippets(ids: string[]) {
  if (ids.length === 0) return []
  return getDb().delete(schema.snippets).where(inArray(schema.snippets.id, ids)).returning().all()
}

// ── Folders ──

export function getAllFolders() {
  return getDb().select().from(schema.folders).all()
}

export function createFolder(data: typeof schema.folders.$inferInsert) {
  return getDb().insert(schema.folders).values(data).returning().get()
}

export function updateFolder(id: string, data: Partial<Omit<typeof schema.folders.$inferInsert, 'id'>>) {
  return getDb().update(schema.folders).set(data).where(eq(schema.folders.id, id)).returning().get()
}

export function deleteFolder(id: string) {
  return getDb().delete(schema.folders).where(eq(schema.folders.id, id)).returning().get()
}

// ── Versions ──

export function getVersionsBySnippet(snippetId: string) {
  return getDb()
    .select()
    .from(schema.versions)
    .where(eq(schema.versions.snippetId, snippetId))
    .orderBy(desc(schema.versions.createdAt))
    .all()
}

export function getAllVersions() {
  return getDb().select().from(schema.versions).all()
}

export function createVersion(data: typeof schema.versions.$inferInsert) {
  return getDb().insert(schema.versions).values(data).returning().get()
}

export function deleteVersion(id: string) {
  return getDb().delete(schema.versions).where(eq(schema.versions.id, id)).returning().get()
}

export function deleteVersionsBySnippet(snippetId: string) {
  return getDb().delete(schema.versions).where(eq(schema.versions.snippetId, snippetId)).returning().all()
}

export function pruneVersions(snippetId: string, keepCount: number) {
  const all = getDb()
    .select()
    .from(schema.versions)
    .where(eq(schema.versions.snippetId, snippetId))
    .orderBy(desc(schema.versions.createdAt))
    .all()

  if (all.length <= keepCount) return 0

  const toDelete = all.slice(keepCount).map((v) => v.id)
  getDb().delete(schema.versions).where(inArray(schema.versions.id, toDelete)).run()
  return toDelete.length
}

// ── Settings ──

export function getAllSettings() {
  return getDb().select().from(schema.settings).all()
}

export function getSettings(keys: string[]) {
  if (keys.length === 0) return []
  return getDb().select().from(schema.settings).where(inArray(schema.settings.key, keys)).all()
}

export function upsertSettings(entries: Array<{ key: string; value: unknown }>) {
  const db = getDb()
  for (const entry of entries) {
    db.insert(schema.settings)
      .values({ key: entry.key, value: entry.value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: entry.value } })
      .run()
  }
}

// ── Playground Runs ──

export function getPlaygroundRuns(snippetId: string, limit = 5) {
  return getDb()
    .select()
    .from(schema.playgroundRuns)
    .where(eq(schema.playgroundRuns.snippetId, snippetId))
    .orderBy(desc(schema.playgroundRuns.createdAt))
    .limit(limit)
    .all()
}

export function getAllPlaygroundRuns() {
  return getDb()
    .select()
    .from(schema.playgroundRuns)
    .orderBy(desc(schema.playgroundRuns.createdAt))
    .all()
}

export function createPlaygroundRun(data: typeof schema.playgroundRuns.$inferInsert) {
  return getDb().insert(schema.playgroundRuns).values(data).returning().get()
}

// ── Sync History ──

export function getSyncHistory(limit = 50) {
  return getDb()
    .select()
    .from(schema.syncHistory)
    .orderBy(desc(schema.syncHistory.timestamp))
    .limit(limit)
    .all()
}

export function createSyncEvent(data: typeof schema.syncHistory.$inferInsert) {
  return getDb().insert(schema.syncHistory).values(data).returning().get()
}

export function clearSyncHistory() {
  return getDb().delete(schema.syncHistory).run()
}
