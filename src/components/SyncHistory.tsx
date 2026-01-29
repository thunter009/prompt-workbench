'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Upload, Download, AlertTriangle, Trash2 } from 'lucide-react'
import { useSyncHistoryStore } from '@/lib/sync-history-store'
import type { SyncEvent, SyncDirection, SyncEventType } from '@/types'

type DirectionFilter = 'all' | SyncDirection

function getEventIcon(direction: SyncDirection) {
  switch (direction) {
    case 'push':
      return <Upload className="w-3.5 h-3.5 text-blue-400" />
    case 'pull':
      return <Download className="w-3.5 h-3.5 text-green-400" />
    case 'conflict':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
  }
}

function getEventLabel(type: SyncEventType): string {
  switch (type) {
    case 'export':
      return 'Exported'
    case 'import':
      return 'Imported'
    case 'conflict_detected':
      return 'Conflict detected'
    case 'conflict_resolved':
      return 'Conflict resolved'
    case 'file_change':
      return 'File changed'
    case 'interval_sync':
      return 'Scheduled sync'
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface SyncEventItemProps {
  event: SyncEvent
}

function SyncEventItem({ event }: SyncEventItemProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = event.details && (
    (event.details.snippetNames && event.details.snippetNames.length > 0) ||
    event.details.filePath ||
    event.details.resolution
  )

  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        disabled={!hasDetails}
        className={`w-full px-3 py-2 flex items-center gap-2 text-left ${
          hasDetails ? 'hover:bg-zinc-800/50 cursor-pointer' : 'cursor-default'
        }`}
      >
        {hasDetails ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {getEventIcon(event.direction)}

        <span className="text-sm text-zinc-300 flex-1">
          {getEventLabel(event.type)}
          {event.count > 0 && (
            <span className="text-zinc-500 ml-1">
              ({event.count} snippet{event.count !== 1 ? 's' : ''})
            </span>
          )}
        </span>

        <span className="text-xs text-zinc-500">
          {formatTime(event.timestamp)}
        </span>
      </button>

      {expanded && event.details && (
        <div className="px-3 pb-2 pl-10">
          {event.details.snippetNames && event.details.snippetNames.length > 0 && (
            <div className="text-xs text-zinc-500">
              {event.details.snippetNames.slice(0, 5).map((name, i) => (
                <span key={i} className="inline-block bg-zinc-800 px-1.5 py-0.5 rounded mr-1 mb-1">
                  {name}
                </span>
              ))}
              {event.details.snippetNames.length > 5 && (
                <span className="text-zinc-600">
                  +{event.details.snippetNames.length - 5} more
                </span>
              )}
            </div>
          )}
          {event.details.filePath && (
            <div className="text-xs text-zinc-500 font-mono truncate">
              {event.details.filePath}
            </div>
          )}
          {event.details.resolution && (
            <div className="text-xs text-zinc-500">
              Resolution: {event.details.resolution.replace('_', ' ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SyncHistory() {
  const events = useSyncHistoryStore((s) => s.events)
  const clearHistory = useSyncHistoryStore((s) => s.clearHistory)
  const load = useSyncHistoryStore((s) => s.load)

  const [filter, setFilter] = useState<DirectionFilter>('all')

  useEffect(() => {
    load()
  }, [load])

  const filteredEvents = filter === 'all'
    ? events
    : events.filter((e) => e.direction === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-zinc-300">Sync History</h4>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as DirectionFilter)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
          >
            <option value="all">All</option>
            <option value="push">Push</option>
            <option value="pull">Pull</option>
            <option value="conflict">Conflicts</option>
          </select>
          {events.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
              title="Clear history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border border-zinc-800 rounded-lg max-h-48 overflow-auto">
        {filteredEvents.length === 0 ? (
          <div className="px-3 py-4 text-xs text-zinc-500 text-center">
            {events.length === 0 ? 'No sync events yet' : 'No events match filter'}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <SyncEventItem key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  )
}
