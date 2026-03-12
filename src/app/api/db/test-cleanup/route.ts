import { NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'
import { DB_PATH } from '@/lib/db/connection'

const normalizedDbPath = DB_PATH.replace(/\\/g, '/').toLowerCase()
const TEST_DB_ACTIVE =
  normalizedDbPath.includes('/.prompt-workbench/e2e/') ||
  normalizedDbPath.endsWith('/.prompt-workbench-e2e.db')
const TEST_API_ENABLED = process.env.PW_ENABLE_TEST_API === '1' && TEST_DB_ACTIVE

export async function DELETE() {
  if (!TEST_API_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  q.deleteAllPlaygroundRuns()
  q.clearSyncHistory()
  q.deleteAllVersions()
  q.deleteAllSnippets()
  q.deleteAllFolders()
  q.deleteAllSettings()

  return NextResponse.json({ success: true })
}
