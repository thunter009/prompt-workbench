import { useCallback, useRef } from 'react'
import { useAISettingsStore } from '@/lib/ai-settings-store'

const INFER_DEBOUNCE_MS = 2000
const MIN_CONTENT_LENGTH = 50

interface InferTitleOptions {
  onTitleInferred: (title: string) => void
}

export function useTitleInference({ onTitleInferred }: InferTitleOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inferringRef = useRef(false)

  const ollamaUrl = useAISettingsStore((s) => s.ollamaUrl)
  const ollamaModel = useAISettingsStore((s) => s.ollamaModel)

  const inferTitle = useCallback(
    async (content: string) => {
      if (inferringRef.current) return

      inferringRef.current = true
      try {
        const res = await fetch('/api/infer-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            ollamaUrl,
            model: ollamaModel,
          }),
        })

        if (res.ok) {
          const { title } = await res.json()
          if (title && title !== 'Untitled') {
            onTitleInferred(title)
          }
        }
      } catch {
        // Silently fail - keep "Untitled" if Ollama unavailable
      } finally {
        inferringRef.current = false
      }
    },
    [ollamaUrl, ollamaModel, onTitleInferred]
  )

  const scheduleInference = useCallback(
    (title: string, content: string) => {
      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      // Only infer if title is "Untitled" and content is long enough
      if (title !== 'Untitled' || content.length < MIN_CONTENT_LENGTH) {
        return
      }

      // Schedule inference
      timerRef.current = setTimeout(() => {
        inferTitle(content)
      }, INFER_DEBOUNCE_MS)
    },
    [inferTitle]
  )

  const cancelInference = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return { scheduleInference, cancelInference }
}
