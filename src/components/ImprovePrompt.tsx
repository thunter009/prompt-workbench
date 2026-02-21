'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { InlineDiffView } from '@/components/editor/InlineDiffView'
import { cn } from '@/lib/utils'

const MIN_TEXT_LENGTH = 20

type Status = 'idle' | 'loading' | 'review' | 'error'

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
    setStatus('idle')
    setOriginal('')
    setImproved('')
    setError('')
  }, [])

  const handleImprove = useCallback(async () => {
    if (disabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setOriginal(text)
    setError('')

    try {
      const res = await fetch('/api/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          systemPrompt: metaSystemPrompt,
          ollamaUrl,
          model: ollamaModel,
        }),
        signal: controller.signal,
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to improve prompt')
        setStatus('error')
        return
      }

      setImproved(data.improved)
      setStatus('review')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('idle')
        return
      }
      setError(err instanceof Error ? err.message : 'Request failed')
      setStatus('error')
    }
  }, [text, disabled, metaSystemPrompt, ollamaUrl, ollamaModel])

  const accept = useCallback(() => {
    onAccept(improved)
    reset()
  }, [improved, onAccept, reset])

  const reject = useCallback(() => {
    reset()
  }, [reset])

  // Cleanup abort on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return { status, original, improved, error, disabled, handleImprove, accept, reject, reset }
}

/** Sparkle button for the toolbar */
export function ImprovePromptButton({
  disabled,
  loading,
  onImprove,
}: {
  disabled: boolean
  loading: boolean
  onImprove: () => void
}) {
  return (
    <button
      onClick={onImprove}
      disabled={disabled || loading}
      title={disabled ? 'Text too short (<20 chars)' : 'Improve prompt with AI'}
      className={cn(
        'p-1.5 rounded transition-colors',
        disabled || loading
          ? 'opacity-40 cursor-not-allowed text-muted-foreground'
          : 'hover:bg-accent text-muted-foreground hover:text-purple-400'
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
    </button>
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
