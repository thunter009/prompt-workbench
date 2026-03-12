import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { dirname, isAbsolute, join, resolve } from 'path'
import { mkdirSync } from 'fs'
import { homedir } from 'os'
import * as schema from './schema'

function resolveDbPath(configuredPath: string | undefined): string {
  const trimmed = configuredPath?.trim()
  if (!trimmed) return join(homedir(), '.prompt-workbench', 'data.db')
  if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2))
  if (isAbsolute(trimmed)) return trimmed
  return resolve(process.cwd(), trimmed)
}

const DB_PATH = resolveDbPath(process.env.PROMPT_WORKBENCH_DB_PATH)
const DB_DIR = dirname(DB_PATH)

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (_db) return _db

  mkdirSync(DB_DIR, { recursive: true })

  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  _db = drizzle(sqlite, { schema })
  return _db
}

export { DB_PATH }
