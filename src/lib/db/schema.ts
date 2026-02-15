import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const snippets = sqliteTable('snippets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  text: text('text').notNull().default(''),
  keyword: text('keyword'),
  folderId: text('folder_id'),
  tags: text('tags', { mode: 'json' }).notNull().$type<string[]>().default([]),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  version: integer('version').notNull().default(1),
  raycastSyncedAt: integer('raycast_synced_at'),
  lastExportedAt: integer('last_exported_at'),
})

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  orderIndex: integer('order_index').notNull().default(0),
})

export const versions = sqliteTable('versions', {
  id: text('id').primaryKey(),
  snippetId: text('snippet_id').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull().$type<unknown>(),
})

export const playgroundRuns = sqliteTable('playground_runs', {
  id: text('id').primaryKey(),
  snippetId: text('snippet_id').notNull(),
  model: text('model').notNull(),
  testValues: text('test_values', { mode: 'json' }).notNull().$type<Record<string, string>>(),
  assembledPrompt: text('assembled_prompt').notNull(),
  response: text('response').notNull(),
  tokenCount: integer('token_count').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  compareGroup: text('compare_group', { mode: 'json' }).$type<string[] | null>(),
  createdAt: integer('created_at').notNull(),
})

export const syncHistory = sqliteTable('sync_history', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp').notNull(),
  direction: text('direction').notNull(), // push | pull | conflict
  type: text('type').notNull(),
  count: integer('count').notNull(),
  details: text('details', { mode: 'json' }).$type<Record<string, unknown> | null>(),
})
