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
  const body: SyncSettingsBody = await request.json()
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
      // Start with sync callback that triggers conflict detection
      scheduler.start(async () => {
        console.log('[IntervalSync] Running scheduled sync')
        // The actual sync work is done via SSE to connected clients
        // We just update lastSyncTime here
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
