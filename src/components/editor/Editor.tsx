'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { placeholderAutocomplete } from '@/components/editor/placeholder-autocomplete'
import { raycastPlaceholderExtension } from '@/components/editor/raycast-placeholder-language'

export interface EditorProps {
  value?: string
  onChange?: (value: string) => void
  onScrollProgress?: (progress: number) => void
}

export function Editor({ value = '', onChange, onScrollProgress }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onScrollProgressRef = useRef(onScrollProgress)
  const valueRef = useRef(value)
  const isExternalUpdateRef = useRef(false)
  const [mounted, setMounted] = useState(false)

  // Keep refs in sync
  onChangeRef.current = onChange
  onScrollProgressRef.current = onScrollProgress

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync external value changes to editor (for snippet selection)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    // Only update if the external value differs from current editor content
    const currentContent = view.state.doc.toString()
    if (value !== currentContent) {
      // Mark as external update to prevent onChange firing
      isExternalUpdateRef.current = true
      valueRef.current = value
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      })
      isExternalUpdateRef.current = false
    }
  }, [value])

  useEffect(() => {
    if (!mounted || !containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current && !isExternalUpdateRef.current) {
        onChangeRef.current(update.state.doc.toString())
      }
    })

    // Scroll listener - registered manually with passive: true for better performance
    const handleScroll = () => {
      if (onScrollProgressRef.current && viewRef.current) {
        const scroller = viewRef.current.scrollDOM
        const maxScroll = scroller.scrollHeight - scroller.clientHeight
        const progress = maxScroll > 0 ? scroller.scrollTop / maxScroll : 0
        onScrollProgressRef.current(progress)
      }
    }

    const theme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'hsl(var(--background))',
      },
      '.cm-content': {
        fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
        fontSize: '14px',
        padding: '16px 0',
        caretColor: 'hsl(var(--foreground))',
      },
      '.cm-line': {
        padding: '0 16px',
      },
      '.cm-cursor': {
        borderLeftColor: 'hsl(var(--foreground))',
      },
      '.cm-gutters': {
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--muted-foreground))',
        border: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'hsl(var(--muted))',
      },
      '.cm-activeLine': {
        backgroundColor: 'hsl(var(--muted))',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'hsl(var(--accent)) !important',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'hsl(var(--accent)) !important',
      },
    })

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        placeholderAutocomplete,
        raycastPlaceholderExtension,
        updateListener,
        theme,
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    // Add passive scroll listener for smoother scrolling
    view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      view.scrollDOM.removeEventListener('scroll', handleScroll)
      view.destroy()
      viewRef.current = null
    }
  }, [mounted])

  if (!mounted) {
    return (
      <div className="h-full bg-background flex items-center justify-center text-muted-foreground">
        Loading editor...
      </div>
    )
  }

  return <div ref={containerRef} className="h-full overflow-hidden" />
}
