'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'

export interface EditorProps {
  initialValue?: string
  onChange?: (value: string) => void
  onScrollProgress?: (progress: number) => void
}

export function Editor({ initialValue = '', onChange, onScrollProgress }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onScrollProgressRef = useRef(onScrollProgress)
  const initialValueRef = useRef(initialValue)
  const [mounted, setMounted] = useState(false)

  // Keep refs in sync
  onChangeRef.current = onChange
  onScrollProgressRef.current = onScrollProgress
  initialValueRef.current = initialValue

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current) {
        onChangeRef.current(update.state.doc.toString())
      }
    })

    // Scroll listener extension
    const scrollListener = EditorView.domEventHandlers({
      scroll: (event, view) => {
        if (onScrollProgressRef.current) {
          const scroller = view.scrollDOM
          const maxScroll = scroller.scrollHeight - scroller.clientHeight
          const progress = maxScroll > 0 ? scroller.scrollTop / maxScroll : 0
          onScrollProgressRef.current(progress)
        }
        return false
      },
    })

    const theme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'rgb(9 9 11)', // zinc-950
      },
      '.cm-content': {
        fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
        fontSize: '14px',
        padding: '16px 0',
        caretColor: 'rgb(250 250 250)', // zinc-50
      },
      '.cm-line': {
        padding: '0 16px',
      },
      '.cm-cursor': {
        borderLeftColor: 'rgb(250 250 250)',
      },
      '.cm-gutters': {
        backgroundColor: 'rgb(9 9 11)',
        color: 'rgb(113 113 122)', // zinc-500
        border: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgb(24 24 27)', // zinc-900
      },
      '.cm-activeLine': {
        backgroundColor: 'rgb(24 24 27)',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'rgb(63 63 70) !important', // zinc-700
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgb(63 63 70) !important',
      },
    })

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        updateListener,
        scrollListener,
        theme,
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [mounted])

  if (!mounted) {
    return (
      <div className="h-full bg-zinc-950 flex items-center justify-center text-zinc-500">
        Loading editor...
      </div>
    )
  }

  return <div ref={containerRef} className="h-full overflow-hidden" />
}
