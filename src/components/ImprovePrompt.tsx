'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, Check, X } from 'lucide-react'
import { useAISettingsStore } from '@/lib/ai-settings-store'
import { cn } from '@/lib/utils'

const MIN_TEXT_LENGTH = 20

type Status = 'idle' | 'loading' | 'review' | 'error'

export function useImprovePrompt(text: string, onAccept: (improved: string) => void) {
  const [status, setStatus] = useState<Status>('idle')
  const [improved, setImproved] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)
  const metaSystemPrompt = useAISettingsStore((s) => s.metaSystemPrompt)

  const disabled = text.length < MIN_TEXT_LENGTH

  const handleImprove = useCallback(async () => {
    if (disabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
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
    setStatus('idle')
    setImproved('')
  }, [improved, onAccept])

  const reject = useCallback(() => {
    setStatus('idle')
    setImproved('')
  }, [])

  // Keyboard: Enter=accept, Escape=reject in review mode
  useEffect(() => {
    if (status !== 'review') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        accept()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        reject()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [status, accept, reject])

  // Cleanup abort on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return { status, improved, error, disabled, handleImprove, accept, reject }
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

/** Review overlay - render inside a relative-positioned container */
export function ImprovePromptReview({
  status,
  improved,
  error,
  onAccept,
  onReject,
}: {
  status: Status
  improved: string
  error: string
  onAccept: () => void
  onReject: () => void
}) {
  if (status !== 'review' && status !== 'error') return null

  return (
    <div className="absolute inset-0 z-20 bg-background/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">
          {status === 'review' ? 'Improved Prompt' : 'Error'}
        </span>
        <div className="flex items-center gap-1">
          {status === 'review' && (
            <button
              onClick={onAccept}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              title="Accept (Enter)"
            >
              <Check className="w-3 h-3" />
              Accept
            </button>
          )}
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-muted hover:bg-accent text-foreground rounded transition-colors"
            title="Reject (Escape)"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {status === 'review' ? (
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {improved}
          </pre>
        ) : (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  )
}
