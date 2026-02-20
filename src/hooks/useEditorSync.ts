import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSnippetStore } from '@/lib/store'
import { useTitleInference } from '@/hooks/useTitleInference'
import { useImprovePrompt } from '@/components/ImprovePrompt'
import { togglePreviewEffect, previewEnabledField } from '@/components/editor/raycast-placeholder-language'
import type { EditorView } from '@codemirror/view'
import type { DiffComparison } from '@/components/editor/InlineDiffView'

const AUTOSAVE_DEBOUNCE_MS = 500

type SaveStatus = 'idle' | 'saving' | 'saved'

export function useEditorSync() {
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [inlinePreviewsOn, setInlinePreviewsOn] = useState(false)
  const [activeDiff, setActiveDiff] = useState<DiffComparison | null>(null)

  const editorViewRef = useRef<EditorView | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startTransition] = useTransition()

  const { selectedId, getSelectedSnippet, updateSnippet, createSnippet, syncScroll } = useSnippetStore(
    useShallow((s) => ({
      selectedId: s.selectedId,
      getSelectedSnippet: s.getSelectedSnippet,
      updateSnippet: s.updateSnippet,
      createSnippet: s.createSnippet,
      syncScroll: s.syncScroll,
    }))
  )

  // Title inference
  const handleTitleInferred = useCallback((title: string) => {
    if (selectedId) {
      updateSnippet(selectedId, { name: title })
    }
  }, [selectedId, updateSnippet])

  const { scheduleInference, cancelInference } = useTitleInference({
    onTitleInferred: handleTitleInferred,
  })

  // Improve prompt
  const handleAcceptImproved = useCallback((improved: string) => {
    setContent(improved)
    if (selectedId) {
      updateSnippet(selectedId, { text: improved })
    }
  }, [selectedId, updateSnippet])

  const improve = useImprovePrompt(content, handleAcceptImproved)

  // Sync editor content with selected snippet
  useEffect(() => {
    const snippet = getSelectedSnippet()
    setContent(snippet?.text ?? '')
    setActiveDiff(null)
  }, [selectedId, getSelectedSnippet])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current)
      cancelInference()
    }
  }, [cancelInference])

  const handleEditorViewReady = useCallback((view: EditorView | null) => {
    editorViewRef.current = view
    if (view) {
      setInlinePreviewsOn(view.state.field(previewEnabledField))
    }
  }, [])

  const toggleInlinePreviews = useCallback(() => {
    const view = editorViewRef.current
    if (!view) return
    const next = !view.state.field(previewEnabledField)
    view.dispatch({ effects: togglePreviewEffect.of(next) })
    setInlinePreviewsOn(next)
  }, [])

  const handleEditorScroll = useCallback((progress: number) => {
    if (syncScroll) {
      startTransition(() => {
        setScrollProgress(progress)
      })
    }
  }, [syncScroll])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current)

    setSaveStatus('saving')

    saveTimerRef.current = setTimeout(() => {
      if (selectedId) {
        updateSnippet(selectedId, { text: value })
        const snippet = getSelectedSnippet()
        if (snippet?.name === 'Untitled') {
          scheduleInference('Untitled', value)
        }
      } else if (value.trim()) {
        createSnippet({ name: 'Untitled', text: value })
      }

      setSaveStatus('saved')
      savedIndicatorTimerRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [selectedId, updateSnippet, createSnippet, getSelectedSnippet, scheduleInference])

  return {
    content,
    saveStatus,
    scrollProgress,
    inlinePreviewsOn,
    activeDiff,
    setActiveDiff,
    editorViewRef,
    handleContentChange,
    handleEditorScroll,
    handleEditorViewReady,
    toggleInlinePreviews,
    improve,
  }
}
