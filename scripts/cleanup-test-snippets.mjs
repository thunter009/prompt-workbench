#!/usr/bin/env node

import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { homedir } from 'os'
import { isAbsolute, join, resolve } from 'path'

const DEFAULT_TARGET_NAMES = [
  'Tab Test',
  'Snippet A',
  'Snippet B',
  'Editor Test',
  'EditorTest',
  'EditorTestA',
  'EditorTestB',
]

function resolveDbPath(configuredPath) {
  const trimmed = configuredPath?.trim()
  if (!trimmed) return join(homedir(), '.prompt-workbench', 'data.db')
  if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2))
  if (isAbsolute(trimmed)) return trimmed
  return resolve(process.cwd(), trimmed)
}

function toLowerUnique(values) {
  return [...new Set(values.map((v) => v.toLowerCase()))]
}

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`
}

const apply = process.argv.includes('--apply')
const dbPath = resolveDbPath(process.env.PROMPT_WORKBENCH_DB_PATH)
const lowerTargets = toLowerUnique(DEFAULT_TARGET_NAMES)
const placeholders = lowerTargets.map(() => '?').join(', ')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

const candidateRows = db
  .prepare(
    `SELECT name, COUNT(*) AS count
       FROM snippets
      WHERE lower(name) IN (${placeholders})
      GROUP BY name
      ORDER BY count DESC, name ASC`
  )
  .all(...lowerTargets)

const candidateTotal = candidateRows.reduce((sum, row) => sum + row.count, 0)

if (candidateTotal === 0) {
  console.log(`No matching test snippets found in ${dbPath}.`)
  db.close()
  process.exit(0)
}

console.log(`Found ${candidateTotal} matching test snippets in ${dbPath}:`)
for (const row of candidateRows) {
  console.log(`- ${row.name}: ${row.count}`)
}

if (!apply) {
  console.log('Dry run only. Re-run with --apply to create backup and delete these rows.')
  db.close()
  process.exit(0)
}

const backupDir = join(homedir(), '.prompt-workbench', 'backups')
const stamp = new Date().toISOString().replace(/[.:]/g, '-')
const backupPath = join(backupDir, `data.pre-test-snippet-cleanup.${stamp}.db`)

try {
  mkdirSync(backupDir, { recursive: true })
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.exec(`VACUUM INTO ${sqlString(backupPath)}`)
  console.log(`Backup created: ${backupPath}`)
} catch (error) {
  console.error(`Backup failed, aborting cleanup: ${error instanceof Error ? error.message : String(error)}`)
  db.close()
  process.exit(1)
}

const snippetIds = db
  .prepare(`SELECT id FROM snippets WHERE lower(name) IN (${placeholders})`)
  .all(...lowerTargets)
  .map((row) => row.id)

if (snippetIds.length === 0) {
  console.log('Nothing to delete after backup.')
  db.close()
  process.exit(0)
}

const idPlaceholders = snippetIds.map(() => '?').join(', ')

const cleanup = db.transaction((ids) => {
  const deletedVersions = db
    .prepare(`DELETE FROM versions WHERE snippet_id IN (${idPlaceholders})`)
    .run(...ids).changes

  const deletedRuns = db
    .prepare(`DELETE FROM playground_runs WHERE snippet_id IN (${idPlaceholders})`)
    .run(...ids).changes

  const deletedSnippets = db
    .prepare(`DELETE FROM snippets WHERE id IN (${idPlaceholders})`)
    .run(...ids).changes

  const deletedOrphanVersions = db
    .prepare('DELETE FROM versions WHERE snippet_id NOT IN (SELECT id FROM snippets)')
    .run().changes

  const deletedOrphanRuns = db
    .prepare('DELETE FROM playground_runs WHERE snippet_id NOT IN (SELECT id FROM snippets)')
    .run().changes

  return {
    deletedSnippets,
    deletedVersions,
    deletedRuns,
    deletedOrphanVersions,
    deletedOrphanRuns,
  }
})

const result = cleanup(snippetIds)

console.log(`Deleted snippets: ${result.deletedSnippets}`)
console.log(`Deleted versions: ${result.deletedVersions}`)
console.log(`Deleted playground runs: ${result.deletedRuns}`)

if (result.deletedOrphanVersions > 0 || result.deletedOrphanRuns > 0) {
  console.log(`Deleted orphan versions: ${result.deletedOrphanVersions}`)
  console.log(`Deleted orphan playground runs: ${result.deletedOrphanRuns}`)
}

db.close()
