import { NextResponse } from 'next/server'
import * as q from '@/lib/db/queries'

const TEST_API_ENABLED = process.env.PW_ENABLE_TEST_API === '1'

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
