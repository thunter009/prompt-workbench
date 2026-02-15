import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/connection'
import * as schema from '@/lib/db/schema'

interface MigrationPayload {
  snippets?: Array<{
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
  }>
  folders?: Array<{
    id: string
    name: string
    parentId?: string
    orderIndex: number
  }>
  versions?: Array<{
    id: string
    snippetId: string
    text: string
    createdAt: number
  }>
  settings?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const payload = await req.json() as MigrationPayload
  const db = getDb()

  let snippetCount = 0
  let folderCount = 0
  let versionCount = 0
  let settingsCount = 0

  // Insert snippets
  if (payload.snippets?.length) {
    for (const s of payload.snippets) {
      db.insert(schema.snippets)
        .values({
          id: s.id,
          name: s.name,
          text: s.text,
          keyword: s.keyword ?? null,
          folderId: s.folderId ?? null,
          tags: s.tags ?? [],
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          version: s.version,
          raycastSyncedAt: s.raycastSyncedAt ?? null,
          lastExportedAt: s.lastExportedAt ?? null,
        })
        .onConflictDoNothing()
        .run()
      snippetCount++
    }
  }

  // Insert folders
  if (payload.folders?.length) {
    for (const f of payload.folders) {
      db.insert(schema.folders)
        .values({
          id: f.id,
          name: f.name,
          parentId: f.parentId ?? null,
          orderIndex: f.orderIndex,
        })
        .onConflictDoNothing()
        .run()
      folderCount++
    }
  }

  // Insert versions
  if (payload.versions?.length) {
    for (const v of payload.versions) {
      db.insert(schema.versions)
        .values({
          id: v.id,
          snippetId: v.snippetId,
          text: v.text,
          createdAt: v.createdAt,
        })
        .onConflictDoNothing()
        .run()
      versionCount++
    }
  }

  // Insert settings
  if (payload.settings) {
    for (const [key, value] of Object.entries(payload.settings)) {
      db.insert(schema.settings)
        .values({ key, value })
        .onConflictDoNothing()
        .run()
      settingsCount++
    }
  }

  return NextResponse.json({
    migrated: { snippets: snippetCount, folders: folderCount, versions: versionCount, settings: settingsCount },
  })
}
