import { NextRequest, NextResponse } from 'next/server'
import { getIntervalScheduler } from '@/lib/sync'

export const dynamic = 'force-dynamic'

// POST to trigger an immediate sync
export async function POST() {
  const scheduler = getIntervalScheduler()
  scheduler.triggerNow()

  return NextResponse.json({
    triggered: true,
    lastSyncTime: scheduler.getLastSyncTime(),
  })
}

// GET current sync status
export async function GET(request: NextRequest) {
  const scheduler = getIntervalScheduler()

  // SSE stream for sync events
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const state = {
        running: scheduler.isRunning(),
        interval: scheduler.getInterval(),
        lastSyncTime: scheduler.getLastSyncTime(),
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`))

      // Keep connection alive with periodic status updates
      const statusInterval = setInterval(() => {
        if (closed) return
        const update = {
          running: scheduler.isRunning(),
          interval: scheduler.getInterval(),
          lastSyncTime: scheduler.getLastSyncTime(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`))
      }, 30000)

      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(statusInterval)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
