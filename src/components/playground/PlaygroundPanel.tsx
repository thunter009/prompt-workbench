'use client'

import { Play, Square, MessageSquare, Loader2 } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { usePlaygroundStore } from '@/lib/playground-store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { TestValueInputs } from '@/components/playground/TestValueInputs'

export function PlaygroundPanel() {
  const snippet = useSnippetStore((s) => s.getSelectedSnippet())
  const isRunning = usePlaygroundStore((s) => s.isRunning)
  const currentResponse = usePlaygroundStore((s) => s.currentResponse)
  const run = usePlaygroundStore((s) => s.run)
  const stop = usePlaygroundStore((s) => s.stop)
  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)

  if (!snippet) {
    return (
      <div className="h-full flex flex-col bg-muted">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Select a snippet to test</p>
          </div>
        </div>
      </div>
    )
  }

  const handleRun = () => {
    run({
      text: snippet.text,
      snippetId: snippet.id,
      ollamaUrl,
      model: ollamaModel,
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 space-y-4 overflow-auto flex-1">
        <TestValueInputs snippetId={snippet.id} text={snippet.text} />

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Run
            </button>
          )}
          {isRunning && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {currentResponse && (
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Response
            </h3>
            <div className="p-3 text-sm bg-background border border-border rounded whitespace-pre-wrap break-words">
              {currentResponse}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
