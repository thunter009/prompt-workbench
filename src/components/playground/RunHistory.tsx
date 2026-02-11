'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, RotateCcw, GitCompareArrows } from 'lucide-react'
import { usePlaygroundStore } from '@/lib/playground-store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { cn } from '@/lib/utils'
import type { PlaygroundRun } from '@/lib/playground-store'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

function HistoryItem({
  run,
  snippetId,
}: {
  run: PlaygroundRun
  snippetId: string
}) {
  const setTestValue = usePlaygroundStore((s) => s.setTestValue)
  const runAction = usePlaygroundStore((s) => s.run)
  const isRunning = usePlaygroundStore((s) => s.isRunning)
  const isComparing = usePlaygroundStore((s) => s.isComparing)
  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)

  const handleView = () => {
    usePlaygroundStore.setState({
      currentResponse: run.response,
      responseMeta: {
        model: run.model,
        tokenCount: run.tokenCount,
        elapsedMs: run.durationMs,
      },
      compareResponses: {},
    })
  }

  const handleRerun = () => {
    for (const [key, value] of Object.entries(run.testValues)) {
      setTestValue(snippetId, key, value)
    }
    runAction({
      text: run.assembledPrompt,
      snippetId,
      ollamaUrl,
      model: run.model,
    })
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded hover:bg-accent/50 transition-colors group">
      <button
        onClick={handleView}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(run.timestamp)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="flex items-center gap-1">
            {run.compareGroup && (
              <GitCompareArrows className="w-3 h-3 text-violet-400" />
            )}
            {run.model}
          </span>
          <span className="text-muted-foreground/60">&middot;</span>
          <span>{formatDuration(run.durationMs)}</span>
          {run.compareGroup && (
            <>
              <span className="text-muted-foreground/60">&middot;</span>
              <span className="text-violet-400 text-[10px]">
                vs {run.compareGroup.filter((m) => m !== run.model).join(', ')}
              </span>
            </>
          )}
        </div>
        <p className="text-xs text-secondary-foreground mt-0.5 truncate">
          {truncate(run.response.replace(/\n/g, ' '), 100)}
        </p>
      </button>
      <button
        onClick={handleRerun}
        disabled={isRunning || isComparing}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-secondary-foreground hover:bg-accent transition-all disabled:opacity-30"
        title="Re-run with these values"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function RunHistory({ snippetId }: { snippetId: string }) {
  const [open, setOpen] = useState(false)
  const history = usePlaygroundStore((s) => s.getHistory(snippetId))

  if (history.length === 0) return null

  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-secondary-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <Clock className="w-3 h-3" />
        History ({history.length})
      </button>

      {open && (
        <div className={cn(
          'border border-border rounded divide-y divide-border',
          'bg-background',
        )}>
          {history.map((run) => (
            <HistoryItem key={`${run.timestamp}-${run.model}`} run={run} snippetId={snippetId} />
          ))}
        </div>
      )}
    </div>
  )
}
