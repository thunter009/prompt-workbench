import { NextRequest } from 'next/server'
import { getFileWatcher, type FileChangeEvent } from '@/lib/sync'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const watcher = getFileWatcher()

      const sendEvent = (events: FileChangeEvent[]) => {
        if (closed) return
        const data = JSON.stringify(events)
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      // Start watching if not already
      if (!watcher.isWatching()) {
        watcher.start(sendEvent)
      } else {
        // Already watching, subscribe to events
        watcher.start(sendEvent)
      }

      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        if (closed) return
        controller.enqueue(encoder.encode(': ping\n\n'))
      }, 30000)

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(pingInterval)
        watcher.stop()
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
