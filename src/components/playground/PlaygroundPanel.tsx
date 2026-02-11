'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Play, Square, MessageSquare, Loader2, GitCompareArrows, Check, AlertTriangle } from 'lucide-react'
import { useSnippetStore } from '@/lib/store'
import { usePlaygroundStore } from '@/lib/playground-store'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { resolveSnippetIncludes } from '@/lib/raycast/snippet-resolver'
import { TestValueInputs } from '@/components/playground/TestValueInputs'
import { ResponseViewer } from '@/components/playground/ResponseViewer'
import { CompareViewer } from '@/components/playground/CompareViewer'
import { RunHistory } from '@/components/playground/RunHistory'
import { cn } from '@/lib/utils'

function ModelMultiSelect({
  ollamaUrl,
  selected,
  onToggle,
}: {
  ollamaUrl: string
  selected: string[]
  onToggle: (model: string) => void
}) {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchModels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ollama/models?url=${encodeURIComponent(ollamaUrl)}`)
      const data = await res.json()
      setModels(data.models ?? [])
    } catch {
      setModels([])
    } finally {
      setLoading(false)
    }
  }, [ollamaUrl])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border bg-background hover:bg-accent transition-colors min-w-[140px] justify-between"
      >
        <span className="truncate text-secondary-foreground">
          {selected.length === 0
            ? 'Select models...'
            : `${selected.length} model${selected.length > 1 ? 's' : ''}`}
        </span>
        <GitCompareArrows className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-56 bg-muted border border-border rounded shadow-lg max-h-48 overflow-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading...
              </div>
            ) : models.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No models available
              </div>
            ) : (
              models.map((model) => {
                const isSelected = selected.includes(model)
                const atMax = selected.length >= 3 && !isSelected
                return (
                  <button
                    key={model}
                    onClick={() => {
                      if (!atMax) onToggle(model)
                    }}
                    disabled={atMax}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : atMax
                          ? 'text-muted-foreground/50 cursor-not-allowed'
                          : 'text-secondary-foreground hover:bg-accent',
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary border-primary' : 'border-border',
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <span className="truncate">{model}</span>
                  </button>
                )
              })
            )}
            {selected.length >= 3 && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
                Max 3 models
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function PlaygroundPanel() {
  const snippet = useSnippetStore((s) => s.getSelectedSnippet())
  const snippets = useSnippetStore((s) => s.snippets)
  const isRunning = usePlaygroundStore((s) => s.isRunning)
  const isComparing = usePlaygroundStore((s) => s.isComparing)
  const run = usePlaygroundStore((s) => s.run)
  const stop = usePlaygroundStore((s) => s.stop)
  const snippetErrors = usePlaygroundStore((s) => s.snippetErrors)
  const compareModels = usePlaygroundStore((s) => s.compareModels)
  const toggleCompareModel = usePlaygroundStore((s) => s.toggleCompareModel)
  const compareRun = usePlaygroundStore((s) => s.compareRun)
  const stopCompare = usePlaygroundStore((s) => s.stopCompare)
  const compareResponses = usePlaygroundStore((s) => s.compareResponses)
  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)

  const busy = isRunning || isComparing
  const hasCompareResults = Object.keys(compareResponses).length > 0

  // Check for snippet resolution errors reactively
  const hasErrors = useMemo(() => {
    if (!snippet) return false
    const { errors } = resolveSnippetIncludes(snippet.text, snippets)
    return errors.length > 0
  }, [snippet, snippets])

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
      snippets,
    })
  }

  const handleCompare = () => {
    compareRun({
      text: snippet.text,
      snippetId: snippet.id,
      ollamaUrl,
      snippets,
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 space-y-4 overflow-auto flex-1">
        <TestValueInputs snippetId={snippet.id} text={snippet.text} />

        {/* Snippet resolution errors */}
        {(hasErrors || snippetErrors.length > 0) && (
          <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Broken snippet references</p>
              {snippetErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-400/80">
                  {e.error === 'not_found' && `"${e.snippetName}" not found`}
                  {e.error === 'circular' && `"${e.snippetName}" creates circular reference`}
                  {e.error === 'max_depth' && `"${e.snippetName}" exceeds max nesting depth`}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Single-model run */}
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
              disabled={isComparing || hasErrors}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              title={hasErrors ? 'Fix broken snippet references' : undefined}
            >
              <Play className="w-3.5 h-3.5" />
              Run
            </button>
          )}

          <div className="w-px h-6 bg-border" />

          {/* Multi-model compare */}
          <ModelMultiSelect
            ollamaUrl={ollamaUrl}
            selected={compareModels}
            onToggle={toggleCompareModel}
          />

          {isComparing ? (
            <button
              onClick={stopCompare}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleCompare}
              disabled={compareModels.length < 2 || isRunning || hasErrors}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
              title={hasErrors ? 'Fix broken snippet references' : undefined}
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              Compare
            </button>
          )}

          {busy && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {hasCompareResults || isComparing ? (
          <CompareViewer />
        ) : (
          <ResponseViewer />
        )}
        <RunHistory snippetId={snippet.id} />
      </div>
    </div>
  )
}
