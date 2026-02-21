'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { InlineDiffView } from '@/components/editor/InlineDiffView'
import { IMPROVE_STRATEGY_TEMPLATES, StrategyPicker, type ImproveStrategyChoice } from '@/components/StrategyPicker'

const MIN_TEXT_LENGTH = 20

type Status = 'idle' | 'loading' | 'streaming' | 'review' | 'error'

interface ImproveVersion {
  text: string
  instruction?: string
}

function matchPlaceholders(value: string): string[] {
  const placeholderMatches = value.match(/\{\{[^{}]+\}\}/g) ?? []
  return Array.from(new Set(placeholderMatches))
}

function checkPlaceholderWarning(originalValue: string, improvedValue: string): string[] {
  const originalPlaceholders = matchPlaceholders(originalValue)
  if (originalPlaceholders.length === 0) return []

  const improvedPlaceholderSet = new Set(matchPlaceholders(improvedValue))
  return originalPlaceholders.filter((placeholder) => !improvedPlaceholderSet.has(placeholder))
}

export function useImprovePrompt(text: string, onAccept: (improved: string) => void) {
  const [status, setStatus] = useState<Status>('idle')
  const [original, setOriginal] = useState('')
  const [improved, setImproved] = useState('')
  const [versionStack, setVersionStack] = useState<ImproveVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState(-1)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const provider = useAISettingsStore((s) => s.provider)
  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)
  const openaiBaseUrl = useAISettingsStore((s) => s.openaiBaseUrl)
  const openaiApiKey = useAISettingsStore((s) => s.openaiApiKey)
  const openaiModel = useAISettingsStore((s) => s.openaiModel)
  const anthropicBaseUrl = useAISettingsStore((s) => s.anthropicBaseUrl)
  const anthropicApiKey = useAISettingsStore((s) => s.anthropicApiKey)
  const anthropicModel = useAISettingsStore((s) => s.anthropicModel)
  const metaSystemPrompt = useAISettingsStore((s) => s.metaSystemPrompt)

  const disabled = text.length < MIN_TEXT_LENGTH

  const reset = useCallback(() => {
    const controller = abortRef.current
    abortRef.current = null
    controller?.abort()
    setStatus('idle')
    setOriginal('')
    setImproved('')
    setVersionStack([])
    setCurrentVersion(-1)
    setError('')
  }, [])

  const runImprove = useCallback(async ({
    sourceText,
    instruction,
    resetVersions,
  }: {
    sourceText: string
    instruction?: string
    resetVersions: boolean
  }) => {
    if (sourceText.length < MIN_TEXT_LENGTH) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    if (resetVersions) {
      setOriginal(sourceText)
      setVersionStack([])
      setCurrentVersion(-1)
    }
    setImproved('')
    setError('')

    const systemPrompt = [metaSystemPrompt.trim(), instruction ? `Additional strategy:\n${instruction}` : '']
      .filter(Boolean)
      .join('\n\n')

    const selectedModel = provider === 'openai'
      ? openaiModel
      : provider === 'anthropic'
      ? anthropicModel
      : ollamaModel

    try {
      const res = await fetch('/api/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          systemPrompt,
          provider,
          model: selectedModel,
          ollamaUrl,
          openaiBaseUrl,
          openaiApiKey,
          anthropicBaseUrl,
          anthropicApiKey,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to improve prompt' }))
        setError(data.error || 'Failed to improve prompt')
        setStatus('error')
        return
      }

      if (!res.body) {
        setError('No response body from improve API')
        setStatus('error')
        return
      }

      setStatus('streaming')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let streamed = ''
      let completed = false

      const commitVersion = (finalText: string) => {
        const trimmedText = finalText.trim()
        if (!trimmedText) {
          setError('Empty response from model')
          setStatus('error')
          completed = true
          return
        }

        const normalizedInstruction = instruction?.trim() || undefined
        let nextIndex = -1
        setVersionStack((previous) => {
          const base = resetVersions ? [] : previous
          const next = [...base, { text: trimmedText, instruction: normalizedInstruction }]
          nextIndex = next.length - 1
          return next
        })

        setCurrentVersion(nextIndex)
        setImproved(trimmedText)
        setStatus('review')
        completed = true
      }

      const handleEvent = (rawEvent: string) => {
        let eventType = 'message'
        const dataLines: string[] = []

        for (const rawLine of rawEvent.split('\n')) {
          const line = rawLine.trim()
          if (!line) continue
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim())
          }
        }

        if (dataLines.length === 0) return

        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
        } catch {
          return
        }

        if (eventType === 'token') {
          const piece = typeof payload.text === 'string' ? payload.text : ''
          if (!piece) return
          streamed += piece
          setImproved(streamed)
          return
        }

        if (eventType === 'done') {
          const finalText = typeof payload.improved === 'string' ? payload.improved : streamed
          commitVersion(finalText)
          return
        }

        if (eventType === 'error') {
          setError(typeof payload.error === 'string' ? payload.error : 'Failed to improve prompt')
          setStatus('error')
          completed = true
        }
      }

      while (!completed) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          handleEvent(rawEvent)
          boundary = buffer.indexOf('\n\n')
        }
      }

      buffer += decoder.decode()
      if (!completed) {
        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          handleEvent(rawEvent)
          boundary = buffer.indexOf('\n\n')
        }
      }

      if (!completed && streamed.trim()) {
        commitVersion(streamed)
      } else if (!completed) {
        setError('Stream ended before completion')
        setStatus('error')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (abortRef.current === controller) {
          setStatus('idle')
        }
        return
      }
      setError(err instanceof Error ? err.message : 'Request failed')
      setStatus('error')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [
    metaSystemPrompt,
    provider,
    ollamaUrl,
    ollamaModel,
    openaiBaseUrl,
    openaiApiKey,
    openaiModel,
    anthropicBaseUrl,
    anthropicApiKey,
    anthropicModel,
  ])

  const handleImprove = useCallback(async (strategy?: ImproveStrategyChoice) => {
    if (disabled) return

    const strategyInstruction = strategy?.id === 'custom'
      ? strategy.customInstruction?.trim() ?? ''
      : IMPROVE_STRATEGY_TEMPLATES[strategy?.id ?? 'detailed']

    await runImprove({
      sourceText: text,
      instruction: strategyInstruction,
      resetVersions: true,
    })
  }, [text, disabled, runImprove])

  const improveAgain = useCallback(async (instruction?: string) => {
    const baseText = versionStack[currentVersion]?.text ?? improved
    if (!baseText) return

    await runImprove({
      sourceText: baseText,
      instruction: instruction?.trim(),
      resetVersions: false,
    })
  }, [versionStack, currentVersion, improved, runImprove])

  const goToVersion = useCallback((index: number) => {
    if (index < 0 || index >= versionStack.length) return
    setCurrentVersion(index)
    setImproved(versionStack[index].text)
    setStatus('review')
  }, [versionStack])

  const accept = useCallback(() => {
    const selectedVersion = versionStack[currentVersion]
    onAccept(selectedVersion?.text ?? improved)
    reset()
  }, [versionStack, currentVersion, improved, onAccept, reset])

  const reject = useCallback(() => {
    reset()
  }, [reset])

  const cancel = useCallback(() => {
    reset()
  }, [reset])

  // Cleanup abort on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return {
    status,
    original,
    improved,
    versionStack,
    currentVersion,
    error,
    disabled,
    handleImprove,
    improveAgain,
    goToVersion,
    accept,
    reject,
    cancel,
    reset,
  }
}

/** Sparkle button for the toolbar */
export function ImprovePromptButton({
  disabled,
  loading,
  onImprove,
}: {
  disabled: boolean
  loading: boolean
  onImprove: (strategy?: ImproveStrategyChoice) => void
}) {
  return <StrategyPicker disabled={disabled} loading={loading} onSelect={onImprove} />
}

/** Streaming overlay while model tokens are arriving */
export function ImprovePromptStreamingView({
  status,
  improved,
  onCancel,
}: {
  status: Status
  improved: string
  onCancel: () => void
}) {
  if (status !== 'loading' && status !== 'streaming') return null

  return (
    <div className="absolute inset-0 z-20 bg-background/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {status === 'loading' ? 'Starting improve stream...' : 'Streaming improve response...'}
          </span>
          {status === 'streaming' && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{improved.length} chars</span>
          )}
        </div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-muted hover:bg-accent text-foreground rounded transition-colors"
          title="Cancel improve"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
          {improved || (status === 'loading' ? 'Connecting to model...' : 'Waiting for tokens...')}
        </pre>
      </div>
    </div>
  )
}

/** Diff review overlay - render inside a relative-positioned container */
export function ImprovePromptDiffReview({
  status,
  original,
  improved,
  versionStack,
  currentVersion,
  error,
  onImproveAgain,
  onGoToVersion,
  onAccept,
  onReject,
}: {
  status: Status
  original: string
  improved: string
  versionStack: ImproveVersion[]
  currentVersion: number
  error: string
  onImproveAgain: (instruction?: string) => void
  onGoToVersion: (index: number) => void
  onAccept: () => void
  onReject: () => void
}) {
  const [instruction, setInstruction] = useState('')

  useEffect(() => {
    if (status !== 'review') {
      setInstruction('')
      return
    }
    setInstruction(versionStack[currentVersion]?.instruction ?? '')
  }, [status, currentVersion, versionStack])

  if (status === 'review') {
    const hasVersions = versionStack.length > 0
    const versionLabel = hasVersions ? `${currentVersion + 1}/${versionStack.length}` : '0/0'
    const missingPlaceholders = checkPlaceholderWarning(original, improved)
    const placeholderWarning = missingPlaceholders.length > 0
      ? `Warning: missing placeholders ${missingPlaceholders.join(', ')}`
      : null

    return (
      <div className="absolute inset-0 z-20 bg-background/95 flex flex-col">
        <div className="border-b border-border bg-muted/60 px-3 py-2 flex items-center gap-2">
          <button
            onClick={() => onGoToVersion(currentVersion - 1)}
            disabled={!hasVersions || currentVersion <= 0}
            className="px-2 py-1 rounded text-xs transition-colors bg-muted hover:bg-accent text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous version"
          >
            Prev
          </button>
          <span className="text-[11px] text-muted-foreground tabular-nums min-w-[5ch] text-center">v{versionLabel}</span>
          <button
            onClick={() => onGoToVersion(currentVersion + 1)}
            disabled={!hasVersions || currentVersion >= versionStack.length - 1}
            className="px-2 py-1 rounded text-xs transition-colors bg-muted hover:bg-accent text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next version"
          >
            Next
          </button>
          <input
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Optional instruction for improve again..."
            className="ml-1 flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => onImproveAgain(instruction)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            title="Improve again"
          >
            Improve again
          </button>
        </div>

        {placeholderWarning && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            {placeholderWarning}
          </div>
        )}

        <div className="flex-1 min-h-0">
          <InlineDiffView
            original={original}
            modified={improved}
            originalLabel="Current"
            modifiedLabel={`Improved v${versionLabel}`}
            onRestore={onAccept}
            restoreLabel="Accept"
            onClose={onReject}
          />
        </div>
      </div>
    )
  }

  if (status !== 'error') return null

  return (
    <div className="absolute inset-0 z-20 bg-background/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">Error</span>
        <button
          onClick={onReject}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-muted hover:bg-accent text-foreground rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-3 h-3" />
          Dismiss
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    </div>
  )
}
