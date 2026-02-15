import { NextRequest, NextResponse } from 'next/server'
import {
  getIntervalScheduler,
  type SyncInterval,
  SYNC_INTERVALS,
} from '@/lib/sync'

export const dynamic = 'force-dynamic'

interface SyncSettingsBody {
  intervalSyncEnabled?: boolean
  syncInterval?: SyncInterval
}

// GET current scheduler state
export async function GET() {
  const scheduler = getIntervalScheduler()

  return NextResponse.json({
    running: scheduler.isRunning(),
    interval: scheduler.getInterval(),
    lastSyncTime: scheduler.getLastSyncTime(),
  })
}

// POST to update scheduler settings
export async function POST(request: NextRequest) {
  let body: SyncSettingsBody
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const scheduler = getIntervalScheduler()

  // Update interval if provided
  if (body.syncInterval !== undefined) {
    if (!SYNC_INTERVALS.some((i) => i.value === body.syncInterval)) {
      return NextResponse.json(
        { error: `Invalid interval: ${body.syncInterval}` },
        { status: 400 }
      )
    }
    scheduler.setInterval(body.syncInterval)
  }

  // Enable/disable scheduler
  if (body.intervalSyncEnabled !== undefined) {
    if (body.intervalSyncEnabled && !scheduler.isRunning()) {
      scheduler.start(async () => {
        console.log('[IntervalSync] Running scheduled sync')
        // Read ~/.prompt-workbench/*.json files for sync
        const os = await import('os')
        const fs = await import('fs/promises')
        const path = await import('path')
        const dir = path.join(os.homedir(), '.prompt-workbench')
        try {
          const files = await fs.readdir(dir)
          const jsonFiles = files.filter((f) => f.endsWith('.json'))
          for (const file of jsonFiles) {
            const content = await fs.readFile(path.join(dir, file), 'utf-8')
            JSON.parse(content) // validate parseable
          }
          console.log(`[IntervalSync] Read ${jsonFiles.length} files from ${dir}`)
        } catch {
          console.log('[IntervalSync] No files found in ~/.prompt-workbench')
        }
      }, body.syncInterval ?? scheduler.getInterval())
    } else if (!body.intervalSyncEnabled && scheduler.isRunning()) {
      scheduler.stop()
    }
  }

  return NextResponse.json({
    running: scheduler.isRunning(),
    interval: scheduler.getInterval(),
    lastSyncTime: scheduler.getLastSyncTime(),
  })
}
