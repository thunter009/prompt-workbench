'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { InlineDiffView } from '@/components/editor/InlineDiffView'
import { IMPROVE_STRATEGY_TEMPLATES, StrategyPicker, type ImproveStrategyChoice } from '@/components/StrategyPicker'

const MIN_TEXT_LENGTH = 20

type Status = 'idle' | 'loading' | 'streaming' | 'review' | 'error'

export function useImprovePrompt(text: string, onAccept: (improved: string) => void) {
  const [status, setStatus] = useState<Status>('idle')
  const [original, setOriginal] = useState('')
  const [improved, setImproved] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)
  const metaSystemPrompt = useAISettingsStore((s) => s.metaSystemPrompt)

  const disabled = text.length < MIN_TEXT_LENGTH

  const reset = useCallback(() => {
    const controller = abortRef.current
    abortRef.current = null
    controller?.abort()
    setStatus('idle')
    setOriginal('')
    setImproved('')
    setError('')
  }, [])

  const handleImprove = useCallback(async (strategy?: ImproveStrategyChoice) => {
    if (disabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setOriginal(text)
    setImproved('')
    setError('')

    const strategyInstruction = strategy?.id === 'custom'
      ? strategy.customInstruction?.trim() ?? ''
      : IMPROVE_STRATEGY_TEMPLATES[strategy?.id ?? 'detailed']

    const systemPrompt = [metaSystemPrompt.trim(), strategyInstruction ? `Additional strategy:\n${strategyInstruction}` : '']
      .filter(Boolean)
      .join('\n\n')

    try {
      const res = await fetch('/api/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          systemPrompt,
          ollamaUrl,
          model: ollamaModel,
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
          if (!finalText.trim()) {
            setError('Empty response from model')
            setStatus('error')
            completed = true
            return
          }
          setImproved(finalText)
          setStatus('review')
          completed = true
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
        setImproved(streamed)
        setStatus('review')
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
  }, [text, disabled, metaSystemPrompt, ollamaUrl, ollamaModel])

  const accept = useCallback(() => {
    onAccept(improved)
    reset()
  }, [improved, onAccept, reset])

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

  return { status, original, improved, error, disabled, handleImprove, accept, reject, cancel, reset }
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
  error,
  onAccept,
  onReject,
}: {
  status: Status
  original: string
  improved: string
  error: string
  onAccept: () => void
  onReject: () => void
}) {
  if (status === 'review') {
    return (
      <div className="absolute inset-0 z-20 bg-background/95">
        <InlineDiffView
          original={original}
          modified={improved}
          originalLabel="Current"
          modifiedLabel="Improved"
          onRestore={onAccept}
          restoreLabel="Accept"
          onClose={onReject}
        />
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
